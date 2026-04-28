import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function setupScene() {
    const scene = new THREE.Scene();
    /** Niebla muy suave: densidades altas opacan piezas grandes (vértices lejanos). */
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
