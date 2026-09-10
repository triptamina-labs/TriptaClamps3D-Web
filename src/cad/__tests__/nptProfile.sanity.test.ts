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

import type { NptSize } from '../../data/nptSizes.js';
import { NPT_CSV_FALLBACK, parseNptCSV } from '../../data/nptSizes.js';
import type { ProfileCommand } from '../profileDescriptor.js';
import { perfilNptUnion } from '../profileDescriptor.js';

const SIZES: NptSize[] = parseNptCSV(NPT_CSV_FALLBACK);

describe('perfilNptUnion — all fixed sizes', () => {
    it('covers the 5 requested sizes', () => {
        expect(SIZES).toHaveLength(5);
    });

    for (const size of SIZES) {
        describe(`NPT ${size.preset}`, () => {
            const cmds = perfilNptUnion(size) as Extract<ProfileCommand, { x: number; y: number }>[];
            const rootR = size.e1Diameter / 2;
            const crestR = rootR - size.threadHeight;
            const rBody = size.bodyOD / 2;

            it('starts with moveTo and only lineTo afterwards', () => {
                expect(cmds[0].type).toBe('moveTo');
                expect(cmds.slice(1).every((p) => p.type === 'lineTo')).toBe(true);
            });

            it('is closed', () => {
                const a = cmds[0];
                const b = cmds[cmds.length - 1];
                expect(b.x).toBeCloseTo(a.x, 6);
                expect(b.y).toBeCloseTo(a.y, 6);
            });

            it('all radii are positive and never exceed bodyOD/2', () => {
                for (const p of cmds) {
                    expect(p.x).toBeGreaterThan(0);
                    expect(p.x).toBeLessThanOrEqual(rBody + 1e-9);
                }
            });

            it('y spans exactly 0..bodyLength', () => {
                const ys = cmds.map((p) => p.y);
                expect(Math.min(...ys)).toBeCloseTo(0, 6);
                expect(Math.max(...ys)).toBeCloseTo(size.bodyLength, 6);
            });

            it('outer wall is exactly 2 points at bodyOD/2', () => {
                const outer = cmds.filter((p) => Math.abs(p.x - rBody) < 1e-9);
                expect(outer).toHaveLength(2);
                const ys = outer.map((p) => p.y).sort((a, b) => a - b);
                expect(ys[0]).toBeCloseTo(0, 6);
                expect(ys[1]).toBeCloseTo(size.bodyLength, 6);
            });

            it('bore at the thread roots never exceeds the body wall', () => {
                expect(rootR).toBeLessThan(rBody);
                expect(crestR).toBeGreaterThan(0);
            });

            it('has thread crests near BOTH mouths and none in the middle', () => {
                const crests = cmds.filter((p) => Math.abs(p.x - crestR) < 1e-6);
                expect(crests.length).toBeGreaterThan(0);
                const half = size.threadLength + size.threadHeight;
                const nearLeft = crests.filter((p) => p.y < half).length;
                const nearRight = crests.filter((p) => p.y > size.bodyLength - half).length;
                const middle = crests.filter((p) => p.y >= half && p.y <= size.bodyLength - half).length;
                expect(nearLeft).toBeGreaterThan(0);
                expect(nearRight).toBe(nearLeft);
                expect(middle).toBe(0);
            });

            it('number of threads per mouth matches the standard thread length', () => {
                const crests = cmds.filter((p) => Math.abs(p.x - crestR) < 1e-6);
                const expected = Math.floor(size.threadLength / size.pitch);
                // 2 crest points per thread, times 2 mouths
                expect(crests.length).toBe(expected * 2 * 2);
            });

            it('keeps a positive smooth bore between the two threads', () => {
                const inner = cmds.filter((p) => Math.abs(p.x - rootR) < 1e-9);
                const ys = inner.map((p) => p.y).sort((a, b) => a - b);
                expect(ys[0]).toBeCloseTo(0, 6);
                expect(ys[ys.length - 1]).toBeCloseTo(size.bodyLength, 6);
            });
        });
    }
});
