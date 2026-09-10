import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
    class Shape {
        pts: { x: number; y: number }[] = [];
        moveTo(x: number, y: number) {
            this.pts.push({ x, y });
        }
        lineTo(x: number, y: number) {
            this.pts.push({ x, y });
        }
        absarc() {}
        getPoints() {
            return this.pts;
        }
    }
    return { Shape };
});

import type { ProfileCommand } from '../profileDescriptor.js';
import { perfilNptUnion } from '../profileDescriptor.js';

describe('NPT profile sanity', () => {
    const bodyOD = 19;
    const bodyLength = 30;
    const bore = 11.11;
    const cmds = perfilNptUnion({ bodyOD, bodyLength, bore });
    const pts = cmds as Extract<ProfileCommand, { x: number; y: number }>[];

    it('starts with moveTo and only lineTo afterwards', () => {
        expect(pts[0].type).toBe('moveTo');
        expect(pts.slice(1).every((p) => p.type === 'lineTo')).toBe(true);
    });

    it('is closed (last point equals first point)', () => {
        const a = pts[0];
        const b = pts[pts.length - 1];
        expect(b.x).toBeCloseTo(a.x, 6);
        expect(b.y).toBeCloseTo(a.y, 6);
    });

    it('all radii are positive and <= bodyOD/2', () => {
        for (const p of pts) {
            expect(p.x).toBeGreaterThan(0);
            expect(p.x).toBeLessThanOrEqual(bodyOD / 2 + 1e-9);
        }
    });

    it('y spans exactly 0..bodyLength', () => {
        const ys = pts.map((p) => p.y);
        expect(Math.min(...ys)).toBeCloseTo(0, 6);
        expect(Math.max(...ys)).toBeCloseTo(bodyLength, 6);
    });

    it('outer wall is a straight run at bodyOD/2 across the full length', () => {
        const rBody = bodyOD / 2;
        const outer = pts.filter((p) => Math.abs(p.x - rBody) < 1e-9);
        expect(outer.length).toBe(2);
        const outerYs = outer.map((p) => p.y).sort((a, b) => a - b);
        expect(outerYs[0]).toBeCloseTo(0, 6);
        expect(outerYs[1]).toBeCloseTo(bodyLength, 6);
    });

    it('has thread grooves near BOTH mouths and a smooth middle', () => {
        const rBody = bodyOD / 2;
        const inner = pts.filter((p) => p.x < rBody - 1e-9);
        const rl = 6.2435;
        const rc = rl - 1.129;
        const crests = inner.filter((p) => Math.abs(p.x - rc) < 1e-6);
        expect(crests.length).toBeGreaterThan(0);
        const nearLeft = crests.filter((p) => p.y < 10.5).length;
        const nearRight = crests.filter((p) => p.y > bodyLength - 10.5).length;
        const middle = crests.filter((p) => p.y >= 10.5 && p.y <= bodyLength - 10.5).length;
        expect(nearLeft).toBeGreaterThan(0);
        expect(nearRight).toBeGreaterThan(0);
        expect(middle).toBe(0);
        // symmetric about the center
        expect(nearLeft).toBe(nearRight);
    });

    it('total profile has 7 threads per mouth', () => {
        const rc = 6.2435 - 1.129;
        const crestPts = pts.filter((p) => Math.abs(p.x - rc) < 1e-6);
        expect(crestPts.length).toBe(7 * 2 * 2); // 7 threads x 2 mouths x 2 crest points
    });
});
