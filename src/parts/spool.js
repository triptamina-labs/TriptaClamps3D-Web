import * as THREE from 'three';
import { matPuntos, matLineas, matMalla, matSolido } from '../scene/materials.js';

export function dibujarPerfilSpool(shape, rID, rOD, rF, rbD, bR, tH, fH, sL) {
    const anguloRadianes = 20 * (Math.PI / 180);
    const distanciaX = rF - rOD;
    const subidaY = distanciaX * Math.tan(anguloRadianes);
    const puntoX_Y = fH + subidaY;
    const totalH = (2 * tH) + sL;

    // 1. Férula inferior (exterior)
    shape.moveTo( rID, tH );
    shape.lineTo( rID, 0 );
    shape.lineTo( rbD - bR, 0 );
    shape.absarc( rbD, 0, bR, Math.PI, 0, true );
    shape.lineTo( rF, 0 );
    shape.lineTo( rF, fH );
    shape.lineTo( rOD, puntoX_Y );
    shape.lineTo( rOD, tH );

    // 2. Tubo central (exterior)
    shape.lineTo( rOD, tH + sL );

    // 3. Férula superior (invertida)
    const topPuntoX_Y = totalH - (fH + subidaY);
    const topFH = totalH - fH;

    shape.lineTo( rOD, topPuntoX_Y );
    shape.lineTo( rF, topFH );
    shape.lineTo( rF, totalH );
    shape.lineTo( rbD + bR, totalH );
    shape.absarc( rbD, totalH, bR, 0, Math.PI, true );
    shape.lineTo( rID, totalH );

    // 4. Pared interior (regreso al punto de inicio)
    shape.lineTo( rID, tH );
}

export function generarGeometriaSpool(vista, params) {
    const { tubeID, tubeOD, ferruleOD, beadDistance, spoolLength, beadRadius, tubeHeight, ferrHeight } = params;

    const tubeID_r = tubeID / 2;
    const tubeOD_r = tubeOD / 2;
    const ferruleOD_r = ferruleOD / 2;
    const beadDistance_r = beadDistance / 2;

    const perfil = new THREE.Shape();
    dibujarPerfilSpool(perfil, tubeID_r, tubeOD_r, ferruleOD_r, beadDistance_r, beadRadius, tubeHeight, ferrHeight, spoolLength);

    const puntos = perfil.getPoints(80);
    const segmentosRadiales = (vista === 'solido') ? 128 : 64; 
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales); 
    
    let malla;
    if (vista === 'puntos') {
        malla = new THREE.Points(geometriaBase, matPuntos);
    } else if (vista === 'lineas') {
        const geometriaBordes = new THREE.EdgesGeometry(geometriaBase, 0.1);
        malla = new THREE.LineSegments(geometriaBordes, matLineas);
    } else if (vista === 'malla') {
        malla = new THREE.Mesh(geometriaBase, matMalla);
    } else if (vista === 'solido') {
        malla = new THREE.Mesh(geometriaBase, matSolido);
    }
    
    return { malla, geometriaBase };
}
