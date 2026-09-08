import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkCreateLatheMesh, mkPerfilPlatter, mkGetPoints } = vi.hoisted(() => ({
    mkCreateLatheMesh: vi.fn().mockReturnValue({ id: 'mesh' }),
    mkPerfilPlatter: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
    mkGetPoints: vi.fn().mockReturnValue([{ x: 0, y: 0 }]),
}));

vi.mock('three', () => {
    const mkClass = (name: string) =>
        function (this: Record<string, unknown>) {
            Object.defineProperty(this, 'constructor', { value: { name }, writable: true });
        };
    return { LatheGeometry: mkClass('LatheGeometry'), Shape: mkClass('Shape') };
});

vi.mock('../../core/createLatheMesh.js', () => ({ createLatheMesh: mkCreateLatheMesh }));

vi.mock('../../cad/profileDescriptor.js', () => ({
    perfilPlatter: mkPerfilPlatter,
    descriptorAShape: vi.fn().mockReturnValue({ getPoints: mkGetPoints }),
}));

vi.mock('../../scene/materials.js', () => ({
    matSolido: { id: 'matSolido' },
    matLineas: { id: 'matLineas' },
    matMalla: { id: 'matMalla' },
    matPuntos: { id: 'matPuntos' },
}));

import type { PlatterParams } from '../../cad/profileDescriptor.js';
import { generarGeometriaPlatter } from '../platter.js';

const params: PlatterParams = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    platterHeight: 50,
    beadRadius: 1.5,
    tubeHeight: 28.6,
    ferrHeight: 2.0,
};

beforeEach(() => {
    vi.clearAllMocks();
    mkCreateLatheMesh.mockReturnValue({ id: 'mesh' });
    mkPerfilPlatter.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('generarGeometriaPlatter', () => {
    it('calls perfilPlatter with given params', () => {
        generarGeometriaPlatter('lineas', params);
        expect(mkPerfilPlatter).toHaveBeenCalledWith(params);
    });

    it('calls getPoints with PROFILE_POINTS_PLATTER (80)', () => {
        generarGeometriaPlatter('lineas', params);
        expect(mkGetPoints).toHaveBeenCalledWith(80);
    });

    it('platterMaterials.solido is matSolido (not matGasketSolido)', () => {
        generarGeometriaPlatter('solido', params);
        expect(mkCreateLatheMesh.mock.calls[0][2].solido.id).toBe('matSolido');
    });

    it('returns object with malla and geometriaBase', () => {
        const result = generarGeometriaPlatter('puntos', params);
        expect(result.malla).toBeDefined();
        expect(result.geometriaBase).toBeDefined();
    });
});
