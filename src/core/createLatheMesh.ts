import * as THREE from 'three';
import { EDGES_GEOMETRY_THRESHOLD } from './constants.js';

export {
    EDGES_GEOMETRY_THRESHOLD,
    PROFILE_POINTS_FERRULE,
    PROFILE_POINTS_SPOOL,
    SEGMENTS_DEFAULT,
    SEGMENTS_SOLID,
} from './constants.js';

/** Materials map indexed by view mode. Gasket uses `matGasketSolido` for `solido`. */
export interface ViewMaterials {
    puntos: THREE.PointsMaterial;
    lineas: THREE.LineBasicMaterial;
    malla: THREE.MeshBasicMaterial;
    solido: THREE.MeshStandardMaterial;
}

/**
 * View mode identifiers corresponding to the UI radio group.
 */
export type ViewMode = 'puntos' | 'lineas' | 'malla' | 'solido';

/**
 * Factory: given a view mode, a LatheGeometry, and a materials map,
 * return the appropriate THREE.Object3D (Points, LineSegments, or Mesh).
 *
 * Eliminates 4× nearly identical if/else chains in parts/.
 */
export function createLatheMesh(
    vista: ViewMode,
    geometry: THREE.LatheGeometry,
    materials: ViewMaterials,
): THREE.Object3D {
    switch (vista) {
        case 'puntos':
            return new THREE.Points(geometry, materials.puntos);
        case 'lineas': {
            const geometriaBordes = new THREE.EdgesGeometry(geometry, EDGES_GEOMETRY_THRESHOLD);
            return new THREE.LineSegments(geometriaBordes, materials.lineas);
        }
        case 'malla':
            return new THREE.Mesh(geometry, materials.malla);
        case 'solido':
            return new THREE.Mesh(geometry, materials.solido);
    }
}
