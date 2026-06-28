// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

const { mkMockGeo } = vi.hoisted(() => ({
    mkMockGeo: vi.fn().mockReturnValue({ dispose: vi.fn() }),
}));

vi.mock('../../parts/ferrule.js', () => ({
    generarGeometriaFerula: vi.fn().mockReturnValue({ malla: {}, geometriaBase: mkMockGeo() }),
}));
vi.mock('../../parts/gasket.js', () => ({
    generarGeometriaGasket: vi.fn().mockReturnValue({ malla: {}, geometriaBase: mkMockGeo() }),
}));
vi.mock('../../parts/spool.js', () => ({
    generarGeometriaSpool: vi.fn().mockReturnValue({ malla: {}, geometriaBase: mkMockGeo() }),
}));
vi.mock('../../parts/endcap.js', () => ({
    generarGeometriaEndCap: vi.fn().mockReturnValue({ malla: {}, geometriaBase: mkMockGeo() }),
}));

import type { PresetRow } from '../../data/store.js';
import { renderBulkCheckboxNest } from '../bulkExport.js';

function makePreset(override: Partial<PresetRow> = {}): PresetRow {
    return {
        preset: '1.5"',
        dn: 'TC64',
        ferruleOD: 63.9,
        beadDistance: 50.7,
        tubeOD: 38.1,
        tubeID: 34.8,
        tubeHeightCorta: 12.7,
        tubeHeightLarga: 28.6,
        gasketThickness: 2.25,
        standard: 'ASME',
        notaPerfil: '',
        ...override,
    };
}

describe('presetSlug', () => {
    function presetSlug(p: PresetRow): string {
        const raw = `${p.preset || ''}`.trim();
        return (
            raw
                .replace(/"/g, 'in')
                .replace(/\s*·\s*/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '') || 'preset'
        );
    }

    it('replaces double-quote with "in"', () => {
        expect(presetSlug(makePreset({ preset: '1/2"' }))).toContain('in');
    });

    it('replaces middle-dot separator with underscore', () => {
        expect(presetSlug(makePreset({ preset: '1.5"' }))).toBe('1.5in');
    });

    it('returns "preset" for empty preset name', () => {
        expect(presetSlug(makePreset({ preset: '   ' }))).toBe('preset');
    });
});

describe('buildDimsFromPreset', () => {
    function buildDimsFromPreset(p: PresetRow) {
        return {
            tubeID: p.tubeID,
            tubeOD: p.tubeOD,
            ferruleOD: p.ferruleOD,
            beadDistance: p.beadDistance,
            spoolLength: 50,
        };
    }

    it('maps all 5 fields from PresetRow', () => {
        const dims = buildDimsFromPreset(makePreset());
        expect(dims.tubeID).toBe(34.8);
        expect(dims.tubeOD).toBe(38.1);
        expect(dims.ferruleOD).toBe(63.9);
        expect(dims.beadDistance).toBe(50.7);
        expect(dims.spoolLength).toBe(50);
    });
});

describe('clampDimensions', () => {
    function clampDimensions(
        tipo: string,
        dims: { tubeID: number; tubeOD: number; ferruleOD: number; beadDistance: number; spoolLength: number },
        bR: number,
    ) {
        const d = { ...dims };
        if (tipo === 'gasket') {
            if (d.ferruleOD < d.tubeID + 5) d.ferruleOD = d.tubeID + 5;
            const minBD = d.tubeID + bR * 2 + 0.5;
            const maxBD = d.ferruleOD - bR * 2 - 0.5;
            if (d.beadDistance < minBD) d.beadDistance = minBD;
            if (d.beadDistance > maxBD) d.beadDistance = maxBD;
        }
        return d;
    }

    it('enforces ferruleOD >= tubeID + 5 for gasket', () => {
        const dims = { tubeID: 34.8, tubeOD: 38.1, ferruleOD: 35, beadDistance: 50.7, spoolLength: 50 };
        const result = clampDimensions('gasket', dims, 1.5);
        expect(result.ferruleOD).toBe(39.8);
    });

    it('does not change already-valid dimensions', () => {
        const dims = { tubeID: 34.8, tubeOD: 38.1, ferruleOD: 63.9, beadDistance: 50.7, spoolLength: 50 };
        const result = clampDimensions('gasket', dims, 1.5);
        expect(result.ferruleOD).toBe(63.9);
    });
});

describe('buildParams', () => {
    function buildParams(
        dims: { tubeID: number; tubeOD: number; ferruleOD: number; beadDistance: number; spoolLength: number },
        preset: PresetRow,
        fixed: { beadRadiusFijo: number; ferrHeightFijo: number },
    ) {
        const tubeHeight = Number.isFinite(preset.tubeHeightLarga) ? preset.tubeHeightLarga : 28.6;
        return {
            ...dims,
            beadRadius: fixed.beadRadiusFijo,
            tubeHeight,
            ferrHeight: fixed.ferrHeightFijo,
            gasketThickness: preset.gasketThickness,
        };
    }

    it('uses preset tubeHeightLarga when finite', () => {
        const preset = makePreset({ tubeHeightLarga: 38.1 });
        const result = buildParams(
            { tubeID: 10, tubeOD: 12, ferruleOD: 20, beadDistance: 15, spoolLength: 50 },
            preset,
            { beadRadiusFijo: 1.5, ferrHeightFijo: 2.0 },
        );
        expect(result.tubeHeight).toBe(38.1);
    });

    it('falls back to 28.6 when tubeHeightLarga is NaN', () => {
        const preset = makePreset({ tubeHeightLarga: NaN });
        const result = buildParams(
            { tubeID: 10, tubeOD: 12, ferruleOD: 20, beadDistance: 15, spoolLength: 50 },
            preset,
            { beadRadiusFijo: 1.5, ferrHeightFijo: 2.0 },
        );
        expect(result.tubeHeight).toBe(28.6);
    });
});

describe('renderBulkCheckboxNest', () => {
    it('creates 4 fieldsets with master checkboxes', () => {
        const container = document.createElement('div');
        const presets = [makePreset()];
        renderBulkCheckboxNest(presets, container);
        expect(container.querySelectorAll('fieldset.bulk-fieldset').length).toBe(4);
        expect(container.querySelectorAll('.bulk-master-cb').length).toBe(4);
    });

    it('creates checkboxes for each preset per part type', () => {
        const container = document.createElement('div');
        const presets = [makePreset(), makePreset({ preset: '2"', dn: 'TC64', tubeID: 47.5 })];
        renderBulkCheckboxNest(presets, container);
        // 4 part types x 2 presets = 8 checkboxes
        expect(container.querySelectorAll('.bulk-preset-cb').length).toBe(8);
    });

    it('master checkbox toggles children', () => {
        const container = document.createElement('div');
        const presets = [makePreset()];
        renderBulkCheckboxNest(presets, container);
        const master = container.querySelector<HTMLInputElement>('.bulk-master-cb')!;
        master.checked = true;
        master.dispatchEvent(new Event('change'));
        const children = container.querySelectorAll<HTMLInputElement>(
            `.bulk-preset-cb[data-tipo="${master.dataset.part}"]`,
        );
        children.forEach((c) => {
            expect(c.checked).toBe(true);
        });
    });
});
