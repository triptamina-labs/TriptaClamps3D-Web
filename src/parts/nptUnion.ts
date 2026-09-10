import * as THREE from 'three';
import type { NptUnionParams } from '../cad/profileDescriptor.js';
import { descriptorAShape, perfilNptUnion } from '../cad/profileDescriptor.js';
import { PROFILE_POINTS_NPT, SEGMENTS_DEFAULT, SEGMENTS_SOLID } from '../core/constants.js';
import type { ViewMode } from '../core/createLatheMesh.js';
import { createLatheMesh } from '../core/createLatheMesh.js';
import { matLineas, matMalla, matPuntos, matSolido } from '../scene/materials.js';

export interface NptUnionResult {
    malla: THREE.Object3D;
    geometriaBase: THREE.LatheGeometry;
}

const nptMaterials = {
    puntos: matPuntos,
    lineas: matLineas,
    malla: matMalla,
    solido: matSolido,
};

export function generarGeometriaNptUnion(vista: ViewMode, params: NptUnionParams): NptUnionResult {
    const cmds = perfilNptUnion(params);
    const perfil = descriptorAShape(cmds);
    const puntos = perfil.getPoints(PROFILE_POINTS_NPT);
    const segmentosRadiales = vista === 'solido' ? SEGMENTS_SOLID : SEGMENTS_DEFAULT;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    const malla = createLatheMesh(vista, geometriaBase, nptMaterials);
    return { malla, geometriaBase };
}
