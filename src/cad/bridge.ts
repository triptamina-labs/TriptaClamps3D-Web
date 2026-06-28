import type { CadFormat, PieceType } from '../data/store.js';
import { descargarArchivo, getExportBaseName } from '../export/exporter.js';
import type { ProfileCommand, ProfileParams } from './profileDescriptor.js';
import { obtenerPerfil } from './profileDescriptor.js';

interface CadCallback {
    resolve: (value: CadResult) => void;
    reject: (reason: Error) => void;
}

interface CadResult {
    step?: Blob;
    brep?: Blob;
}

interface WorkerResponse {
    id: number;
    ok: boolean;
    error?: string;
    step?: string;
    stepFilename?: string;
    brep?: string;
    brepFilename?: string;
}

let worker: Worker | null = null;
let msgId = 0;
const pendingCallbacks = new Map<number, CadCallback>();

/**
 * Terminate the OCC worker and clear pending callbacks.
 * Useful after many bulk exports (MEMFS / heap may corrupt) or error recovery.
 */
export function resetOccWorker(): void {
    if (worker) {
        try {
            worker.terminate();
        } catch (_) {
            /* ok */
        }
        worker = null;
    }
    pendingCallbacks.clear();
}

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, ok, error, step, stepFilename, brep, brepFilename } = e.data;
        const callbacks = pendingCallbacks.get(id);
        if (!callbacks) return;
        pendingCallbacks.delete(id);
        if (ok) {
            callbacks.resolve({ step, stepFilename, brep, brepFilename } as unknown as CadResult);
        } else {
            callbacks.reject(new Error(error));
        }
    };
    worker.onerror = (e: ErrorEvent) => {
        const err = new Error(e.message ?? 'Error en el worker OCC');
        pendingCallbacks.forEach((cb) => {
            cb.reject(err);
        });
        pendingCallbacks.clear();
        worker = null;
    };
    return worker;
}

interface PostMessageData {
    id: number;
    tipo: PieceType;
    cmds: ProfileCommand[];
    params: ProfileParams;
    formato: CadFormat;
    baseName: string;
}

/**
 * Export the current piece to STEP and/or BREP via the OCC worker.
 * Returns an object with optional `step` and `brep` Blobs.
 */
export async function exportarCADBlob(tipo: PieceType, params: ProfileParams, formato: CadFormat): Promise<CadResult> {
    const cmds = obtenerPerfil(tipo, params);
    const id = ++msgId;
    const w = getWorker();

    return new Promise<CadResult>((resolve, reject) => {
        pendingCallbacks.set(id, { resolve, reject });
        const message: PostMessageData = { id, tipo, cmds, params, formato, baseName: 'bulk' };
        w.postMessage(message);
    }).then(({ step, brep }) => {
        const out: CadResult = {};
        if (step) {
            out.step = new Blob([step], { type: 'application/step' });
        }
        if (brep) {
            out.brep = new Blob([brep], { type: 'application/octet-stream' });
        }
        return out;
    });
}

/**
 * Export the current model as STEP and/or BREP, triggering a file download.
 */
export async function exportarCAD(tipo: PieceType, params: ProfileParams, formato: CadFormat): Promise<void> {
    const { step, brep } = await exportarCADBlob(tipo, params, formato);
    const baseName = getExportBaseName();
    if (step) {
        descargarArchivo(`${baseName}.step`, step);
    }
    if (brep) {
        descargarArchivo(`${baseName}.brep`, brep);
    }
}
