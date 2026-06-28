import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkCreateLatheMesh, mkPerfilGasket, mkGetPoints } = vi.hoisted(() => ({
    mkCreateLatheMesh: vi.fn().mockReturnValue({ id: 'mesh' }),
    mkPerfilGasket: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
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
    perfilGasket: mkPerfilGasket,
    descriptorAShape: vi.fn().mockReturnValue({ getPoints: mkGetPoints }),
}));

vi.mock('../../scene/materials.js', () => ({
    matGasketSolido: { id: 'matGasketSolido' },
    matLineas: { id: 'matLineas' },
    matMalla: { id: 'matMalla' },
    matPuntos: { id: 'matPuntos' },
}));

import type { GasketParams } from '../../cad/profileDescriptor.js';
import { generarGeometriaGasket } from '../gasket.js';

const params: GasketParams = {
    tubeID: 34.8,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
    gasketThickness: 2.25,
};

beforeEach(() => {
    vi.clearAllMocks();
    mkCreateLatheMesh.mockReturnValue({ id: 'mesh' });
    mkPerfilGasket.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('generarGeometriaGasket', () => {
    it('calls perfilGasket with given params', () => {
        generarGeometriaGasket('lineas', params);
        expect(mkPerfilGasket).toHaveBeenCalledWith(params);
    });

    it('calls getPoints with PROFILE_POINTS_FERRULE (60)', () => {
        generarGeometriaGasket('lineas', params);
        expect(mkGetPoints).toHaveBeenCalledWith(60);
    });

    it('gasketMaterials.solido is matGasketSolido (not matSolido)', () => {
        generarGeometriaGasket('solido', params);
        expect(mkCreateLatheMesh.mock.calls[0][2].solido.id).toBe('matGasketSolido');
    });

    it('returns object with malla and geometriaBase', () => {
        const result = generarGeometriaGasket('puntos', params);
        expect(result.malla).toBeDefined();
        expect(result.geometriaBase).toBeDefined();
    });
});
