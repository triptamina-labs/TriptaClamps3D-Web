/**
 * Web Worker OCC — corre en un hilo separado para no bloquear la UI.
 *
 * Convención de constructores en opencascade.js:
 *   new oc.ClassName_N(args)  donde N es la posición del overload en el header C++
 *   (1 = default/sin args, luego _2, _3, … en orden de aparición en el .hxx)
 *
 * Recibe via postMessage:
 *   { id, tipo, cmds, params, formato }
 *   formato: 'step' | 'brep' | 'both'
 *
 * Responde via postMessage:
 *   { id, ok: true,  step?: string, brep?: string, filename }
 *   { id, ok: false, error: string }
 */

import { initOpenCascade } from 'opencascade.js';

let oc = null;

async function ensureOCC() {
    if (oc) return;
    oc = await initOpenCascade();
}

// ---------------------------------------------------------------------------
// Helpers geométricos
// ---------------------------------------------------------------------------

/**
 * El perfil 2D usa (x = radio, y = altura).
 * Lo mapeamos al plano XZ de OCC → (x, 0, y).
 * La revolución es sobre Z, convención Z-up estándar de STEP/CAD.
 */
function makePnt(x, y) {
    return new oc.gp_Pnt_3(x, 0, y); // plano XZ: radio→X, altura→Z
}

function makeLineEdge(x1, y1, x2, y2) {
    const p1 = makePnt(x1, y1);
    const p2 = makePnt(x2, y2);
    return new oc.BRepBuilderAPI_MakeEdge_3(p1, p2).Edge();
}

/**
 * Construye un arco en el plano XZ como arista OCC.
 *
 * En el plano XZ (radio→X, altura→Z) la normal del círculo es el eje Y:
 *  ccw=true  → normal (0,-1,0) → CCW visto desde -Y (el frente del perfil)
 *  ccw=false → normal (0,+1,0) → CW
 *
 * MakeEdge_10 acepta (gp_Circ, startPnt, endPnt) y crea el arco en la
 * dirección positiva del círculo entre los dos puntos.
 */
function makeArcEdge(cx, cy, r, a0, a1, ccw) {
    const center = new oc.gp_Pnt_3(cx, 0, cy); // centro en plano XZ

    // Normal al plano XZ: -Y para CCW de perfil, +Y para CW
    const ny = ccw ? -1 : 1;
    const normal = new oc.gp_Dir_4(0, ny, 0);

    // gp_Ax2_3 = constructor(gp_Pnt, gp_Dir) — elige X automáticamente
    const ax2 = new oc.gp_Ax2_3(center, normal);

    // gp_Circ_2 = constructor(gp_Ax2, radius)
    const circ = new oc.gp_Circ_2(ax2, r);

    // Puntos inicio/fin del arco en el plano XZ
    const pStart = makePnt(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    const pEnd = makePnt(cx + r * Math.cos(a1), cy + r * Math.sin(a1));

    // BRepBuilderAPI_MakeEdge_10 = constructor(gp_Circ, gp_Pnt P1, gp_Pnt P2)
    return new oc.BRepBuilderAPI_MakeEdge_10(circ, pStart, pEnd).Edge();
}

// ---------------------------------------------------------------------------
// Construcción del wire desde descriptor
// ---------------------------------------------------------------------------

function buildWireFromCmds(cmds) {
    const wm = new oc.BRepBuilderAPI_MakeWire_1();

    let cx = 0,
        cy = 0; // posición actual (para calcular puntos de arco)

    for (const cmd of cmds) {
        if (cmd.type === 'moveTo') {
            cx = cmd.x;
            cy = cmd.y;
            continue;
        }
        if (cmd.type === 'lineTo') {
            if (Math.abs(cmd.x - cx) > 1e-10 || Math.abs(cmd.y - cy) > 1e-10) {
                const edge = makeLineEdge(cx, cy, cmd.x, cmd.y);
                wm.Add_1(edge);
            }
            cx = cmd.x;
            cy = cmd.y;
            continue;
        }
        if (cmd.type === 'arc') {
            const { cx: acx, cy: acy, r, a0, a1, ccw } = cmd;
            const edge = makeArcEdge(acx, acy, r, a0, a1, ccw);
            wm.Add_1(edge);
            cx = acx + r * Math.cos(a1);
            cy = acy + r * Math.sin(a1);
        }
    }

    if (!wm.IsDone()) {
        throw new Error('BRepBuilderAPI_MakeWire falló');
    }
    return wm.Wire();
}

// ---------------------------------------------------------------------------
// Revolución del perfil y exportación
// ---------------------------------------------------------------------------

function revolucionar(wire) {
    // Face plana desde el wire
    // BRepBuilderAPI_MakeFace_15 = constructor(TopoDS_Wire, OnlyPlane:bool)
    const fm = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    if (!fm.IsDone()) {
        throw new Error('BRepBuilderAPI_MakeFace falló');
    }
    const face = fm.Face();

    // Eje Z para la revolución: convención Z-up estándar en CAD/STEP.
    // El perfil se construye en el plano XZ (X = radio, Z = altura),
    // de modo que el sólido queda parado sobre el plano XY al exportar.
    const origin = new oc.gp_Pnt_3(0, 0, 0);
    const zDir = new oc.gp_Dir_4(0, 0, 1);
    const zAxis = new oc.gp_Ax1_2(origin, zDir);

    // BRepPrimAPI_MakeRevol_1 = constructor(TopoDS_Shape, gp_Ax1, angle, copy)
    const revol = new oc.BRepPrimAPI_MakeRevol_1(face, zAxis, 2 * Math.PI, false);
    revol.Build();
    if (!revol.IsDone()) {
        throw new Error('BRepPrimAPI_MakeRevol falló');
    }
    return revol.Shape();
}

function fsReaddirRoot() {
    try {
        return oc.FS.readdir('/').filter((name) => {
            if (typeof name !== 'string') return false;
            if (name === '.' || name === '..') return false;
            // Directorios base de Emscripten; nunca son el export recién creado.
            if (name === 'tmp' || name === 'home' || name === 'dev' || name === 'proc') return false;
            return name.length > 0 && name.length <= 220;
        });
    } catch (_) {
        return [];
    }
}

function fsDirSnapshot() {
    return new Set(fsReaddirRoot());
}

function fsNormalizePath(p) {
    const s = String(p || '').replace(/^\/+/, '');
    return s ? `/${s}` : '/';
}

/** OpenCascade suele escribir respecto al CWD del FS MEMFS (no siempre "/"). */
function fsEnsureCwdRoot() {
    try {
        if (typeof oc.FS.chdir === 'function') {
            oc.FS.chdir('/');
        }
    } catch (e) {
        console.warn('[OCC worker] fsEnsureCwdRoot:', e);
    }
}

function fsExists(absPath) {
    const p = fsNormalizePath(absPath);
    try {
        const a = oc.FS.analyzePath(p);
        if (a && Object.hasOwn(a, 'exists')) return a.exists;
    } catch (_) {
        /* seguir */
    }
    try {
        oc.FS.readFile(p);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * @param {Set<string>} before - readdir('/') antes del Write
 * @param {string} preferredRel - nombre relativo esperado (ej. tripta_job_3_s.step)
 * @param {boolean} binary
 * @returns {string|Uint8Array}
 */
function fsReadExported(before, preferredRel, binary) {
    fsEnsureCwdRoot();
    const abs = fsNormalizePath(preferredRel);
    const tryPaths = [abs];
    const after = fsReaddirRoot();
    const newFiles = after.filter((f) => !before.has(f));
    if (newFiles.length > 0) {
        newFiles.sort();
        for (const f of newFiles) {
            const n = fsNormalizePath(f);
            if (!tryPaths.includes(n)) tryPaths.push(n);
        }
    }

    let lastErr = null;
    for (const toRead of tryPaths) {
        try {
            if (!fsExists(toRead)) continue;
            const data = oc.FS.readFile(toRead);
            if (toRead !== abs) {
                fsTryUnlink(toRead);
            }
            if (binary) {
                return data instanceof Uint8Array ? data : new Uint8Array(data);
            }
            return typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data);
        } catch (e) {
            lastErr = e;
        }
    }

    throw new Error(
        `No se pudo leer el export (esperado ~${abs}). FS: [${after.join(', ') || 'vacío'}]. ` +
            (lastErr ? `Último error: ${lastErr.message ?? lastErr}` : ''),
    );
}

/** Evita restos en MEMFS entre exportaciones en lote. */
function fsTryUnlink(path) {
    try {
        oc.FS.unlink(fsNormalizePath(path));
    } catch (_) {
        /* ok */
    }
}

/**
 * Bug conocido de opencascade.js 1.x: el binding auto-generado para
 * Standard_CString (const char*) no siempre convierte el string JS correctamente,
 * resultando en punteros garbage pasados a C++.
 *
 * Solución: asignar manualmente el string en la memoria WASM usando las
 * utilidades de Emscripten (siempre disponibles en el módulo inicializado).
 *
 * callback(ptr) recibe el puntero C válido y debe devolver el resultado.
 * Si las utilidades no están disponibles, pasa el string JS directamente
 * (puede fallar para rutas de archivo).
 */
function withCString(str, callback) {
    // Las funciones de Emscripten pueden estar en el objeto oc directamente
    // o pueden haberse exportado en el scope global del módulo.
    const lengthFn = oc.lengthBytesUTF8?.bind(oc) ?? ((s) => new TextEncoder().encode(s).length);
    const toUTF8Fn = oc.stringToUTF8?.bind(oc);
    const mallocFn = oc._malloc?.bind(oc);
    const freeFn = oc._free?.bind(oc);

    if (toUTF8Fn && mallocFn && freeFn) {
        const bytes = lengthFn(str) + 1;
        const ptr = mallocFn(bytes);
        toUTF8Fn(str, ptr, bytes);
        try {
            return callback(ptr);
        } finally {
            freeFn(ptr);
        }
    }

    // Fallback: pasar string JS directamente (puede generar garbage en el filename)
    console.warn('[OCC worker] Emscripten string utils no disponibles, usando string JS directo');
    return callback(str);
}

function makeStepWriter() {
    try {
        return new oc.STEPControl_Writer_1();
    } catch (_) {
        /* seguir */
    }
    try {
        return new oc.STEPControl_Writer();
    } catch (_) {
        /* seguir */
    }
    try {
        return new oc.STEPControl_Writer_2();
    } catch (_) {
        /* seguir */
    }
    throw new Error('STEPControl_Writer no tiene constructor accesible en esta versión de opencascade.js');
}

/**
 * Transfer al writer STEP: en opencascade.js suele ser obligatoria la firma de 4 argumentos
 * (STEPControl_AsIs + compgraph + Message_ProgressRange); si no, Write() no crea archivo.
 * @returns {boolean}
 */
function transferShapeToStepWriter(writer, solid) {
    const newProgress = () => {
        try {
            return new oc.Message_ProgressRange_1();
        } catch (_) {
            try {
                return new oc.Message_ProgressRange();
            } catch (_) {
                return null;
            }
        }
    };

    const tryCall = (fn) => {
        try {
            fn();
            return true;
        } catch (_) {
            return false;
        }
    };

    const modes = [];
    const pushMode = (v) => {
        if (v !== undefined && v !== null && !modes.includes(v)) modes.push(v);
    };
    pushMode(oc.STEPControl_StepModelType?.STEPControl_AsIs);
    pushMode(oc.STEPControl_StepModelType?.STEPControl_ManifoldSolidBrep);
    pushMode(oc.STEPControl_AsIs);
    pushMode(1);
    pushMode(0);

    // 1) Variant numéricas que antes funcionaban con este binding
    const legacyFirst = [
        () => writer.Transfer_1(solid, 0, 1),
        () => writer.Transfer_1(solid, 0, true),
        () => writer.Transfer(solid, 0, 1),
        () => writer.Transfer(solid, 0, true),
        () => writer.Transfer_1(solid, 0),
        () => writer.Transfer(solid, 0),
    ];
    for (const fn of legacyFirst) {
        if (tryCall(fn)) return true;
    }

    // 2) 2-arg (shape + STEPControl_AsIs), típico en ejemplos antiguos
    for (const mode of modes) {
        if (tryCall(() => writer.Transfer(solid, mode))) {
            return true;
        }
    }

    // 3) 4-arg Transfer (recomendado en opencascade.js recientes)
    for (const mode of modes) {
        for (const cg of [true, false]) {
            const pr = newProgress();
            if (pr && tryCall(() => writer.Transfer(solid, mode, cg, pr))) {
                return true;
            }
        }
    }

    // 4) Sobrecargas numeradas Transfer_1 … Transfer_10
    for (let i = 1; i <= 10; i++) {
        const t = writer[`Transfer_${i}`];
        if (typeof t !== 'function') continue;
        for (const mode of modes) {
            for (const cg of [true, false]) {
                const pr = newProgress();
                if (pr && tryCall(() => t.call(writer, solid, mode, cg, pr))) {
                    return true;
                }
            }
            if (tryCall(() => t.call(writer, solid, mode))) {
                return true;
            }
        }
    }

    return false;
}

function exportStep(solid, relativeName) {
    fsEnsureCwdRoot();
    const rel = String(relativeName || '').replace(/^\/+/, '');
    const before = fsDirSnapshot();

    const writer = makeStepWriter();

    if (!transferShapeToStepWriter(writer, solid)) {
        throw new Error(
            'STEP Transfer: ninguna variante tuvo éxito (revisa STEPControl_AsIs / Message_ProgressRange en opencascade.js)',
        );
    }

    const writeAttempts = [
        () => withCString(rel, (ptr) => writer.Write(ptr)),
        () => withCString(rel, (ptr) => writer.Write_1(ptr)),
        () => writer.Write(rel),
        () => writer.Write_1(rel),
    ];
    // Importante: no fiarnos del código de retorno de Write (a menudo 0 o void);
    // además, en opencascade.js 1.x el filename puede acabar corrupto, así que
    // leemos el archivo nuevo creado en MEMFS aunque no se llame como esperábamos.
    let out = null;
    let lastWriteErr = null;
    for (const fn of writeAttempts) {
        try {
            fn();
            try {
                out = fsReadExported(before, rel, false);
                break;
            } catch (e) {
                lastWriteErr = e;
            }
        } catch (e) {
            lastWriteErr = e;
        }
    }
    if (out === null) {
        throw new Error(
            'STEP: OpenCascade no creó el archivo (Step File could not be created). ' +
                'Ningún intento de Write dejó un fichero legible en MEMFS. ' +
                (lastWriteErr ? `Último error: ${lastWriteErr.message ?? lastWriteErr}` : ''),
        );
    }

    fsTryUnlink(rel);
    return out;
}

function exportBrep(solid, relativeName) {
    fsEnsureCwdRoot();
    const rel = String(relativeName || '').replace(/^\/+/, '');
    const before = fsDirSnapshot();
    const abs = fsNormalizePath(rel);

    const fns = [
        () => withCString(rel, (ptr) => oc.BRepTools.Write_2(solid, ptr)),
        () => withCString(rel, (ptr) => oc.BRepTools.Write_1(solid, ptr)),
        () => withCString(rel, (ptr) => oc.BRepTools.Write(solid, ptr)),
        () => withCString(abs, (ptr) => oc.BRepTools.Write_2(solid, ptr)),
        () => oc.BRepTools.Write_2(solid, rel),
        () => oc.BRepTools.Write_2(solid, abs),
        () => oc.BRepTools.Write_1(solid, rel),
        () => oc.BRepTools.Write(solid, rel),
        () => {
            const bt = new oc.BRepTools();
            bt.Write_2(solid, rel);
        },
        () => {
            const bt = new oc.BRepTools();
            bt.Write_1(solid, rel);
        },
        () => {
            const bt = new oc.BRepTools();
            bt.Write(solid, rel);
        },
        () => {
            const bt = new oc.BRepTools_1();
            bt.Write_2(solid, rel);
        },
        () => {
            const bt = new oc.BRepTools_1();
            bt.Write_1(solid, rel);
        },
    ];
    let wrote = false;
    for (const fn of fns) {
        try {
            fn();
            wrote = true;
            break;
        } catch (_) {
            /* seguir */
        }
    }

    if (!wrote) {
        throw new Error('BRepTools.Write no disponible en esta versión de opencascade.js');
    }
    const out = fsReadExported(before, rel, true);
    fsTryUnlink(rel);
    return out;
}

// ---------------------------------------------------------------------------
// Handler de mensajes
// ---------------------------------------------------------------------------

self.onmessage = async (e) => {
    const { id, cmds, params: _params, tipo: _tipo, formato, baseName } = e.data;
    void _params;
    void _tipo;

    try {
        await ensureOCC();

        const wire = buildWireFromCmds(cmds);
        const solid = revolucionar(wire);

        const result = { id, ok: true };

        if (formato === 'step' || formato === 'both') {
            const stepFile = `tripta_job_${id}_s.step`;
            result.step = exportStep(solid, stepFile);
            result.stepFilename = `${baseName}.step`;
            console.log('[OCC worker] STEP generado, longitud:', result.step?.length ?? 0);
        }
        if (formato === 'brep' || formato === 'both') {
            const brepFile = `tripta_job_${id}_b.brep`;
            result.brep = exportBrep(solid, brepFile);
            result.brepFilename = `${baseName}.brep`;
            const brepLen = result.brep && typeof result.brep.length === 'number' ? result.brep.length : 0;
            console.log('[OCC worker] BREP generado, bytes:', brepLen);
        }

        // Verificar que el contenido no esté vacío antes de enviar
        if (formato !== 'brep' && (!result.step || result.step.length === 0)) {
            throw new Error(
                'El archivo STEP exportado está vacío. Puede que el filename no se pasó correctamente a OCC.',
            );
        }
        if (formato !== 'step') {
            const blen =
                result.brep && typeof result.brep.byteLength === 'number'
                    ? result.brep.byteLength
                    : result.brep?.length || 0;
            if (!result.brep || blen === 0) {
                throw new Error('El archivo BREP exportado está vacío.');
            }
        }

        self.postMessage(result);
    } catch (err) {
        // Asegurar que el error es un string plano y serializable (los objetos de
        // Emscripten a veces no son serializables y rompen postMessage silenciosamente)
        let errorMsg;
        try {
            errorMsg = String(err?.message ?? err);
        } catch (_) {
            errorMsg = 'Error desconocido en worker OCC';
        }
        console.error('[OCC worker] Error:', errorMsg);
        try {
            self.postMessage({ id, ok: false, error: errorMsg });
        } catch (_) {
            self.postMessage({ id, ok: false, error: 'Error interno del worker (no serializable)' });
        }
    }
};
