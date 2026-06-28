import { describe, expect, it, vi } from 'vitest';

const { setHexTech, setHexGasket } = vi.hoisted(() => ({
    setHexTech: vi.fn(),
    setHexGasket: vi.fn(),
}));

vi.mock('three', () => {
    const mkClass = (name: string, props: Record<string, unknown> = {}, colorSetHex = setHexTech) =>
        function (this: Record<string, unknown>) {
            Object.defineProperty(this, 'constructor', { value: { name }, writable: true });
            Object.assign(this, props);
            this.color = { setHex: colorSetHex };
        };
    return {
        PointsMaterial: mkClass('PointsMaterial', { size: 0.18, sizeAttenuation: true }),
        LineBasicMaterial: mkClass('LineBasicMaterial'),
        MeshBasicMaterial: mkClass('MeshBasicMaterial', {
            wireframe: true,
            transparent: true,
            opacity: 0.15,
        }),
        MeshStandardMaterial: mkClass(
            'MeshStandardMaterial',
            {
                metalness: 0.8,
                roughness: 0.3,
                flatShading: true,
            },
            setHexGasket,
        ),
        DoubleSide: 2,
    };
});

import { matGasketSolido, matLineas, matMalla, matPuntos, matSolido, updateMaterialsColor } from '../materials.js';

describe('updateMaterialsColor', () => {
    it('sets color on matPuntos, matLineas, and matMalla for valid hex', () => {
        updateMaterialsColor(0xff0000);
        expect(matPuntos.color.setHex).toHaveBeenCalledWith(0xff0000);
        expect(matLineas.color.setHex).toHaveBeenCalledWith(0xff0000);
        expect(matMalla.color.setHex).toHaveBeenCalledWith(0xff0000);
    });

    it('does NOT set color on matGasketSolido', () => {
        setHexGasket.mockClear();
        updateMaterialsColor(0x00ff00);
        expect(setHexGasket).not.toHaveBeenCalled();
    });

    it('rejects NaN hex values', () => {
        setHexTech.mockClear();
        updateMaterialsColor(NaN);
        expect(setHexTech).not.toHaveBeenCalled();
    });

    it('rejects negative hex values', () => {
        setHexTech.mockClear();
        updateMaterialsColor(-1);
        expect(setHexTech).not.toHaveBeenCalled();
    });

    it('rejects hex values above 0xffffff', () => {
        setHexTech.mockClear();
        updateMaterialsColor(0x1000000);
        expect(setHexTech).not.toHaveBeenCalled();
    });

    it('accepts boundary value 0x000000', () => {
        updateMaterialsColor(0x000000);
        expect(setHexTech).toHaveBeenCalledWith(0x000000);
    });

    it('accepts boundary value 0xffffff', () => {
        updateMaterialsColor(0xffffff);
        expect(setHexTech).toHaveBeenCalledWith(0xffffff);
    });
});

describe('material instantiation', () => {
    it('matPuntos has size=0.18 and sizeAttenuation=true', () => {
        const p = matPuntos as unknown as { size: number; sizeAttenuation: boolean };
        expect(p.size).toBe(0.18);
        expect(p.sizeAttenuation).toBe(true);
    });

    it('matMalla has wireframe=true, transparent=true, opacity=0.15', () => {
        const m = matMalla as unknown as { wireframe: boolean; transparent: boolean; opacity: number };
        expect(m.wireframe).toBe(true);
        expect(m.transparent).toBe(true);
        expect(m.opacity).toBe(0.15);
    });

    it('matSolido has metalness=0.8, roughness=0.3, flatShading=true', () => {
        const s = matSolido as unknown as { metalness: number; roughness: number; flatShading: boolean };
        expect(s.metalness).toBe(0.8);
        expect(s.roughness).toBe(0.3);
        expect(s.flatShading).toBe(true);
    });

    it('matGasketSolido exists as a separate MeshStandardMaterial', () => {
        expect(matGasketSolido).toBeDefined();
        expect(matGasketSolido.constructor.name).toBe('MeshStandardMaterial');
    });
});
