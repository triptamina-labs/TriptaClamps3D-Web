import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkCreateLatheMesh, mkPerfilFerula, mkGetPoints } = vi.hoisted(() => ({
    mkCreateLatheMesh: vi.fn().mockReturnValue({ id: 'mesh' }),
    mkPerfilFerula: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
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
    perfilFerula: mkPerfilFerula,
    descriptorAShape: vi.fn().mockReturnValue({ getPoints: mkGetPoints }),
}));

vi.mock('../../scene/materials.js', () => ({
    matSolido: { id: 'matSolido' },
    matLineas: { id: 'matLineas' },
    matMalla: { id: 'matMalla' },
    matPuntos: { id: 'matPuntos' },
}));

import type { FerruleParams } from '../../cad/profileDescriptor.js';
import { generarGeometriaFerula } from '../ferrule.js';

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
    vi.clearAllMocks();
    mkCreateLatheMesh.mockReturnValue({ id: 'mesh' });
    mkPerfilFerula.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('generarGeometriaFerula', () => {
    it('calls perfilFerula with given params', () => {
        generarGeometriaFerula('lineas', params);
        expect(mkPerfilFerula).toHaveBeenCalledWith(params);
    });

    it('calls getPoints with PROFILE_POINTS_FERRULE (60)', () => {
        generarGeometriaFerula('lineas', params);
        expect(mkGetPoints).toHaveBeenCalledWith(60);
    });

    it('ferruleMaterials.solido references matSolido (not matGasketSolido)', () => {
        generarGeometriaFerula('solido', params);
        expect(mkCreateLatheMesh.mock.calls[0][2].solido.id).toBe('matSolido');
    });

    it('returns object with malla and geometriaBase', () => {
        const result = generarGeometriaFerula('puntos', params);
        expect(result.malla).toBeDefined();
        expect(result.geometriaBase).toBeDefined();
    });

    it('calls createLatheMesh with vista, geometry, and materials', () => {
        generarGeometriaFerula('malla', params);
        const [vista, geometry, materials] = mkCreateLatheMesh.mock.calls[0];
        expect(vista).toBe('malla');
        expect(geometry.constructor.name).toBe('LatheGeometry');
        expect(materials.puntos.id).toBe('matPuntos');
    });
});
