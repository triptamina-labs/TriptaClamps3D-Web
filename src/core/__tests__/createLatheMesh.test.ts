import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
    const mkClass = (name: string) =>
        function (this: Record<string, unknown>) {
            Object.defineProperty(this, 'constructor', { value: { name }, writable: true });
        };

    return {
        Points: mkClass('Points'),
        LineSegments: mkClass('LineSegments'),
        Mesh: mkClass('Mesh'),
        LatheGeometry: mkClass('LatheGeometry'),
        EdgesGeometry: mkClass('EdgesGeometry'),
        MeshBasicMaterial: mkClass('MeshBasicMaterial'),
        MeshStandardMaterial: mkClass('MeshStandardMaterial'),
        PointsMaterial: mkClass('PointsMaterial'),
        LineBasicMaterial: mkClass('LineBasicMaterial'),
        DoubleSide: 2,
    };
});

import type * as THREE from 'three';
import type { ViewMaterials } from '../createLatheMesh.js';
import { createLatheMesh } from '../createLatheMesh.js';

const fakeLatheGeometry = {} as unknown as THREE.LatheGeometry;

const fakeMaterials: ViewMaterials = {
    puntos: new (class {})() as never,
    lineas: new (class {})() as never,
    malla: new (class {})() as never,
    solido: new (class {})() as never,
};

describe('createLatheMesh', () => {
    it('returns Points for vista=puntos', () => {
        const result = createLatheMesh('puntos', fakeLatheGeometry, fakeMaterials);
        expect(result).toBeDefined();
        expect(result.constructor.name).toBe('Points');
    });

    it('returns LineSegments for vista=lineas', () => {
        const result = createLatheMesh('lineas', fakeLatheGeometry, fakeMaterials);
        expect(result).toBeDefined();
        expect(result.constructor.name).toBe('LineSegments');
    });

    it('returns Mesh for vista=malla', () => {
        const result = createLatheMesh('malla', fakeLatheGeometry, fakeMaterials);
        expect(result).toBeDefined();
        expect(result.constructor.name).toBe('Mesh');
    });

    it('returns Mesh for vista=solido', () => {
        const result = createLatheMesh('solido', fakeLatheGeometry, fakeMaterials);
        expect(result).toBeDefined();
        expect(result.constructor.name).toBe('Mesh');
    });
});
