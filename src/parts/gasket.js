import * as THREE from 'three';
import { matPuntos, matLineas, matMalla, matGasketSolido } from '../scene/materials.js';

export function dibujarPerfilGasket(shape, rID, rF, rbD, bR, gasketThickness) {
    const espesorMedio = gasketThickness / 2;

    shape.moveTo(rID, espesorMedio);
    shape.lineTo(rbD - bR, espesorMedio);
    shape.absarc(rbD, espesorMedio, bR, Math.PI, 0, true);
    shape.lineTo(rF, espesorMedio);

    shape.lineTo(rF, -espesorMedio);
    shape.lineTo(rbD + bR, -espesorMedio);
    shape.absarc(rbD, -espesorMedio, bR, 0, Math.PI, true);
    shape.lineTo(rID, -espesorMedio);

    shape.lineTo(rID, espesorMedio);
}

export function generarGeometriaGasket(vista, params) {
    const { tubeID, ferruleOD, beadDistance, beadRadius, gasketThickness } = params;

    const rID = tubeID / 2;
    const rF = ferruleOD / 2;
    const rbD = beadDistance / 2;

    const perfil = new THREE.Shape();
    dibujarPerfilGasket(perfil, rID, rF, rbD, beadRadius, gasketThickness);

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
        malla = new THREE.Mesh(geometriaBase, matGasketSolido);
    }
    
    return { malla, geometriaBase };
}
