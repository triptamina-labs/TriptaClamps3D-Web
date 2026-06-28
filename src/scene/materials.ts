import * as THREE from 'three';

export const matPuntos: THREE.PointsMaterial = new THREE.PointsMaterial({
    color: 0xeeeeee,
    size: 0.18,
    sizeAttenuation: true,
});

export const matLineas: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({ color: 0xeeeeee });

export const matMalla: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
    color: 0xeeeeee,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
});

export const matSolido: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.8,
    roughness: 0.3,
    side: THREE.DoubleSide,
    flatShading: true,
});

export const matGasketSolido: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
});

/**
 * Apply a hex colour value to the three configurable "technical-view"
 * materials: points, lines, and wireframe.
 */
export function updateMaterialsColor(hex: number): void {
    if (!Number.isFinite(hex) || hex < 0 || hex > 0xffffff) return;
    matPuntos.color.setHex(hex);
    matLineas.color.setHex(hex);
    matMalla.color.setHex(hex);
}
