// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// store.ts has a `import type * as THREE from 'three'`
vi.mock('three', () => ({}));

import { fetchPresetsData, parsePresetsCSV } from '../presets.js';
import { state } from '../store.js';

const VALID_CSV = `Preset,DN,ferruleOD,beadDistance,tubeOD,tubeID,tubeHeightCorta,tubeHeightLarga,gasketThickness,Standard
1/2",Mini,25.20,18.66,12.70,9.40,12.7,28.6,1.4,ASME BPE
3/4",Mini,29.20,23.82,19.05,15.75,12.7,28.6,1.4,ASME BPE
1",TC50,50.40,37.60,25.40,22.10,12.7,28.6,2.25,ASME BPE
1.5",TC64,63.90,50.70,38.10,34.80,12.7,28.6,2.25,ASME BPE
2",TC64,74.00,62.10,50.80,47.50,12.7,28.6,2.25,ASME BPE
2.5",TC77,87.00,74.96,63.50,60.20,12.7,28.6,2.25,ASME BPE
3",TC91,100.00,87.80,76.20,72.90,12.7,28.6,2.25,ASME BPE
4",TC119,125.00,113.00,101.60,97.38,15.9,28.6,2.25,ASME BPE
6",TC167,179.00,165.40,152.40,146.86,19.1,38.1,2.75,ASME BPE
8",TC218,230.00,216.30,203.20,197.66,19.1,38.1,2.75,ASME BPE
10",TC268,281.00,267.20,254.00,248.46,19.1,38.1,2.75,ASME BPE
12",TC319,332.00,318.10,304.80,298.70,19.1,44.5,2.75,ASME BPE
`;

describe('parsePresetsCSV', () => {
    it('parses a valid CSV into 12 rows', () => {
        const rows = parsePresetsCSV(VALID_CSV);
        expect(rows).toHaveLength(12);
    });

    it('returns correct values for a known row (index 3 = 1.5" TC64)', () => {
        const rows = parsePresetsCSV(VALID_CSV);
        const row = rows[3];
        expect(row.preset).toBe('1.5"');
        expect(row.dn).toBe('TC64');
        expect(row.ferruleOD).toBe(63.9);
        expect(row.beadDistance).toBe(50.7);
        expect(row.tubeOD).toBe(38.1);
        expect(row.tubeID).toBe(34.8);
        expect(row.tubeHeightCorta).toBe(12.7);
        expect(row.tubeHeightLarga).toBe(28.6);
        expect(row.gasketThickness).toBe(2.25);
        expect(row.standard).toBe('ASME BPE');
    });

    it('returns empty array for empty string', () => {
        expect(parsePresetsCSV('')).toEqual([]);
    });

    it('returns empty array for single header line only', () => {
        expect(parsePresetsCSV('Preset,DN\n')).toEqual([]);
    });

    it('skips lines with fewer than 6 columns', () => {
        const csv = `Preset,DN,ferruleOD,beadDistance,tubeOD,tubeID\n1",TC50,50.40,37.60,25.40\n1.5",TC64,63.90,50.70,38.10,34.80,12.7,28.6,2.25,ASME BPE\n`;
        const rows = parsePresetsCSV(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0].preset).toBe('1.5"');
    });

    it('returns empty array for whitespace-only input', () => {
        expect(parsePresetsCSV('   \n  \n')).toEqual([]);
    });

    it('uses positional fallback when headers are missing', () => {
        const csv = `a,b,c,d,e,f,g,h,i,j\n1/2",Mini,25.20,18.66,12.70,9.40,12.7,28.6,1.4,ASME\n`;
        const rows = parsePresetsCSV(csv);
        expect(rows).toHaveLength(1);
        // With wrong headers, falls back to positional: cols[0] = preset, cols[1] = dn
        expect(rows[0].preset).toBe('1/2"');
        expect(rows[0].dn).toBe('Mini');
    });

    it('handles Standard column case-insensitively', () => {
        const csv = `Preset,DN,ferruleOD,beadDistance,tubeOD,tubeID,tubeHeightCorta,tubeHeightLarga,gasketThickness,standard\n1.5",TC64,63.90,50.70,38.10,34.80,12.7,28.6,2.25,BPE\n`;
        const rows = parsePresetsCSV(csv);
        expect(rows[0].standard).toBe('BPE');
    });

    it('handles notaPerfil column when present', () => {
        const csv = `Preset,DN,ferruleOD,beadDistance,tubeOD,tubeID,tubeHeightCorta,tubeHeightLarga,gasketThickness,standard,notaPerfil\n1.5",TC64,63.90,50.70,38.10,34.80,12.7,28.6,2.25,ASME,Test note\n`;
        const rows = parsePresetsCSV(csv);
        expect(rows[0].notaPerfil).toBe('Test note');
    });
});

describe('fetchPresetsData', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        state.presetsList = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('populates state.presetsList on successful fetch', async () => {
        const mockResponse = {
            ok: true,
            text: () => Promise.resolve(VALID_CSV),
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

        const result = await fetchPresetsData();
        expect(result).toHaveLength(12);
        expect(state.presetsList).toHaveLength(12);
        expect(result[3].preset).toBe('1.5"');
    });

    it('falls back to embedded CSV when fetch fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

        const result = await fetchPresetsData();
        expect(result).toHaveLength(12);
        expect(state.presetsList).toHaveLength(12);
    });

    it('falls back to embedded CSV when response is not ok', async () => {
        const mockResponse = {
            ok: false,
            status: 404,
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

        const result = await fetchPresetsData();
        expect(result).toHaveLength(12);
    });
});
