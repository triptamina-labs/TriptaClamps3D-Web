// Vitest node env has no THREE — stub it so createLatheMesh re-exports don't fail resolution
import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => ({}));

import {
    BEAD_RADIUS_DEFAULT,
    CONSTRAINT_EPSILON,
    CONSTRAINT_MIN_GAP,
    EDGES_GEOMETRY_THRESHOLD,
    FERRULE_TAPER_ANGLE_DEG,
    PROFILE_POINTS_FERRULE,
    PROFILE_POINTS_SPOOL,
    SEGMENTS_DEFAULT,
    SEGMENTS_SOLID,
    TUBE_HEIGHT_CORTA_DEFAULT,
    TUBE_HEIGHT_LARGA_DEFAULT,
} from '../constants.js';

describe('constants', () => {
    it('PROFILE_POINTS_FERRULE is 60', () => {
        expect(PROFILE_POINTS_FERRULE).toBe(60);
    });

    it('PROFILE_POINTS_SPOOL is 80', () => {
        expect(PROFILE_POINTS_SPOOL).toBe(80);
    });

    it('SEGMENTS_SOLID is 128', () => {
        expect(SEGMENTS_SOLID).toBe(128);
    });

    it('SEGMENTS_DEFAULT is 64', () => {
        expect(SEGMENTS_DEFAULT).toBe(64);
    });

    it('EDGES_GEOMETRY_THRESHOLD is 0.1', () => {
        expect(EDGES_GEOMETRY_THRESHOLD).toBe(0.1);
    });

    it('CONSTRAINT_EPSILON is 0.2', () => {
        expect(CONSTRAINT_EPSILON).toBe(0.2);
    });

    it('CONSTRAINT_MIN_GAP is 0.5', () => {
        expect(CONSTRAINT_MIN_GAP).toBe(0.5);
    });

    it('FERRULE_TAPER_ANGLE_DEG is 20', () => {
        expect(FERRULE_TAPER_ANGLE_DEG).toBe(20);
    });

    it('BEAD_RADIUS_DEFAULT is 1.5', () => {
        expect(BEAD_RADIUS_DEFAULT).toBe(1.5);
    });

    it('TUBE_HEIGHT_LARGA_DEFAULT is 28.6', () => {
        expect(TUBE_HEIGHT_LARGA_DEFAULT).toBe(28.6);
    });

    it('TUBE_HEIGHT_CORTA_DEFAULT is 12.7', () => {
        expect(TUBE_HEIGHT_CORTA_DEFAULT).toBe(12.7);
    });
});
