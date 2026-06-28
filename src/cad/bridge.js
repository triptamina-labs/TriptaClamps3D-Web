/**
 * Bridge OCC — hilo principal.
 *
 * Gestiona el ciclo de vida del Web Worker de forma lazy:
 * el Worker (y su WASM de ~65 MB) se instancia solo en el primer
 * click de exportación CAD y se reutiliza en siguientes llamadas.
 */

import { descargarArchivo, getExportBaseName } from '../export/exporter.js';
import { obtenerPerfil } from './profileDescriptor.js';

let worker = null;
let msgId = 0;
const pendingCallbacks = new Map();

/**
 * Termina el worker OCC y limpia colas. Útil tras muchas exportaciones
 * en lote (MEMFS / heap pueden corromperse) o para recuperar de error.
 */
export function resetOccWorker() {
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

function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
        const { id, ok, error, step, stepFilename, brep, brepFilename } = e.data;
        const callbacks = pendingCallbacks.get(id);
        if (!callbacks) return;
        pendingCallbacks.delete(id);
        if (ok) {
            callbacks.resolve({ step, stepFilename, brep, brepFilename });
        } else {
            callbacks.reject(new Error(error));
        }
    };
    worker.onerror = (e) => {
        const err = new Error(e.message ?? 'Error en el worker OCC');
        pendingCallbacks.forEach((cb) => {
            cb.reject(err);
        });
        pendingCallbacks.clear();
        worker = null;
    };
    return worker;
}

export async function exportarCADBlob(tipo, params, formato) {
    const cmds = obtenerPerfil(tipo, params);
    const id = ++msgId;
    const w = getWorker();

    return new Promise((resolve, reject) => {
        pendingCallbacks.set(id, { resolve, reject });
        w.postMessage({ id, tipo, cmds, params, formato, baseName: 'bulk' });
    }).then(({ step, brep }) => {
        const out = {};
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
 * Exporta el modelo actual como STEP y/o BREP usando OpenCascade.
 *
 * @param {'ferrula'|'gasket'|'spool'|'endcap'} tipo
 * @param {object} params — mismos params que usa renderPiece
 * @param {'step'|'brep'|'both'} formato
 * @returns {Promise<void>}
 */
export async function exportarCAD(tipo, params, formato) {
    const { step, brep } = await exportarCADBlob(tipo, params, formato);
    const baseName = getExportBaseName();
    if (step) {
        descargarArchivo(`${baseName}.step`, step);
    }
    if (brep) {
        descargarArchivo(`${baseName}.brep`, brep);
    }
}
