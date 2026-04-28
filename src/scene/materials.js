import * as THREE from 'three';

export const matPuntos = new THREE.PointsMaterial({
    color: 0xeeeeee,
    size: 0.18,
    sizeAttenuation: true
});

export const matLineas = new THREE.LineBasicMaterial({ color: 0xeeeeee });

export const matMalla = new THREE.MeshBasicMaterial({
    color: 0xeeeeee,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
});

export const matSolido = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.8,
    roughness: 0.3,
    side: THREE.DoubleSide,
    flatShading: true
});

export const matGasketSolido = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide
});

export function updateMaterialsColor(hex) {
    const c = Number(hex);
    if (!Number.isFinite(c) || c < 0 || c > 0xffffff) return;
    matPuntos.color.setHex(c);
    matLineas.color.setHex(c);
    matMalla.color.setHex(c);
}
