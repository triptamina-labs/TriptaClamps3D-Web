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
    return new oc.gp_Pnt_3(x, 0, y);   // plano XZ: radio→X, altura→Z
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
    const center = new oc.gp_Pnt_3(cx, 0, cy);  // centro en plano XZ

    // Normal al plano XZ: -Y para CCW de perfil, +Y para CW
    const ny = ccw ? -1 : 1;
    const normal = new oc.gp_Dir_4(0, ny, 0);

    // gp_Ax2_3 = constructor(gp_Pnt, gp_Dir) — elige X automáticamente
    const ax2 = new oc.gp_Ax2_3(center, normal);

    // gp_Circ_2 = constructor(gp_Ax2, radius)
    const circ = new oc.gp_Circ_2(ax2, r);

    // Puntos inicio/fin del arco en el plano XZ
    const pStart = makePnt(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    const pEnd   = makePnt(cx + r * Math.cos(a1), cy + r * Math.sin(a1));

    // BRepBuilderAPI_MakeEdge_10 = constructor(gp_Circ, gp_Pnt P1, gp_Pnt P2)
    return new oc.BRepBuilderAPI_MakeEdge_10(circ, pStart, pEnd).Edge();
}

// ---------------------------------------------------------------------------
// Construcción del wire desde descriptor
// ---------------------------------------------------------------------------

function buildWireFromCmds(cmds) {
    const wm = new oc.BRepBuilderAPI_MakeWire_1();

    let cx = 0, cy = 0; // posición actual (para calcular puntos de arco)

    for (const cmd of cmds) {
        if (cmd.type === 'moveTo') {
            cx = cmd.x; cy = cmd.y;
            continue;
        }
        if (cmd.type === 'lineTo') {
            if (Math.abs(cmd.x - cx) > 1e-10 || Math.abs(cmd.y - cy) > 1e-10) {
                const edge = makeLineEdge(cx, cy, cmd.x, cmd.y);
                wm.Add_1(edge);
            }
            cx = cmd.x; cy = cmd.y;
            continue;
        }
        if (cmd.type === 'arc') {
            const { cx: acx, cy: acy, r, a0, a1, ccw } = cmd;
            const edge = makeArcEdge(acx, acy, r, a0, a1, ccw);
            wm.Add_1(edge);
            cx = acx + r * Math.cos(a1);
            cy = acy + r * Math.sin(a1);
            continue;
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
    const zDir   = new oc.gp_Dir_4(0, 0, 1);
    const zAxis  = new oc.gp_Ax1_2(origin, zDir);

    // BRepPrimAPI_MakeRevol_1 = constructor(TopoDS_Shape, gp_Ax1, angle, copy)
    const revol = new oc.BRepPrimAPI_MakeRevol_1(face, zAxis, 2 * Math.PI, false);
    revol.Build();
    if (!revol.IsDone()) {
        throw new Error('BRepPrimAPI_MakeRevol falló');
    }
    return revol.Shape();
}

/**
 * Toma un snapshot de los nombres de archivo en la raíz del FS de Emscripten.
 * Se usa para detectar qué archivo nuevo creó OCC después de un Write.
 */
function fsDirSnapshot() {
    try { return new Set(oc.FS.readdir('/')); } catch (_) { return new Set(); }
}

/**
 * Busca archivos nuevos en el FS comparando con un snapshot anterior,
 * y devuelve el contenido del primero que encuentre (el que OCC acaba de escribir).
 * Si no hay archivos nuevos, intenta leer `fallbackName`.
 */
function fsReadNewest(before, fallbackName) {
    let after = [];
    try { after = oc.FS.readdir('/'); } catch (_) {}
    console.log('[OCC worker] FS antes:', [...before], '| después:', after);

    const newFiles = after.filter(f => !before.has(f) && f !== '.' && f !== '..');
    console.log('[OCC worker] Archivos nuevos:', newFiles);

    const toRead = newFiles.length > 0 ? '/' + newFiles[0] : fallbackName;
    try {
        return oc.FS.readFile(toRead, { encoding: 'utf8' });
    } catch (_) {
        const bytes = oc.FS.readFile(toRead);
        return new TextDecoder().decode(bytes);
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
    const lengthFn  = oc.lengthBytesUTF8?.bind(oc) ?? (s => new TextEncoder().encode(s).length);
    const toUTF8Fn  = oc.stringToUTF8?.bind(oc);
    const mallocFn  = oc._malloc?.bind(oc);
    const freeFn    = oc._free?.bind(oc);

    if (toUTF8Fn && mallocFn && freeFn) {
        const bytes = lengthFn(str) + 1;
        const ptr   = mallocFn(bytes);
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
    const ctors = [
        () => new oc.STEPControl_Writer(),
        () => new oc.STEPControl_Writer_1(),
        () => new oc.STEPControl_Writer_2(),
    ];
    for (const ctor of ctors) {
        try { return ctor(); } catch (_) { /* seguir */ }
    }
    throw new Error('STEPControl_Writer no tiene constructor accesible en esta versión de opencascade.js');
}

function exportStep(solid, name) {
    // Snapshot ANTES para detectar qué archivo crea OCC (el filename puede
    // llegar corrupto al C++ por el bug de Standard_CString en opencascade.js 1.x)
    const before = fsDirSnapshot();

    const writer = makeStepWriter();

    // Transfer: probar combinaciones de enumerado y booleano
    const transfers = [
        () => writer.Transfer_1(solid, 0, 1),
        () => writer.Transfer_1(solid, 0, true),
        () => writer.Transfer(solid, 0, 1),
        () => writer.Transfer(solid, 0, true),
        () => writer.Transfer_1(solid, 0),
        () => writer.Transfer(solid, 0),
    ];
    for (const fn of transfers) {
        try { fn(); break; } catch (_) { /* seguir */ }
    }

    // Write — intentar con puntero C explícito Y con string JS directo como fallback
    const writeAttempts = [
        () => withCString(name, ptr => writer.Write(ptr)),
        () => withCString(name, ptr => writer.Write_1(ptr)),
        () => writer.Write(name),
        () => writer.Write_1(name),
    ];
    for (const fn of writeAttempts) {
        try { fn(); break; } catch (_) { /* seguir */ }
    }

    // Leer el archivo que OCC haya creado realmente (sea cual sea su ruta)
    return fsReadNewest(before, name);
}

function exportBrep(solid, name) {
    const before = fsDirSnapshot();

    // BRepTools::Write estático — puede estar expuesto como función de clase
    // o como método de instancia según la versión del binding.
    const fns = [
        () => withCString(name, ptr => oc.BRepTools.Write_2(solid, ptr)),
        () => withCString(name, ptr => oc.BRepTools.Write_1(solid, ptr)),
        () => withCString(name, ptr => oc.BRepTools.Write(solid, ptr)),
        () => oc.BRepTools.Write_2(solid, name),
        () => oc.BRepTools.Write_1(solid, name),
        () => oc.BRepTools.Write(solid, name),
        () => { const bt = new oc.BRepTools();   bt.Write_2(solid, name); },
        () => { const bt = new oc.BRepTools();   bt.Write_1(solid, name); },
        () => { const bt = new oc.BRepTools();   bt.Write(solid, name);   },
        () => { const bt = new oc.BRepTools_1(); bt.Write_2(solid, name); },
        () => { const bt = new oc.BRepTools_1(); bt.Write_1(solid, name); },
    ];
    let wrote = false;
    for (const fn of fns) {
        try { fn(); wrote = true; break; } catch (_) { /* seguir */ }
    }

    if (!wrote) {
        throw new Error('BRepTools.Write no disponible en esta versión de opencascade.js');
    }
    return fsReadNewest(before, name);
}

// ---------------------------------------------------------------------------
// Handler de mensajes
// ---------------------------------------------------------------------------

self.onmessage = async (e) => {
    const { id, cmds, params, tipo, formato, baseName } = e.data;

    try {
        await ensureOCC();

        const wire  = buildWireFromCmds(cmds);
        const solid = revolucionar(wire);

        const result = { id, ok: true };

        if (formato === 'step' || formato === 'both') {
            result.step         = exportStep(solid, 'tripta_out.step');
            result.stepFilename = baseName + '.step';
            console.log('[OCC worker] STEP generado, longitud:', result.step?.length ?? 0);
        }
        if (formato === 'brep' || formato === 'both') {
            result.brep         = exportBrep(solid, 'tripta_out.brep');
            result.brepFilename = baseName + '.brep';
            console.log('[OCC worker] BREP generado, longitud:', result.brep?.length ?? 0);
        }

        // Verificar que el contenido no esté vacío antes de enviar
        if (formato !== 'brep' && (!result.step || result.step.length === 0)) {
            throw new Error('El archivo STEP exportado está vacío. Puede que el filename no se pasó correctamente a OCC.');
        }
        if (formato !== 'step' && (!result.brep || result.brep.length === 0)) {
            throw new Error('El archivo BREP exportado está vacío.');
        }

        self.postMessage(result);
    } catch (err) {
        // Asegurar que el error es un string plano y serializable (los objetos de
        // Emscripten a veces no son serializables y rompen postMessage silenciosamente)
        let errorMsg;
        try { errorMsg = String(err?.message ?? err); } catch (_) { errorMsg = 'Error desconocido en worker OCC'; }
        console.error('[OCC worker] Error:', errorMsg);
        try {
            self.postMessage({ id, ok: false, error: errorMsg });
        } catch (_) {
            self.postMessage({ id, ok: false, error: 'Error interno del worker (no serializable)' });
        }
    }
};
