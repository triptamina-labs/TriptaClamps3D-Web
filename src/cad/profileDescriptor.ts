import * as THREE from 'three';
import {
    NPT_CREST_FLAT,
    NPT_E1_14,
    NPT_FLANK_ANGLE_DEG,
    NPT_L2_14,
    NPT_PITCH_14,
    NPT_ROOT_FLAT,
    NPT_TAPER_PER_MM,
    NPT_THREAD_HEIGHT_14,
    PLATTER_BOTTOM_THICKNESS,
} from '../core/constants.js';
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

/** Parameters needed by platter profile. */
export interface PlatterParams {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    platterHeight: number;
    beadRadius: number;
    tubeHeight: number;
    ferrHeight: number;
}

/** Parameters needed by NPT union profile. */
export interface NptUnionParams {
    bodyOD: number;
    bodyLength: number;
    bore: number;
}

/** Union of all possible per-piece parameter sets. */
export type ProfileParams = FerruleParams | GasketParams | EndCapParams | SpoolParams | PlatterParams | NptUnionParams;

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
 * Platter (vessel) profile: a tube body with a flat closed bottom
 * and a single ferrule-flange on top. Like a spool's top half but
 * the bottom is closed by a flat plate. `platterHeight` is the body
 * length (analogous to `spoolLength`); the top collar uses `tubeHeight`
 * so the férula corta/larga toggle changes the overall height.
 */
export function perfilPlatter(params: PlatterParams): ProfileCommand[] {
    const { tubeID, tubeOD, ferruleOD, beadDistance, platterHeight, beadRadius, tubeHeight, ferrHeight } = params;

    const rID = tubeID / 2;
    const rOD = tubeOD / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const bT = PLATTER_BOTTOM_THICKNESS;
    const pH = platterHeight;
    const tH = tubeHeight;
    const fH = ferrHeight;

    const anguloRad = 20 * (Math.PI / 180);
    const distX = rF - rOD;
    const subidaY = distX * Math.tan(anguloRad);
    const bodyTop = bT + pH;
    const totalH = bodyTop + tH;
    const topFH = totalH - fH;
    const topPuntoXY = totalH - (fH + subidaY);

    return [
        { type: 'moveTo', x: 0, y: 0 },
        { type: 'lineTo', x: rOD, y: 0 },
        { type: 'lineTo', x: rOD, y: topPuntoXY },
        { type: 'lineTo', x: rF, y: topFH },
        { type: 'lineTo', x: rF, y: totalH },
        { type: 'lineTo', x: rbD + bR, y: totalH },
        { type: 'arc', cx: rbD, cy: totalH, r: bR, a0: 0, a1: Math.PI, ccw: false },
        { type: 'lineTo', x: rID, y: totalH },
        { type: 'lineTo', x: rID, y: bT },
        { type: 'lineTo', x: 0, y: bT },
        { type: 'lineTo', x: 0, y: 0 },
    ];
}

/**
 * NPT 1/4" female union (round body, no hex).
 * Internal threads on both ends, smooth cylindrical exterior.
 * Straight threads (no taper) for simplicity.
 *
 * Cross-section = the MATERIAL wall: from the inner bore (with thread
 * grooves at both mouths) out to the smooth cylindrical body OD.
 * y-axis = axis of revolution; x-axis = radius.
 */
export function perfilNptUnion(params: NptUnionParams): ProfileCommand[] {
    const { bodyOD, bodyLength } = params;

    const pitch = NPT_PITCH_14;
    const L2 = NPT_L2_14;
    const h = NPT_THREAD_HEIGHT_14;
    const flatCrest = NPT_CREST_FLAT;
    const flatRoot = NPT_ROOT_FLAT;
    const flankAngleRad = (NPT_FLANK_ANGLE_DEG / 2) * (Math.PI / 180);
    const flankRun = h * Math.tan(flankAngleRad);

    const nThreads = Math.floor(L2 / pitch);

    // Straight thread: constant root radius, V dips inward to crest
    const rootR = NPT_E1_14 / 2; // 6.2435 mm (bore at thread roots)
    const crestR = rootR - h; // 5.1145 mm (thread crests, closer to axis)
    const rBody = bodyOD / 2;

    // Inner surface path, y increasing from left mouth to right mouth.
    // Threads are mirrored about the longitudinal center.
    const inner: { x: number; y: number }[] = [];
    const pushThread = (cx: number) => {
        inner.push({ x: rootR, y: cx - flankRun - flatRoot / 2 });
        inner.push({ x: crestR, y: cx - flatCrest / 2 });
        inner.push({ x: crestR, y: cx + flatCrest / 2 });
        inner.push({ x: rootR, y: cx + flankRun + flatRoot / 2 });
    };
    const threadStart = flankRun + flatRoot / 2; // first flank begins at y = 0
    for (let i = 0; i < nThreads; i++) pushThread(threadStart + i * pitch);
    for (let i = nThreads - 1; i >= 0; i--) pushThread(bodyLength - threadStart - i * pitch);

    const cmds: ProfileCommand[] = [];
    cmds.push({ type: 'moveTo', x: inner[0].x, y: inner[0].y });
    for (let i = 1; i < inner.length; i++) {
        cmds.push({ type: 'lineTo', x: inner[i].x, y: inner[i].y });
    }
    // Right mouth: inside → out to body OD
    cmds.push({ type: 'lineTo', x: rBody, y: bodyLength });
    // Outer wall back to the left mouth
    cmds.push({ type: 'lineTo', x: rBody, y: 0 });
    // Left mouth: close back to the inner surface start
    cmds.push({ type: 'lineTo', x: inner[0].x, y: 0 });

    return cmds;
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
        case 'platter':
            return perfilPlatter(params as PlatterParams);
        case 'nptUnion':
            return perfilNptUnion(params as NptUnionParams);
        default:
            return perfilFerula(params as FerruleParams);
    }
}
