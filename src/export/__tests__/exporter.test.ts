import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
    const mkEuler = () => ({ set: vi.fn() });
    const mkClass = (name: string) =>
        function (this: Record<string, unknown>) {
            Object.defineProperty(this, 'constructor', { value: { name }, writable: true });
            this.rotation = mkEuler();
            this.updateMatrixWorld = vi.fn();
        };
    return {
        Mesh: mkClass('Mesh'),
        MeshStandardMaterial: mkClass('MeshStandardMaterial'),
    };
});

const { mkStlParse, mkObjParse } = vi.hoisted(() => ({
    mkStlParse: vi.fn(),
    mkObjParse: vi.fn(),
}));

function FakeSTLExporter(this: { parse: ReturnType<typeof vi.fn> }) {
    this.parse = mkStlParse;
}

function FakeOBJExporter(this: { parse: ReturnType<typeof vi.fn> }) {
    this.parse = mkObjParse;
}

vi.mock('three/addons/exporters/STLExporter.js', () => ({
    STLExporter: FakeSTLExporter,
}));

vi.mock('three/addons/exporters/OBJExporter.js', () => ({
    OBJExporter: FakeOBJExporter,
}));

vi.mock('../../scene/materials.js', () => ({
    matSolido: {},
}));

import type { MeshExportFormat } from '../exporter.js';
import { exportGeometryBuffer } from '../exporter.js';

const fakeGeometry = {
    attributes: {},
    index: null,
} as unknown as THREE.BufferGeometry;

function makeTestData(size: number): Uint8Array {
    const buf = new Uint8Array(size);
    buf[0] = 0xde;
    return buf;
}

describe('exportGeometryBuffer', () => {
    it('returns { ext: "stl", data } for stl-binary format', () => {
        mkStlParse.mockReturnValue(makeTestData(80));
        const result = exportGeometryBuffer(fakeGeometry, 'stl-binary');
        expect(result.ext).toBe('stl');
        expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it('returns { ext: "stl", data } for stl-ascii format', () => {
        const text = 'solid test\nendsolid test\n';
        mkStlParse.mockReturnValue(text);
        const result = exportGeometryBuffer(fakeGeometry, 'stl-ascii');
        expect(result.ext).toBe('stl');
        expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it('returns { ext: "obj", data } for obj format', () => {
        mkObjParse.mockReturnValue('v 0 0 0\n');
        const result = exportGeometryBuffer(fakeGeometry, 'obj');
        expect(result.ext).toBe('obj');
        expect(result.data).toBeInstanceOf(Uint8Array);
    });

    it('throws for unsupported format', () => {
        expect(() => exportGeometryBuffer(fakeGeometry, 'unsupported' as MeshExportFormat)).toThrow(
            'Unsupported mesh format',
        );
    });

    it('handles stl-binary returning ArrayBuffer', () => {
        const ab = new ArrayBuffer(80);
        mkStlParse.mockReturnValue(ab);
        const result = exportGeometryBuffer(fakeGeometry, 'stl-binary');
        expect(result.data).toBeInstanceOf(Uint8Array);
        expect(result.data.length).toBe(80);
    });

    it('handles stl-binary returning typed array view', () => {
        const full = new Uint8Array(120);
        full[0] = 0xaa;
        const view = new Uint8Array(full.buffer, 40, 80);
        mkStlParse.mockReturnValue(view);
        const result = exportGeometryBuffer(fakeGeometry, 'stl-binary');
        expect(result.data).toBeInstanceOf(Uint8Array);
        expect(result.data.length).toBe(80);
    });
});
