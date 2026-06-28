import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkCreateLatheMesh, mkPerfilEndCap, mkGetPoints } = vi.hoisted(() => ({
    mkCreateLatheMesh: vi.fn().mockReturnValue({ id: 'mesh' }),
    mkPerfilEndCap: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
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
    perfilEndCap: mkPerfilEndCap,
    descriptorAShape: vi.fn().mockReturnValue({ getPoints: mkGetPoints }),
}));

vi.mock('../../scene/materials.js', () => ({
    matSolido: { id: 'matSolido' },
    matLineas: { id: 'matLineas' },
    matMalla: { id: 'matMalla' },
    matPuntos: { id: 'matPuntos' },
}));

import type { EndCapParams } from '../../cad/profileDescriptor.js';
import { generarGeometriaEndCap } from '../endcap.js';

const params: EndCapParams = {
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
};

beforeEach(() => {
    vi.clearAllMocks();
    mkCreateLatheMesh.mockReturnValue({ id: 'mesh' });
    mkPerfilEndCap.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('generarGeometriaEndCap', () => {
    it('calls perfilEndCap with given params', () => {
        generarGeometriaEndCap('lineas', params);
        expect(mkPerfilEndCap).toHaveBeenCalledWith(params);
    });

    it('calls getPoints with PROFILE_POINTS_FERRULE (60)', () => {
        generarGeometriaEndCap('lineas', params);
        expect(mkGetPoints).toHaveBeenCalledWith(60);
    });

    it('endcapMaterials.solido is matSolido', () => {
        generarGeometriaEndCap('solido', params);
        expect(mkCreateLatheMesh.mock.calls[0][2].solido.id).toBe('matSolido');
    });

    it('returns object with malla and geometriaBase', () => {
        const result = generarGeometriaEndCap('puntos', params);
        expect(result.malla).toBeDefined();
        expect(result.geometriaBase).toBeDefined();
    });
});
