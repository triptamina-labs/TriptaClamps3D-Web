import * as THREE from 'three';
import type { PieceType } from '../data/store.js';

/** Discriminated union for all profile-building commands. */
export type ProfileCommand = MoveToCmd | LineToCmd | ArcCmd;

export interface MoveToCmd {
    type: 'moveTo';
    x: number;
    y: number;
}

export interface LineToCmd {
    type: 'lineTo';
    x: number;
    y: number;
}

export interface ArcCmd {
    type: 'arc';
    cx: number;
    cy: number;
    r: number;
    a0: number;
    a1: number;
    ccw: boolean;
}

/** Parameters needed by ferrule profile. */
export interface FerruleParams {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    beadRadius: number;
    tubeHeight: number;
    ferrHeight: number;
}

/** Parameters needed by gasket profile. */
export interface GasketParams {
    tubeID: number;
    ferruleOD: number;
    beadDistance: number;
    beadRadius: number;
    gasketThickness: number;
}

/** Parameters needed by end-cap profile. */
export interface EndCapParams {
    ferruleOD: number;
    beadDistance: number;
    beadRadius: number;
}

/** Parameters needed by spool profile. */
export interface SpoolParams {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    spoolLength: number;
    beadRadius: number;
    tubeHeight: number;
    ferrHeight: number;
}

/** Union of all possible per-piece parameter sets. */
export type ProfileParams = FerruleParams | GasketParams | EndCapParams | SpoolParams;

/**
 * Convert a profile descriptor (array of commands) into a THREE.Shape
 * suitable for LatheGeometry.
 */
export function descriptorAShape(cmds: ProfileCommand[]): THREE.Shape {
    const shape = new THREE.Shape();
    for (const cmd of cmds) {
        switch (cmd.type) {
            case 'moveTo':
                shape.moveTo(cmd.x, cmd.y);
                break;
            case 'lineTo':
                shape.lineTo(cmd.x, cmd.y);
                break;
            case 'arc':
                // Three.js absarc(cx, cy, r, a0, a1, clockwise)
                // clockwise = !ccw
                shape.absarc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, !cmd.ccw);
                break;
        }
    }
    return shape;
}

// ── Profile generators ──────────────────────────────────

/**
 * Ferrule profile: tube section with tapered flange and bead groove.
 */
export function perfilFerula(params: FerruleParams): ProfileCommand[] {
    const { tubeID, tubeOD, ferruleOD, beadDistance, beadRadius, tubeHeight, ferrHeight } = params;

    const rID = tubeID / 2;
    const rOD = tubeOD / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const tH = tubeHeight;
    const fH = ferrHeight;

    const anguloRad = 20 * (Math.PI / 180);
    const distX = rF - rOD;
    const subidaY = distX * Math.tan(anguloRad);
    const puntoXY = fH + subidaY;

    return [
        { type: 'moveTo', x: rID, y: tH },
        { type: 'lineTo', x: rOD, y: tH },
        { type: 'lineTo', x: rOD, y: puntoXY },
        { type: 'lineTo', x: rF, y: fH },
        { type: 'lineTo', x: rF, y: 0 },
        { type: 'lineTo', x: rbD + bR, y: 0 },
        { type: 'arc', cx: rbD, cy: 0, r: bR, a0: 0, a1: Math.PI, ccw: true },
        { type: 'lineTo', x: rID, y: 0 },
        { type: 'lineTo', x: rID, y: tH },
    ];
}

/**
 * Gasket profile: double-bead with central thickness.
 */
export function perfilGasket(params: GasketParams): ProfileCommand[] {
    const { tubeID, ferruleOD, beadDistance, beadRadius, gasketThickness } = params;

    const rID = tubeID / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const em = gasketThickness / 2;

    return [
        { type: 'moveTo', x: rID, y: em },
        { type: 'lineTo', x: rbD - bR, y: em },
        { type: 'arc', cx: rbD, cy: em, r: bR, a0: Math.PI, a1: 0, ccw: false },
        { type: 'lineTo', x: rF, y: em },
        { type: 'lineTo', x: rF, y: -em },
        { type: 'lineTo', x: rbD + bR, y: -em },
        { type: 'arc', cx: rbD, cy: -em, r: bR, a0: 0, a1: Math.PI, ccw: false },
        { type: 'lineTo', x: rID, y: -em },
        { type: 'lineTo', x: rID, y: em },
    ];
}

/** Height of the step on the outer face (mm). */
const ENDCAP_STEP_MM = 2;
/** Maximum profile height (mm). */
const ENDCAP_MAX_HEIGHT_MM = 5;
/** Acute angle of the slope relative to horizontal (degrees). */
const ENDCAP_TAPER_FROM_HORIZONTAL_DEG = 20;

/**
 * End-cap profile: flat inner face with tapered outer rim and bead.
 */
export function perfilEndCap(params: EndCapParams): ProfileCommand[] {
    const { ferruleOD, beadDistance, beadRadius } = params;

    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const stepH = ENDCAP_STEP_MM;
    const maxH = ENDCAP_MAX_HEIGHT_MM;
    const taperRad = ((180 - ENDCAP_TAPER_FROM_HORIZONTAL_DEG) * Math.PI) / 180;
    const rise = maxH - stepH;
    const sinT = Math.sin(taperRad);
    const xTop = sinT > 1e-6 ? rF + (Math.cos(taperRad) * rise) / sinT : rF;

    return [
        { type: 'moveTo', x: 0, y: 0 },
        { type: 'lineTo', x: rbD - bR, y: 0 },
        { type: 'arc', cx: rbD, cy: 0, r: bR, a0: Math.PI, a1: 0, ccw: false },
        { type: 'lineTo', x: rF, y: 0 },
        { type: 'lineTo', x: rF, y: stepH },
        { type: 'lineTo', x: xTop, y: maxH },
        { type: 'lineTo', x: 0, y: maxH },
        { type: 'lineTo', x: 0, y: 0 },
    ];
}

/**
 * Spool profile: a tube section with a ferrule-flange on each end.
 */
export function perfilSpool(params: SpoolParams): ProfileCommand[] {
    const { tubeID, tubeOD, ferruleOD, beadDistance, spoolLength, beadRadius, tubeHeight, ferrHeight } = params;

    const rID = tubeID / 2;
    const rOD = tubeOD / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const tH = tubeHeight;
    const fH = ferrHeight;
    const sL = spoolLength;

    const anguloRad = 20 * (Math.PI / 180);
    const distX = rF - rOD;
    const subidaY = distX * Math.tan(anguloRad);
    const puntoXY = fH + subidaY;
    const totalH = 2 * tH + sL;
    const topPuntoXY = totalH - (fH + subidaY);
    const topFH = totalH - fH;

    return [
        { type: 'moveTo', x: rID, y: tH },
        { type: 'lineTo', x: rID, y: 0 },
        { type: 'lineTo', x: rbD - bR, y: 0 },
        { type: 'arc', cx: rbD, cy: 0, r: bR, a0: Math.PI, a1: 0, ccw: false },
        { type: 'lineTo', x: rF, y: 0 },
        { type: 'lineTo', x: rF, y: fH },
        { type: 'lineTo', x: rOD, y: puntoXY },
        { type: 'lineTo', x: rOD, y: tH },
        { type: 'lineTo', x: rOD, y: tH + sL },
        { type: 'lineTo', x: rOD, y: topPuntoXY },
        { type: 'lineTo', x: rF, y: topFH },
        { type: 'lineTo', x: rF, y: totalH },
        { type: 'lineTo', x: rbD + bR, y: totalH },
        { type: 'arc', cx: rbD, cy: totalH, r: bR, a0: 0, a1: Math.PI, ccw: false },
        { type: 'lineTo', x: rID, y: totalH },
        { type: 'lineTo', x: rID, y: tH },
    ];
}

/**
 * Return the correct profile descriptor for the given piece type.
 * Falls back to ferrule for unknown types.
 */
export function obtenerPerfil(tipo: PieceType, params: ProfileParams): ProfileCommand[] {
    switch (tipo) {
        case 'gasket':
            return perfilGasket(params as GasketParams);
        case 'spool':
            return perfilSpool(params as SpoolParams);
        case 'endcap':
            return perfilEndCap(params as EndCapParams);
        default:
            return perfilFerula(params as FerruleParams);
    }
}
