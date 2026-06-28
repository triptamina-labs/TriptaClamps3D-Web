import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkWorkerPostMessage, mkWorkerTerminate, mkObtenerPerfil } = vi.hoisted(() => ({
    mkWorkerPostMessage: vi.fn(),
    mkWorkerTerminate: vi.fn(),
    mkObtenerPerfil: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
}));

const mkStep = 'STEP DATA';
const mkBrep = new Uint8Array([0x42, 0x52, 0x45, 0x50]);

let onmessageHandler: ((e: MessageEvent) => void) | null = null;
let onerrorHandler: ((e: ErrorEvent) => void) | null = null;

function FakeWorker() {
    this.postMessage = mkWorkerPostMessage;
    this.terminate = mkWorkerTerminate;
    Object.defineProperty(this, 'onmessage', {
        set(fn: (e: MessageEvent) => void) {
            onmessageHandler = fn;
        },
        get() {
            return onmessageHandler;
        },
    });
    Object.defineProperty(this, 'onerror', {
        set(fn: (e: ErrorEvent) => void) {
            onerrorHandler = fn;
        },
        get() {
            return onerrorHandler;
        },
    });
}

vi.stubGlobal('Worker', FakeWorker);
globalThis.Worker = FakeWorker as unknown as typeof Worker;

vi.mock('../profileDescriptor.js', () => ({
    obtenerPerfil: mkObtenerPerfil,
}));

import { exportarCADBlob, resetOccWorker } from '../bridge.js';
import type { FerruleParams } from '../profileDescriptor.js';

const params: FerruleParams = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
    tubeHeight: 28.6,
    ferrHeight: 2.0,
};

beforeEach(() => {
    resetOccWorker();
    onmessageHandler = null;
    onerrorHandler = null;
    mkWorkerPostMessage.mockClear();
    mkWorkerTerminate.mockClear();
    mkObtenerPerfil.mockClear();
    mkObtenerPerfil.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('resetOccWorker', () => {
    it('terminates the worker and clears callbacks', () => {
        exportarCADBlob('ferrula', params, 'step');
        resetOccWorker();
        expect(mkWorkerTerminate).toHaveBeenCalled();
    });
});

describe('exportarCADBlob', () => {
    it('calls obtenerPerfil with tipo and params', () => {
        exportarCADBlob('ferrula', params, 'step');
        expect(mkObtenerPerfil).toHaveBeenCalledWith('ferrula', params);
    });

    it('posts a message with id, tipo, cmds, params, formato, baseName', () => {
        exportarCADBlob('gasket', params, 'step');
        expect(mkWorkerPostMessage).toHaveBeenCalled();
        const posted = mkWorkerPostMessage.mock.calls[0][0];
        expect(posted.id).toBeGreaterThan(0);
        expect(posted.tipo).toBe('gasket');
        expect(posted.formato).toBe('step');
        expect(posted.baseName).toBe('bulk');
    });

    it('resolves with step Blob on worker success', { timeout: 10000 }, async () => {
        const promise = exportarCADBlob('ferrula', params, 'step');
        const msgId = mkWorkerPostMessage.mock.calls[0][0].id;
        onmessageHandler!({ data: { id: msgId, ok: true, step: mkStep, stepFilename: 'test.step' } } as MessageEvent);
        const result = await promise;
        expect(result.step).toBeInstanceOf(Blob);
    });

    it('resolves with brep Blob on worker success', { timeout: 10000 }, async () => {
        const promise = exportarCADBlob('ferrula', params, 'brep');
        const msgId = mkWorkerPostMessage.mock.calls[0][0].id;
        onmessageHandler!({
            data: { id: msgId, ok: true, brep: mkBrep, brepFilename: 'test.brep' },
        } as unknown as MessageEvent);
        const result = await promise;
        expect(result.brep).toBeInstanceOf(Blob);
    });

    it('rejects when worker responds with ok=false', { timeout: 10000 }, async () => {
        const promise = exportarCADBlob('ferrula', params, 'step');
        const msgId = mkWorkerPostMessage.mock.calls[0][0].id;
        onmessageHandler!({ data: { id: msgId, ok: false, error: 'OCC failed' } } as MessageEvent);
        await expect(promise).rejects.toThrow('OCC failed');
    });

    it('rejects when worker fires onerror', async () => {
        const promise = exportarCADBlob('ferrula', params, 'step');
        onerrorHandler!({ message: 'Worker crashed' } as ErrorEvent);
        await expect(promise).rejects.toThrow('Worker crashed');
    });
});
