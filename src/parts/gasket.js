import * as THREE from 'three';
import { matPuntos, matLineas, matMalla, matGasketSolido } from '../scene/materials.js';
import { descriptorAShape, perfilGasket } from '../cad/profileDescriptor.js';

export function generarGeometriaGasket(vista, params) {
    const { tubeID, ferruleOD, beadDistance, beadRadius, gasketThickness } = params;

    const cmds = perfilGasket({
        tubeID, ferruleOD, beadDistance, beadRadius, gasketThickness,
    });

    const perfil = descriptorAShape(cmds);

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
