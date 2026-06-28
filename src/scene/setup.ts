import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneSetup {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
}

/**
 * Initialise the Three.js scene, camera, renderer, orbit controls
 * and a simple lighting rig. Returns all objects needed by the
 * render loop and event wiring.
 */
export function setupScene(): SceneSetup {
    const scene = new THREE.Scene();
    // Very subtle exponential fog — heavier densities would
    // obscure distant vertices on large pieces.
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.0035);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(60, 50, 70);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 15, 0);

    const gridHelper = new THREE.GridHelper(200, 80, 0x004433, 0x111111);
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    const dirLightBajo = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLightBajo.position.set(20, -90, 30);
    scene.add(dirLightBajo);

    return { scene, camera, renderer, controls };
}
