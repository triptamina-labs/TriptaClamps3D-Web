import * as THREE from 'three';
import { descriptorAShape, perfilSpool } from '../cad/profileDescriptor.js';
import { matLineas, matMalla, matPuntos, matSolido } from '../scene/materials.js';

export function generarGeometriaSpool(vista, params) {
    const { tubeID, tubeOD, ferruleOD, beadDistance, spoolLength, beadRadius, tubeHeight, ferrHeight } = params;

    const cmds = perfilSpool({
        tubeID,
        tubeOD,
        ferruleOD,
        beadDistance,
        spoolLength,
        beadRadius,
        tubeHeight,
        ferrHeight,
    });

    const perfil = descriptorAShape(cmds);

    const puntos = perfil.getPoints(80);
    const segmentosRadiales = vista === 'solido' ? 128 : 64;
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
