/**
 * Web Worker OCC — runs in a separate thread to avoid blocking the UI.
 *
 * Constructor convention in opencascade.js:
 *   new oc.ClassName_N(args) where N is the overload position in the C++ header
 *   (1 = default/no args, then _2, _3, … in order of appearance in .hxx)
 *
 * Receives via postMessage:
 *   { id, tipo, cmds, params, formato }
 *   formato: 'step' | 'brep' | 'both'
 *
 * Responds via postMessage:
 *   { id, ok: true,  step?: string, brep?: string, filename }
 *   { id, ok: false, error: string }
 */

import { initOpenCascade } from 'opencascade.js';
import type { ProfileCommand } from './profileDescriptor.js';

// opencascade.js types are too dynamic to type strictly — use `any` here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oc: any = null;

async function ensureOCC(): Promise<void> {
    if (oc) return;
    oc = await initOpenCascade();
}

// ── Geometry helpers ────────────────────────────────────

/** The 2D profile uses (x = radius, y = height). We map it to OCC's XZ plane → (x, 0, y). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePnt(x: number, y: number): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return new oc.gp_Pnt_3(x, 0, y);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeLineEdge(x1: number, y1: number, x2: number, y2: number): any {
    const p1 = makePnt(x1, y1);
    const p2 = makePnt(x2, y2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return new oc.BRepBuilderAPI_MakeEdge_3(p1, p2).Edge();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeArcEdge(cx: number, cy: number, r: number, a0: number, a1: number, ccw: boolean): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const center = new oc.gp_Pnt_3(cx, 0, cy);
    const ny = ccw ? -1 : 1;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const normal = new oc.gp_Dir_4(0, ny, 0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const ax2 = new oc.gp_Ax2_3(center, normal);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const circ = new oc.gp_Circ_2(ax2, r);
    const pStart = makePnt(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    const pEnd = makePnt(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return new oc.BRepBuilderAPI_MakeEdge_10(circ, pStart, pEnd).Edge();
}

// ── Wire construction ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWireFromCmds(cmds: ProfileCommand[]): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const wm = new oc.BRepBuilderAPI_MakeWire_1();
    let cx = 0;
    let cy = 0;

    for (const cmd of cmds) {
        if (cmd.type === 'moveTo') {
            cx = cmd.x;
            cy = cmd.y;
            continue;
        }
        if (cmd.type === 'lineTo') {
            if (Math.abs(cmd.x - cx) > 1e-10 || Math.abs(cmd.y - cy) > 1e-10) {
                const edge = makeLineEdge(cx, cy, cmd.x, cmd.y);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                wm.Add_1(edge);
            }
            cx = cmd.x;
            cy = cmd.y;
            continue;
        }
        if (cmd.type === 'arc') {
            const { cx: acx, cy: acy, r, a0, a1, ccw } = cmd;
            const edge = makeArcEdge(acx, acy, r, a0, a1, ccw);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            wm.Add_1(edge);
            cx = acx + r * Math.cos(a1);
            cy = acy + r * Math.sin(a1);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!wm.IsDone()) {
        throw new Error('BRepBuilderAPI_MakeWire failed');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return wm.Wire();
}

// ── Revolution & export ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function revolucionar(wire: any): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const fm = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!fm.IsDone()) {
        throw new Error('BRepBuilderAPI_MakeFace failed');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const face = fm.Face();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const origin = new oc.gp_Pnt_3(0, 0, 0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const zDir = new oc.gp_Dir_4(0, 0, 1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const zAxis = new oc.gp_Ax1_2(origin, zDir);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const revol = new oc.BRepPrimAPI_MakeRevol_1(face, zAxis, 2 * Math.PI, false);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    revol.Build();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!revol.IsDone()) {
        throw new Error('BRepPrimAPI_MakeRevol failed');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return revol.Shape();
}

function fsReaddirRoot(): string[] {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return (oc.FS.readdir('/') as string[]).filter((name) => {
            if (typeof name !== 'string') return false;
            if (name === '.' || name === '..') return false;
            if (name === 'tmp' || name === 'home' || name === 'dev' || name === 'proc') return false;
            return name.length > 0 && name.length <= 220;
        });
    } catch (_) {
        return [];
    }
}

function fsDirSnapshot(): Set<string> {
    return new Set(fsReaddirRoot());
}

function fsNormalizePath(p: string): string {
    const s = String(p || '').replace(/^\/+/, '');
    return s ? `/${s}` : '/';
}

function fsEnsureCwdRoot(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (typeof oc.FS.chdir === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            oc.FS.chdir('/');
        }
    } catch (e) {
        console.warn('[OCC worker] fsEnsureCwdRoot:', e);
    }
}

function fsExists(absPath: string): boolean {
    const p = fsNormalizePath(absPath);
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const a = oc.FS.analyzePath(p);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        if (a && Object.hasOwn(a, 'exists')) return a.exists as boolean;
    } catch (_) {
        /* continue */
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        oc.FS.readFile(p);
        return true;
    } catch (_) {
        return false;
    }
}

function fsReadExported(before: Set<string>, preferredRel: string, binary: boolean): string | Uint8Array {
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

    let lastErr: unknown = null;
    for (const toRead of tryPaths) {
        try {
            if (!fsExists(toRead)) continue;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const data: string | Uint8Array = oc.FS.readFile(toRead);
            if (toRead !== abs) {
                fsTryUnlink(toRead);
            }
            if (binary) {
                return data instanceof Uint8Array ? data : new Uint8Array(new TextEncoder().encode(data));
            }
            return typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data);
        } catch (e) {
            lastErr = e;
        }
    }

    throw new Error(
        `Could not read export (expected ~${abs}). FS: [${after.join(', ') || 'empty'}]. ` +
            (lastErr ? `Last error: ${(lastErr as Error).message ?? String(lastErr)}` : ''),
    );
}

function fsTryUnlink(path: string): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        oc.FS.unlink(fsNormalizePath(path));
    } catch (_) {
        /* ok */
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withCString(str: string, callback: (ptr: any) => any): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const lengthFn: (s: string) => number =
        oc.lengthBytesUTF8?.bind(oc) ?? ((s: string) => new TextEncoder().encode(s).length);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const toUTF8Fn: ((s: string, p: unknown, b: number) => void) | undefined = oc.stringToUTF8?.bind(oc);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const mallocFn: ((b: number) => number) | undefined = oc._malloc?.bind(oc);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const freeFn: ((p: number) => void) | undefined = oc._free?.bind(oc);

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

    console.warn('[OCC worker] Emscripten string utils not available, using raw JS string');
    return callback(str);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeStepWriter(): any {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return new oc.STEPControl_Writer_1();
    } catch (_) {
        /* try alternatives */
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return new oc.STEPControl_Writer();
    } catch (_) {
        /* try alternatives */
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return new oc.STEPControl_Writer_2();
    } catch (_) {
        /* try alternatives */
    }
    throw new Error('STEPControl_Writer has no accessible constructor in this version of opencascade.js');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transferShapeToStepWriter(writer: any, solid: any): boolean {
    const newProgress = () => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            return new oc.Message_ProgressRange_1();
        } catch (_) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                return new oc.Message_ProgressRange();
            } catch (_) {
                return null;
            }
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tryCall = (fn: () => any): boolean => {
        try {
            fn();
            return true;
        } catch (_) {
            return false;
        }
    };

    const modes: (string | number)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const pushMode = (v: unknown) => {
        if (v !== undefined && v !== null && !modes.includes(v as string | number)) modes.push(v as string | number);
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pushMode(oc.STEPControl_StepModelType?.STEPControl_AsIs);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pushMode(oc.STEPControl_StepModelType?.STEPControl_ManifoldSolidBrep);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    pushMode(oc.STEPControl_AsIs);
    pushMode(1);
    pushMode(0);

    // 1) Legacy numerical variants
    const legacyFirst = [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer_1(solid, 0, 1),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer_1(solid, 0, true),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer(solid, 0, 1),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer(solid, 0, true),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer_1(solid, 0),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        () => writer.Transfer(solid, 0),
    ];
    for (const fn of legacyFirst) {
        if (tryCall(fn)) return true;
    }

    // 2) 2-arg (shape + mode)
    for (const mode of modes) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        if (tryCall(() => writer.Transfer(solid, mode))) return true;
    }

    // 3) 4-arg Transfer (recommended in recent opencascade.js)
    for (const mode of modes) {
        for (const cg of [true, false]) {
            const pr = newProgress();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            if (pr && tryCall(() => writer.Transfer(solid, mode, cg, pr))) return true;
        }
    }

    // 4) Numbered overloads Transfer_1 … Transfer_10
    for (let i = 1; i <= 10; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const t = writer[`Transfer_${i}`];
        if (typeof t !== 'function') continue;
        for (const mode of modes) {
            for (const cg of [true, false]) {
                const pr = newProgress();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                if (pr && tryCall(() => (t as (...args: never) => unknown).call(writer, solid, mode, cg, pr)))
                    return true;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            if (tryCall(() => (t as (...args: never) => unknown).call(writer, solid, mode))) return true;
        }
    }

    return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportStep(solid: any, relativeName: string): string {
    fsEnsureCwdRoot();
    const rel = String(relativeName || '').replace(/^\/+/, '');
    const before = fsDirSnapshot();

    const writer = makeStepWriter();
    if (!transferShapeToStepWriter(writer, solid)) {
        throw new Error(
            'STEP Transfer: no variant succeeded (check STEPControl_AsIs / Message_ProgressRange in opencascade.js)',
        );
    }

    const writeAttempts = [
        () => withCString(rel, (ptr: unknown) => writer.Write(ptr)),
        () => withCString(rel, (ptr: unknown) => writer.Write_1(ptr)),
        () => writer.Write(rel),
        () => writer.Write_1(rel),
    ];
    let out: string | null = null;
    let lastWriteErr: unknown = null;
    for (const fn of writeAttempts) {
        try {
            fn();
            try {
                out = fsReadExported(before, rel, false) as string;
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
            'STEP: OpenCascade did not create the file (Step File could not be created). ' +
                (lastWriteErr ? `Last error: ${(lastWriteErr as Error).message ?? String(lastWriteErr)}` : ''),
        );
    }

    fsTryUnlink(rel);
    return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportBrep(solid: any, relativeName: string): Uint8Array {
    fsEnsureCwdRoot();
    const rel = String(relativeName || '').replace(/^\/+/, '');
    const before = fsDirSnapshot();
    const abs = fsNormalizePath(rel);

    type WriteFn = () => void;
    const fns: WriteFn[] = [
        () => withCString(rel, (ptr: unknown) => oc.BRepTools.Write_2(solid, ptr)),
        () => withCString(rel, (ptr: unknown) => oc.BRepTools.Write_1(solid, ptr)),
        () => withCString(rel, (ptr: unknown) => oc.BRepTools.Write(solid, ptr)),
        () => withCString(abs, (ptr: unknown) => oc.BRepTools.Write_2(solid, ptr)),
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
            /* try next */
        }
    }

    if (!wrote) {
        throw new Error('BRepTools.Write not available in this version of opencascade.js');
    }
    const out = fsReadExported(before, rel, true);
    if (typeof out === 'string') throw new Error('Expected Uint8Array for BREP export but got string');
    fsTryUnlink(rel);
    return out;
}

// ── Message handler ─────────────────────────────────────

interface WorkerMessage {
    id: number;
    cmds: ProfileCommand[];
    params: Record<string, number>;
    tipo: string;
    formato: 'step' | 'brep' | 'both';
    baseName: string;
}

interface WorkerResult {
    id: number;
    ok: boolean;
    error?: string;
    step?: string;
    stepFilename?: string;
    brep?: Uint8Array;
    brepFilename?: string;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { id, cmds, formato, baseName } = e.data;

    try {
        await ensureOCC();

        const wire = buildWireFromCmds(cmds);
        const solid = revolucionar(wire);

        const result: WorkerResult = { id, ok: true };

        if (formato === 'step' || formato === 'both') {
            const stepFile = `tripta_job_${id}_s.step`;
            result.step = exportStep(solid, stepFile);
            result.stepFilename = `${baseName}.step`;
            console.log('[OCC worker] STEP generated, length:', result.step?.length ?? 0);
        }
        if (formato === 'brep' || formato === 'both') {
            const brepFile = `tripta_job_${id}_b.brep`;
            result.brep = exportBrep(solid, brepFile);
            result.brepFilename = `${baseName}.brep`;
            const brepLen = result.brep?.length ?? 0;
            console.log('[OCC worker] BREP generated, bytes:', brepLen);
        }

        // Verify content is not empty before sending
        if (formato !== 'brep' && (!result.step || result.step.length === 0)) {
            throw new Error('Exported STEP file is empty. The filename may not have been passed correctly to OCC.');
        }
        if (formato !== 'step') {
            const blen = result.brep?.length ?? 0;
            if (!result.brep || blen === 0) {
                throw new Error('Exported BREP file is empty.');
            }
        }

        self.postMessage(result);
    } catch (err) {
        let errorMsg: string;
        try {
            errorMsg = String((err as Error)?.message ?? err);
        } catch (_) {
            errorMsg = 'Unknown error in OCC worker';
        }
        console.error('[OCC worker] Error:', errorMsg);
        try {
            self.postMessage({ id, ok: false, error: errorMsg });
        } catch (_) {
            self.postMessage({ id, ok: false, error: 'Internal worker error (non-serializable)' });
        }
    }
};
