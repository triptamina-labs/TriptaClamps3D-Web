import * as THREE from 'three';
import type { SpoolParams } from '../cad/profileDescriptor.js';
import { descriptorAShape, perfilSpool } from '../cad/profileDescriptor.js';
import { PROFILE_POINTS_SPOOL, SEGMENTS_DEFAULT, SEGMENTS_SOLID } from '../core/constants.js';
import type { ViewMode } from '../core/createLatheMesh.js';
import { createLatheMesh } from '../core/createLatheMesh.js';
import { matLineas, matMalla, matPuntos, matSolido } from '../scene/materials.js';

export interface SpoolResult {
    malla: THREE.Object3D;
    geometriaBase: THREE.LatheGeometry;
}

const spoolMaterials = {
    puntos: matPuntos,
    lineas: matLineas,
    malla: matMalla,
    solido: matSolido,
};

export function generarGeometriaSpool(vista: ViewMode, params: SpoolParams): SpoolResult {
    const cmds = perfilSpool(params);
    const perfil = descriptorAShape(cmds);
    const puntos = perfil.getPoints(PROFILE_POINTS_SPOOL);
    const segmentosRadiales = vista === 'solido' ? SEGMENTS_SOLID : SEGMENTS_DEFAULT;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    const malla = createLatheMesh(vista, geometriaBase, spoolMaterials);
    return { malla, geometriaBase };
}
