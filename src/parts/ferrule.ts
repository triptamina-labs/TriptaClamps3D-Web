import * as THREE from 'three';
import type { FerruleParams } from '../cad/profileDescriptor.js';
import { descriptorAShape, perfilFerula } from '../cad/profileDescriptor.js';
import { PROFILE_POINTS_FERRULE, SEGMENTS_DEFAULT, SEGMENTS_SOLID } from '../core/constants.js';
import type { ViewMode } from '../core/createLatheMesh.js';
import { createLatheMesh } from '../core/createLatheMesh.js';
import { matLineas, matMalla, matPuntos, matSolido } from '../scene/materials.js';

export interface FerruleResult {
    malla: THREE.Object3D;
    geometriaBase: THREE.LatheGeometry;
}

const ferruleMaterials = {
    puntos: matPuntos,
    lineas: matLineas,
    malla: matMalla,
    solido: matSolido,
};

export function generarGeometriaFerula(vista: ViewMode, params: FerruleParams): FerruleResult {
    const cmds = perfilFerula(params);
    const perfil = descriptorAShape(cmds);
    const puntos = perfil.getPoints(PROFILE_POINTS_FERRULE);
    const segmentosRadiales = vista === 'solido' ? SEGMENTS_SOLID : SEGMENTS_DEFAULT;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    const malla = createLatheMesh(vista, geometriaBase, ferruleMaterials);
    return { malla, geometriaBase };
}
