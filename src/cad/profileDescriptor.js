/**
 * Perfil como array de comandos independientes de Three.js.
 * Tipos: { type: 'moveTo', x, y }
 *        { type: 'lineTo', x, y }
 *        { type: 'arc', cx, cy, r, a0, a1, ccw }
 *          cx/cy = centro, r = radio, a0/a1 = ángulos en radianes,
 *          ccw = true → antihorario (standard math),
 *          ccw = false → horario (clockwise, como Three.js absarc clockwise=true)
 *
 * Conversión: descriptorAShape(cmds) → THREE.Shape, para que los parts/.js
 * sigan usando LatheGeometry sin cambio externo.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Conversión de descriptor → THREE.Shape
// ---------------------------------------------------------------------------

export function descriptorAShape(cmds) {
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

// ---------------------------------------------------------------------------
// Descriptores de perfil
// ---------------------------------------------------------------------------

export function perfilFerula(params) {
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

    // El arco del bead: absarc(rbD, 0, bR, 0, π, false) → ccw=true
    // Punto inicio arco (a0=0): (rbD + bR, 0)
    // Punto fin arco   (a1=π): (rbD - bR, 0)
    // Pasa por el tope (rbD, bR)

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

export function perfilGasket(params) {
    const { tubeID, ferruleOD, beadDistance, beadRadius, gasketThickness } = params;

    const rID = tubeID / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;
    const bR = beadRadius;
    const em = gasketThickness / 2; // espesor medio

    // Arco superior: absarc(rbD, em, bR, π, 0, true) → ccw=false
    // De (rbD-bR, em) a (rbD+bR, em) pasando por el tope (rbD, em+bR)
    //
    // Arco inferior: absarc(rbD, -em, bR, 0, π, true) → ccw=false
    // De (rbD+bR, -em) a (rbD-bR, -em) pasando por el fondo (rbD, -em-bR)

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

/** Altura del escalón en la cara exterior (mm). */
const ENDCAP_STEP_MM = 2;
/** Altura máxima del perfil (mm). */
const ENDCAP_MAX_HEIGHT_MM = 5;
/** Ángulo agudo de la pendiente respecto a la horizontal (grados). Recta hacia arriba-izquierda: (180 − este valor)° desde +X. */
const ENDCAP_TAPER_FROM_HORIZONTAL_DEG = 20;

export function perfilEndCap(params) {
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

export function perfilSpool(params) {
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

    // Arco bead inferior: absarc(rbD, 0, bR, π, 0, true) → ccw=false
    // De (rbD-bR, 0) a (rbD+bR, 0) pasando por (rbD, bR)
    //
    // Arco bead superior: absarc(rbD, totalH, bR, 0, π, true) → ccw=false
    // De (rbD+bR, totalH) a (rbD-bR, totalH) pasando por (rbD, totalH-bR)

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
 * Devuelve el descriptor correcto según el tipo de pieza.
 * @param {'ferrula'|'gasket'|'spool'|'endcap'} tipo
 * @param {object} params
 */
export function obtenerPerfil(tipo, params) {
    switch (tipo) {
        case 'gasket':
            return perfilGasket(params);
        case 'spool':
            return perfilSpool(params);
        case 'endcap':
            return perfilEndCap(params);
        default:
            return perfilFerula(params);
    }
}
