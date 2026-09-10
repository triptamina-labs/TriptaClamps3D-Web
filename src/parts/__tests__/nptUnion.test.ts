import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkCreateLatheMesh, mkPerfilNptUnion, mkGetPoints } = vi.hoisted(() => ({
    mkCreateLatheMesh: vi.fn().mockReturnValue({ id: 'mesh' }),
    mkPerfilNptUnion: vi.fn().mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]),
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
    perfilNptUnion: mkPerfilNptUnion,
    descriptorAShape: vi.fn().mockReturnValue({ getPoints: mkGetPoints }),
}));

vi.mock('../../scene/materials.js', () => ({
    matSolido: { id: 'matSolido' },
    matLineas: { id: 'matLineas' },
    matMalla: { id: 'matMalla' },
    matPuntos: { id: 'matPuntos' },
}));

import type { NptUnionParams } from '../../cad/profileDescriptor.js';
import { generarGeometriaNptUnion } from '../nptUnion.js';

const params: NptUnionParams = {
    bodyOD: 19,
    bodyLength: 30,
    bore: 11.11,
};

beforeEach(() => {
    vi.clearAllMocks();
    mkCreateLatheMesh.mockReturnValue({ id: 'mesh' });
    mkPerfilNptUnion.mockReturnValue([{ type: 'moveTo' as const, x: 0, y: 0 }]);
});

describe('generarGeometriaNptUnion', () => {
    it('calls perfilNptUnion with given params', () => {
        generarGeometriaNptUnion('lineas', params);
        expect(mkPerfilNptUnion).toHaveBeenCalledWith(params);
    });

    it('calls getPoints with PROFILE_POINTS_NPT (120)', () => {
        generarGeometriaNptUnion('lineas', params);
        expect(mkGetPoints).toHaveBeenCalledWith(120);
    });

    it('nptMaterials.solido is matSolido', () => {
        generarGeometriaNptUnion('solido', params);
        expect(mkCreateLatheMesh.mock.calls[0][2].solido.id).toBe('matSolido');
    });

    it('returns object with malla and geometriaBase', () => {
        const result = generarGeometriaNptUnion('puntos', params);
        expect(result.malla).toBeDefined();
        expect(result.geometriaBase).toBeDefined();
    });
});
