import * as THREE from 'three';
import type { PlatterParams } from '../cad/profileDescriptor.js';
import { descriptorAShape, perfilPlatter } from '../cad/profileDescriptor.js';
import { PROFILE_POINTS_PLATTER, SEGMENTS_DEFAULT, SEGMENTS_SOLID } from '../core/constants.js';
import type { ViewMode } from '../core/createLatheMesh.js';
import { createLatheMesh } from '../core/createLatheMesh.js';
import { matLineas, matMalla, matPuntos, matSolido } from '../scene/materials.js';

export interface PlatterResult {
    malla: THREE.Object3D;
    geometriaBase: THREE.LatheGeometry;
}

const platterMaterials = {
    puntos: matPuntos,
    lineas: matLineas,
    malla: matMalla,
    solido: matSolido,
};

export function generarGeometriaPlatter(vista: ViewMode, params: PlatterParams): PlatterResult {
    const cmds = perfilPlatter(params);
    const perfil = descriptorAShape(cmds);
    const puntos = perfil.getPoints(PROFILE_POINTS_PLATTER);
    const segmentosRadiales = vista === 'solido' ? SEGMENTS_SOLID : SEGMENTS_DEFAULT;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    const malla = createLatheMesh(vista, geometriaBase, platterMaterials);
    return { malla, geometriaBase };
}
