import * as THREE from 'three';
import type { GasketParams } from '../cad/profileDescriptor.js';
import { descriptorAShape, perfilGasket } from '../cad/profileDescriptor.js';
import { PROFILE_POINTS_FERRULE, SEGMENTS_DEFAULT, SEGMENTS_SOLID } from '../core/constants.js';
import type { ViewMode } from '../core/createLatheMesh.js';
import { createLatheMesh } from '../core/createLatheMesh.js';
import { matGasketSolido, matLineas, matMalla, matPuntos } from '../scene/materials.js';

export interface GasketResult {
    malla: THREE.Object3D;
    geometriaBase: THREE.LatheGeometry;
}

const gasketMaterials = {
    puntos: matPuntos,
    lineas: matLineas,
    malla: matMalla,
    solido: matGasketSolido,
};

export function generarGeometriaGasket(vista: ViewMode, params: GasketParams): GasketResult {
    const cmds = perfilGasket(params);
    const perfil = descriptorAShape(cmds);
    const puntos = perfil.getPoints(PROFILE_POINTS_FERRULE);
    const segmentosRadiales = vista === 'solido' ? SEGMENTS_SOLID : SEGMENTS_DEFAULT;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    const malla = createLatheMesh(vista, geometriaBase, gasketMaterials);
    return { malla, geometriaBase };
}
