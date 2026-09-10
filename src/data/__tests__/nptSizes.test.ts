import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => ({}));

import nptCsvOnDisk from '../../npt.csv?raw';
import { NPT_CSV_FALLBACK, NPT_DEFAULT_INDEX, parseNptCSV } from '../nptSizes.js';

describe('nptSizes CSV', () => {
    it('src/npt.csv and the embedded fallback are identical', () => {
        expect(nptCsvOnDisk.trim()).toBe(NPT_CSV_FALLBACK.trim());
    });

    it('parses the 5 requested sizes', () => {
        const rows = parseNptCSV(NPT_CSV_FALLBACK);
        expect(rows.map((r) => r.preset)).toEqual(['1/8"', '1/4"', '1/2"', '1"', '1 1/2"']);
    });

    it('every row has fully specified, finite geometry', () => {
        for (const r of parseNptCSV(NPT_CSV_FALLBACK)) {
            for (const k of [
                'tpi',
                'pitch',
                'e1Diameter',
                'bodyOD',
                'bodyLength',
                'threadLength',
                'threadHeight',
            ] as const) {
                expect(Number.isFinite(r[k]), `${r.preset} ${k}`).toBe(true);
                expect(r[k], `${r.preset} ${k}`).toBeGreaterThan(0);
            }
        }
    });

    it('thread height is 0.8 x pitch and pitch is 25.4/tpi (within CSV rounding)', () => {
        for (const r of parseNptCSV(NPT_CSV_FALLBACK)) {
            expect(r.pitch, `${r.preset} pitch`).toBeCloseTo(25.4 / r.tpi, 3);
            expect(r.threadHeight, `${r.preset} height`).toBeCloseTo(0.8 * r.pitch, 2);
        }
    });

    it('body OD leaves a positive wall over the thread roots', () => {
        for (const r of parseNptCSV(NPT_CSV_FALLBACK)) {
            expect(r.bodyOD, `${r.preset} wall`).toBeGreaterThan(r.e1Diameter);
        }
    });

    it('body length leaves a positive smooth bore between the two threads', () => {
        for (const r of parseNptCSV(NPT_CSV_FALLBACK)) {
            expect(r.bodyLength, `${r.preset} middle`).toBeGreaterThan(2 * r.threadLength);
        }
    });

    it('default index points at 1/4"', () => {
        const rows = parseNptCSV(NPT_CSV_FALLBACK);
        expect(rows[NPT_DEFAULT_INDEX].preset).toBe('1/4"');
    });
});
