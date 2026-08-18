import type * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// store.ts has a `import type * as THREE from 'three'` — stub it for the node env
vi.mock('three', () => ({}));

import {
    getAplicandoPreset,
    getBeadRadiusFijo,
    getCadParams,
    getCadTipo,
    getFerrHeightFijo,
    getGasketThicknessFijo,
    getGeometriaExportacion,
    getLastTubeHeightsCortaLarga,
    getObjetoActual,
    getPresetsList,
    getTubeHeightFijo,
    setAplicandoPreset,
    setCadParams,
    setGasketThicknessFijo,
    setGeometriaExportacion,
    setLastTubeHeightsCortaLarga,
    setObjetoActual,
    setTubeHeightFijo,
} from '../store.js';

describe('store — getters (initial state)', () => {
    it('getPresetsList returns an empty array', () => {
        expect(getPresetsList()).toEqual([]);
    });

    it('getAplicandoPreset returns false', () => {
        expect(getAplicandoPreset()).toBe(false);
    });

    it('getLastTubeHeightsCortaLarga returns defaults', () => {
        expect(getLastTubeHeightsCortaLarga()).toEqual({ corta: 12.7, larga: 28.6 });
    });

    it('getBeadRadiusFijo returns 1.5', () => {
        expect(getBeadRadiusFijo()).toBe(1.5);
    });

    it('getGasketThicknessFijo returns 1.4', () => {
        expect(getGasketThicknessFijo()).toBe(1.4);
    });

    it('getFerrHeightFijo returns 2.0', () => {
        expect(getFerrHeightFijo()).toBe(2.0);
    });

    it('getTubeHeightFijo returns 28.6', () => {
        expect(getTubeHeightFijo()).toBe(28.6);
    });

    it('getObjetoActual returns null', () => {
        expect(getObjetoActual()).toBeNull();
    });

    it('getGeometriaExportacion returns null', () => {
        expect(getGeometriaExportacion()).toBeNull();
    });

    it('getCadParams returns null', () => {
        expect(getCadParams()).toBeNull();
    });

    it('getCadTipo returns "ferrula"', () => {
        expect(getCadTipo()).toBe('ferrula');
    });
});

describe('store — setters', () => {
    beforeEach(() => {
        // reset to defaults
        setAplicandoPreset(false);
        setTubeHeightFijo(28.6);
        setGasketThicknessFijo(1.4);
        setLastTubeHeightsCortaLarga(12.7, 28.6);
        setGeometriaExportacion(null);
        setObjetoActual(null);
        setCadParams('ferrula', {});
    });

    it('setAplicandoPreset changes the value', () => {
        setAplicandoPreset(true);
        expect(getAplicandoPreset()).toBe(true);
        setAplicandoPreset(false);
        expect(getAplicandoPreset()).toBe(false);
    });

    it('setTubeHeightFijo updates the value', () => {
        setTubeHeightFijo(50);
        expect(getTubeHeightFijo()).toBe(50);
    });

    it('setTubeHeightFijo ignores NaN', () => {
        setTubeHeightFijo(NaN);
        expect(getTubeHeightFijo()).toBe(28.6);
    });

    it('setTubeHeightFijo ignores Infinity', () => {
        setTubeHeightFijo(Infinity);
        expect(getTubeHeightFijo()).toBe(28.6);
    });

    it('setGasketThicknessFijo updates the value', () => {
        setGasketThicknessFijo(2.25);
        expect(getGasketThicknessFijo()).toBe(2.25);
    });

    it('setGasketThicknessFijo ignores NaN', () => {
        setGasketThicknessFijo(NaN);
        expect(getGasketThicknessFijo()).toBe(1.4);
    });

    it('setLastTubeHeightsCortaLarga updates both values', () => {
        setLastTubeHeightsCortaLarga(10, 20);
        expect(getLastTubeHeightsCortaLarga()).toEqual({ corta: 10, larga: 20 });
    });

    it('setObjetoActual stores and retrieves the object', () => {
        const fake = { id: 'test-objeto' } as unknown as THREE.Object3D;
        setObjetoActual(fake);
        expect(getObjetoActual()).toBe(fake);
    });

    it('setObjetoActual can set null', () => {
        const fake = { id: 'test-objeto' } as unknown as THREE.Object3D;
        setObjetoActual(fake);
        setObjetoActual(null);
        expect(getObjetoActual()).toBeNull();
    });

    it('setCadParams sets tipo and params', () => {
        setCadParams('gasket', { a: 1, b: 2 });
        expect(getCadTipo()).toBe('gasket');
        expect(getCadParams()).toEqual({ a: 1, b: 2 });
    });

    it('setCadParams overwrites previous tipo', () => {
        setCadParams('ferrula', {});
        setCadParams('spool', { x: 99 });
        expect(getCadTipo()).toBe('spool');
        expect(getCadParams()).toEqual({ x: 99 });
    });
});

describe('store — setGeometriaExportacion edge cases', () => {
    it('does not throw when setting null with no existing geometry', () => {
        expect(() => setGeometriaExportacion(null)).not.toThrow();
        expect(getGeometriaExportacion()).toBeNull();
    });

    it('sets to null and returns null', () => {
        setGeometriaExportacion(null);
        expect(getGeometriaExportacion()).toBeNull();
    });

    it('does not throw when setting null twice', () => {
        setGeometriaExportacion(null);
        expect(() => setGeometriaExportacion(null)).not.toThrow();
    });
});
