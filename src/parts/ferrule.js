import * as THREE from 'three';
import { matPuntos, matLineas, matMalla, matSolido } from '../scene/materials.js';

export function dibujarPerfilFerula(shape, rID, rOD, rF, rbD, bR, tH, fH) {
    const anguloRadianes = 20 * (Math.PI / 180);
    const distanciaX = rF - rOD;
    const subidaY = distanciaX * Math.tan(anguloRadianes);
    const puntoX_Y = fH + subidaY;

    // Empezar en rID, tH según requerimiento
    shape.moveTo( rID, tH ); 
    shape.lineTo( rOD, tH ); 
    shape.lineTo( rOD, puntoX_Y ); 
    shape.lineTo( rF, fH ); 
    shape.lineTo( rF, 0 ); 
    shape.lineTo( rbD + bR, 0 ); 
    shape.absarc( rbD, 0, bR, 0, Math.PI, false ); 
    shape.lineTo( rID, 0 ); 
    shape.lineTo( rID, tH ); 
}

export function generarGeometriaFerula(vista, params) {
    const { tubeID, tubeOD, ferruleOD, beadDistance, beadRadius, tubeHeight, ferrHeight } = params;

    const tubeID_r = tubeID / 2;
    const tubeOD_r = tubeOD / 2;
    const ferruleOD_r = ferruleOD / 2;
    const beadDistance_r = beadDistance / 2;

    const perfil = new THREE.Shape();
    dibujarPerfilFerula(perfil, tubeID_r, tubeOD_r, ferruleOD_r, beadDistance_r, beadRadius, tubeHeight, ferrHeight);

    const puntos = perfil.getPoints(60);
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
