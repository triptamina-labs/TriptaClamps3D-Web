import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { state } from '../data/store.js';
import { matSolido } from '../scene/materials.js';

export function getExportBaseName() {
    const tipo = document.getElementById('tipoPieza')?.value || 'pieza';
    const ps = document.getElementById('presetSelect');
    let slug = 'custom';
    if (ps && ps.value !== '') {
        const t = ps.options[ps.selectedIndex]?.textContent || '';
        slug = t
            .replace(/\s*·\s*/g, '-')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        if (!slug) slug = 'preset-' + ps.value;
    }
    return `tripta-${tipo}-${slug}`;
}

export function descargarArchivo(nombre, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

export function exportarMallaActual() {
    if (!state.geometriaExportacion) {
        return;
    }

    const formato = document.getElementById('exportFormat')?.value || 'stl-binary';
    const base = getExportBaseName();
    const mesh = new THREE.Mesh(state.geometriaExportacion, matSolido);
    mesh.rotation.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    if (formato === 'stl-binary') {
        const exporter = new STLExporter();
        const data = exporter.parse(mesh, { binary: true });
        const blob = new Blob([data], { type: 'application/octet-stream' });
        descargarArchivo(base + '.stl', blob);
        return;
    }
    if (formato === 'stl-ascii') {
        const exporter = new STLExporter();
        const text = exporter.parse(mesh, { binary: false });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        descargarArchivo(base + '.stl', blob);
        return;
    }
    if (formato === 'obj') {
        const exporter = new OBJExporter();
        const text = exporter.parse(mesh);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        descargarArchivo(base + '.obj', blob);
    }
}
