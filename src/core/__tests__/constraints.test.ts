import { describe, expect, it } from 'vitest';
import type { Dimensions } from '../../data/store.js';
import { validateAndClampDimensions } from '../constraints.js';

const DEFAULT_BEAD_RADIUS = 1.5;

const baseDims: Dimensions = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    spoolLength: 50,
};

describe('validateAndClampDimensions', () => {
    describe('gasket', () => {
        it('does not modify already-valid dimensions', () => {
            const result = validateAndClampDimensions('gasket', baseDims, DEFAULT_BEAD_RADIUS);
            expect(result.tubeID).toBe(34.8);
            expect(result.ferruleOD).toBe(63.9);
            expect(result.beadDistance).toBe(50.7);
        });

        it('clamps ferruleOD below tubeID + 5', () => {
            const dims = { ...baseDims, ferruleOD: 35 };
            const result = validateAndClampDimensions('gasket', dims, DEFAULT_BEAD_RADIUS);
            expect(result.ferruleOD).toBe(dims.tubeID + 5);
        });

        it('clamps beadDistance below minimum', () => {
            const dims = { ...baseDims, beadDistance: 10 };
            const result = validateAndClampDimensions('gasket', dims, DEFAULT_BEAD_RADIUS);
            const minBD = dims.tubeID + DEFAULT_BEAD_RADIUS * 2 + 0.5;
            expect(result.beadDistance).toBe(minBD);
        });

        it('clamps beadDistance above maximum', () => {
            const dims = { ...baseDims, beadDistance: 200 };
            const result = validateAndClampDimensions('gasket', dims, DEFAULT_BEAD_RADIUS);
            const maxBD = dims.ferruleOD - DEFAULT_BEAD_RADIUS * 2 - 0.5;
            expect(result.beadDistance).toBe(maxBD);
        });
    });

    describe('endcap', () => {
        it('clamps beadDistance when bead + ferruleOD boundary violated', () => {
            const dims: Dimensions = { tubeID: 10, tubeOD: 12, ferruleOD: 10, beadDistance: 12, spoolLength: 0 };
            const result = validateAndClampDimensions('endcap', dims, DEFAULT_BEAD_RADIUS);
            expect(result.beadDistance).toBeLessThan(12);
        });

        it('does not modify valid endcap dimensions', () => {
            const dims: Dimensions = { tubeID: 30, tubeOD: 35, ferruleOD: 63.9, beadDistance: 50.7, spoolLength: 0 };
            const result = validateAndClampDimensions('endcap', dims, DEFAULT_BEAD_RADIUS);
            expect(result.beadDistance).toBe(50.7);
        });
    });

    describe('default (ferrule/spool)', () => {
        it('clamps tubeOD and ferruleOD when too close', () => {
            const dims: Dimensions = { tubeID: 30, tubeOD: 30.5, ferruleOD: 31, beadDistance: 50, spoolLength: 0 };
            const result = validateAndClampDimensions('ferrula', dims, DEFAULT_BEAD_RADIUS);
            expect(result.tubeOD).toBe(dims.tubeID + 1);
            expect(result.ferruleOD).toBe(dims.tubeID + 1 + 2);
        });

        it('clamps beadDistance into feasible range', () => {
            const dims: Dimensions = { tubeID: 30, tubeOD: 35, ferruleOD: 60, beadDistance: 10, spoolLength: 0 };
            const result = validateAndClampDimensions('ferrula', dims, DEFAULT_BEAD_RADIUS);
            expect(result.beadDistance).toBeGreaterThan(10);
        });

        it('preserves spoolLength', () => {
            const dims: Dimensions = { tubeID: 30, tubeOD: 35, ferruleOD: 60, beadDistance: 50, spoolLength: 123 };
            const result = validateAndClampDimensions('spool', dims, DEFAULT_BEAD_RADIUS);
            expect(result.spoolLength).toBe(123);
        });

        it('returns a new object (does not mutate input)', () => {
            const original = { ...baseDims };
            const result = validateAndClampDimensions('ferrula', original, DEFAULT_BEAD_RADIUS);
            expect(result).not.toBe(original);
            expect(original.tubeID).toBe(34.8);
        });
    });
});
