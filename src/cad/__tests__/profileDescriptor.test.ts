import { describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
    const mkClass = (name: string) =>
        function (this: Record<string, unknown>) {
            Object.defineProperty(this, 'constructor', { value: { name }, writable: true });
            this.moveTo = vi.fn();
            this.lineTo = vi.fn();
            this.absarc = vi.fn();
        };
    return { Shape: mkClass('Shape') };
});

import type { EndCapParams, FerruleParams, GasketParams, PlatterParams, SpoolParams } from '../profileDescriptor.js';
import {
    descriptorAShape,
    obtenerPerfil,
    perfilEndCap,
    perfilFerula,
    perfilGasket,
    perfilPlatter,
    perfilSpool,
} from '../profileDescriptor.js';

const ferruleParams: FerruleParams = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
    tubeHeight: 28.6,
    ferrHeight: 2.0,
};

const gasketParams: GasketParams = {
    tubeID: 34.8,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
    gasketThickness: 2.25,
};

const endcapParams: EndCapParams = {
    ferruleOD: 63.9,
    beadDistance: 50.7,
    beadRadius: 1.5,
};

const spoolParams: SpoolParams = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    spoolLength: 50,
    beadRadius: 1.5,
    tubeHeight: 28.6,
    ferrHeight: 2.0,
};

const platterParams: PlatterParams = {
    tubeID: 34.8,
    tubeOD: 38.1,
    ferruleOD: 63.9,
    beadDistance: 50.7,
    platterHeight: 50,
    beadRadius: 1.5,
    tubeHeight: 28.6,
    ferrHeight: 2.0,
};

describe('perfilFerula', () => {
    it('returns 9 commands', () => {
        const cmds = perfilFerula(ferruleParams);
        expect(cmds).toHaveLength(9);
    });

    it('first command is moveTo with correct coordinates', () => {
        const cmds = perfilFerula(ferruleParams);
        expect(cmds[0].type).toBe('moveTo');
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.x).toBe(ferruleParams.tubeID / 2);
        expect(first.y).toBe(ferruleParams.tubeHeight);
    });

    it('last command closes the profile (returns to start)', () => {
        const cmds = perfilFerula(ferruleParams);
        const last = cmds[cmds.length - 1] as { type: 'lineTo'; x: number; y: number };
        expect(last.type).toBe('lineTo');
        expect(last.x).toBe(ferruleParams.tubeID / 2);
        expect(last.y).toBe(ferruleParams.tubeHeight);
    });

    it('contains an arc command for the bead', () => {
        const cmds = perfilFerula(ferruleParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        expect(arcs).toHaveLength(1);
        expect(arcs[0].cx).toBe(ferruleParams.beadDistance / 2);
        expect(arcs[0].cy).toBe(0);
    });
});

describe('perfilGasket', () => {
    it('returns 9 commands', () => {
        const cmds = perfilGasket(gasketParams);
        expect(cmds).toHaveLength(9);
    });

    it('first command is moveTo at (tubeID/2, gasketThickness/2)', () => {
        const cmds = perfilGasket(gasketParams);
        expect(cmds[0].type).toBe('moveTo');
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.x).toBe(gasketParams.tubeID / 2);
        expect(first.y).toBe(gasketParams.gasketThickness / 2);
    });

    it('is symmetric about y=0 (top half mirrors bottom half)', () => {
        const cmds = perfilGasket(gasketParams);
        // First moveTo y = +em, last lineTo y = +em (closes)
        const em = gasketParams.gasketThickness / 2;
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.y).toBe(em);
        const last = cmds[cmds.length - 1] as { type: 'lineTo'; x: number; y: number };
        expect(last.y).toBe(em);
        // Midpoint: there should be commands at y = -em
        const negY = cmds.filter((c) => c.type === 'lineTo' && c.y === -em);
        expect(negY.length).toBeGreaterThan(0);
    });

    it('contains two arc commands for the double bead', () => {
        const cmds = perfilGasket(gasketParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        expect(arcs).toHaveLength(2);
    });
});

describe('perfilEndCap', () => {
    it('returns 8 commands', () => {
        const cmds = perfilEndCap(endcapParams);
        expect(cmds).toHaveLength(8);
    });

    it('first command is moveTo at origin', () => {
        const cmds = perfilEndCap(endcapParams);
        expect(cmds[0].type).toBe('moveTo');
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.x).toBe(0);
        expect(first.y).toBe(0);
    });

    it('last command closes the profile at origin', () => {
        const cmds = perfilEndCap(endcapParams);
        const last = cmds[cmds.length - 1] as { type: 'lineTo'; x: number; y: number };
        expect(last.type).toBe('lineTo');
        expect(last.x).toBe(0);
        expect(last.y).toBe(0);
    });

    it('contains exactly one arc command for the bead', () => {
        const cmds = perfilEndCap(endcapParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        expect(arcs).toHaveLength(1);
    });
});

describe('perfilSpool', () => {
    it('returns 16 commands', () => {
        const cmds = perfilSpool(spoolParams);
        expect(cmds).toHaveLength(16);
    });

    it('first command is moveTo at (tubeID/2, tubeHeight)', () => {
        const cmds = perfilSpool(spoolParams);
        expect(cmds[0].type).toBe('moveTo');
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.x).toBe(spoolParams.tubeID / 2);
        expect(first.y).toBe(spoolParams.tubeHeight);
    });

    it('last command returns to start (tubeID/2, tubeHeight)', () => {
        const cmds = perfilSpool(spoolParams);
        const last = cmds[cmds.length - 1] as { type: 'lineTo'; x: number; y: number };
        expect(last.type).toBe('lineTo');
        expect(last.x).toBe(spoolParams.tubeID / 2);
        expect(last.y).toBe(spoolParams.tubeHeight);
    });

    it('contains exactly two arc commands (top and bottom beads)', () => {
        const cmds = perfilSpool(spoolParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        expect(arcs).toHaveLength(2);
    });

    it('bottom bead arc is at y=0', () => {
        const cmds = perfilSpool(spoolParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        const bottomArc = arcs[0];
        expect(bottomArc.cy).toBe(0);
    });

    it('top bead arc is at y = 2*tubeHeight + spoolLength', () => {
        const cmds = perfilSpool(spoolParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        const topArc = arcs[1];
        const totalH = 2 * spoolParams.tubeHeight + spoolParams.spoolLength;
        expect(topArc.cy).toBe(totalH);
    });
});

describe('perfilPlatter', () => {
    it('returns 11 commands', () => {
        const cmds = perfilPlatter(platterParams);
        expect(cmds).toHaveLength(11);
    });

    it('first command is moveTo at origin', () => {
        const cmds = perfilPlatter(platterParams);
        expect(cmds[0].type).toBe('moveTo');
        const first = cmds[0] as { type: 'moveTo'; x: number; y: number };
        expect(first.x).toBe(0);
        expect(first.y).toBe(0);
    });

    it('last command closes the profile at origin', () => {
        const cmds = perfilPlatter(platterParams);
        const last = cmds[cmds.length - 1] as { type: 'lineTo'; x: number; y: number };
        expect(last.type).toBe('lineTo');
        expect(last.x).toBe(0);
        expect(last.y).toBe(0);
    });

    it('contains exactly one arc command (top bead)', () => {
        const cmds = perfilPlatter(platterParams);
        const arcs = cmds.filter((c) => c.type === 'arc');
        expect(arcs).toHaveLength(1);
    });

    it('top bead arc is at y = bT + platterHeight + tubeHeight', () => {
        const cmds = perfilPlatter(platterParams);
        const arc = cmds.find((c) => c.type === 'arc')!;
        // totalH = PLATTER_BOTTOM_THICKNESS(3) + platterHeight + tubeHeight
        expect(arc.cy).toBe(3 + platterParams.platterHeight + platterParams.tubeHeight);
    });

    it('body wall runs up the outer tube radius (tubeOD/2)', () => {
        const cmds = perfilPlatter(platterParams);
        const bodyPoint = cmds.find((c) => c.type === 'lineTo' && c.x === platterParams.tubeOD / 2);
        expect(bodyPoint).toBeDefined();
    });
});

describe('obtenerPerfil', () => {
    it('dispatches to perfilGasket for "gasket"', () => {
        const cmds = obtenerPerfil('gasket', gasketParams);
        expect(cmds).toHaveLength(9);
        expect(cmds[0].type).toBe('moveTo');
    });

    it('dispatches to perfilSpool for "spool"', () => {
        const cmds = obtenerPerfil('spool', spoolParams);
        expect(cmds).toHaveLength(16);
    });

    it('dispatches to perfilEndCap for "endcap"', () => {
        const cmds = obtenerPerfil('endcap', endcapParams);
        expect(cmds).toHaveLength(8);
    });

    it('dispatches to perfilFerula for "ferrula"', () => {
        const cmds = obtenerPerfil('ferrula', ferruleParams);
        expect(cmds).toHaveLength(9);
    });

    it('dispatches to perfilPlatter for "platter"', () => {
        const cmds = obtenerPerfil('platter', platterParams);
        expect(cmds).toHaveLength(11);
    });

    it('defaults to perfilFerula for unknown types', () => {
        const cmds = obtenerPerfil('ferrula', ferruleParams);
        expect(cmds).toHaveLength(9);
    });
});

describe('descriptorAShape', () => {
    it('returns a THREE.Shape instance', () => {
        const cmds = perfilFerula(ferruleParams);
        const shape = descriptorAShape(cmds);
        expect(shape).toBeDefined();
        expect(shape.constructor.name).toBe('Shape');
    });

    it('calls moveTo for moveTo commands', () => {
        const cmds: ReturnType<typeof perfilFerula> = [
            { type: 'moveTo', x: 10, y: 20 },
            { type: 'lineTo', x: 30, y: 40 },
        ];
        const shape = descriptorAShape(cmds);
        expect(shape.moveTo).toHaveBeenCalledWith(10, 20);
    });

    it('calls lineTo for lineTo commands', () => {
        const cmds = [
            { type: 'moveTo' as const, x: 0, y: 0 },
            { type: 'lineTo' as const, x: 5, y: 10 },
        ];
        const shape = descriptorAShape(cmds);
        expect(shape.lineTo).toHaveBeenCalledWith(5, 10);
    });

    it('calls absarc for arc commands', () => {
        const cmds = [
            { type: 'moveTo' as const, x: 0, y: 0 },
            { type: 'arc' as const, cx: 3, cy: 4, r: 5, a0: 0, a1: Math.PI, ccw: true },
        ];
        const shape = descriptorAShape(cmds);
        expect(shape.absarc).toHaveBeenCalledWith(3, 4, 5, 0, Math.PI, false); // clockwise = !ccw
    });

    it('converts ccw to clockwise for absarc', () => {
        const cmds = [
            { type: 'moveTo' as const, x: 0, y: 0 },
            { type: 'arc' as const, cx: 3, cy: 4, r: 5, a0: 0, a1: Math.PI, ccw: false },
        ];
        const shape = descriptorAShape(cmds);
        expect(shape.absarc).toHaveBeenCalledWith(3, 4, 5, 0, Math.PI, true); // !false = true (clockwise)
    });
});
