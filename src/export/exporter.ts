import { strToU8 } from 'fflate';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { state } from '../data/store.js';
import { matSolido } from '../scene/materials.js';

/** Return a kebab-case filename base from the current UI selection. */
export function getExportBaseName(): string {
    const tipo = (document.getElementById('tipoPieza') as HTMLSelectElement)?.value || 'pieza';
    const ps = document.getElementById('presetSelect') as HTMLSelectElement | null;
    let slug = 'custom';
    if (ps && ps.value !== '') {
        const t = ps.options[ps.selectedIndex]?.textContent || '';
        slug = t
            .replace(/\s*·\s*/g, '-')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        if (!slug) slug = `preset-${ps.value}`;
    }
    return `tripta-${tipo}-${slug}`;
}

/** Trigger a browser file download via a temporary anchor element. */
export function descargarArchivo(nombre: string, blob: Blob): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

/** Export the current geometry as STL/OBJ and trigger download. */
export function exportarMallaActual(): void {
    if (!state.geometriaExportacion) {
        return;
    }

    const formato = (document.getElementById('exportFormat') as HTMLSelectElement)?.value || 'stl-binary';
    const base = getExportBaseName();
    const mesh = new THREE.Mesh(state.geometriaExportacion, matSolido);
    mesh.rotation.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    if (formato === 'stl-binary') {
        const exporter = new STLExporter();
        const data = exporter.parse(mesh, { binary: true });
        const blob = new Blob([data], { type: 'application/octet-stream' });
        descargarArchivo(`${base}.stl`, blob);
        return;
    }
    if (formato === 'stl-ascii') {
        const exporter = new STLExporter();
        const text = exporter.parse(mesh, { binary: false });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        descargarArchivo(`${base}.stl`, blob);
        return;
    }
    if (formato === 'obj') {
        const exporter = new OBJExporter();
        const text = exporter.parse(mesh);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        descargarArchivo(`${base}.obj`, blob);
    }
}

export type MeshExportFormat = 'stl-binary' | 'stl-ascii' | 'obj';

export interface ExportResult {
    ext: string;
    data: Uint8Array;
}

/**
 * Export a BufferGeometry to bytes (STL or OBJ) without depending on the DOM.
 * Used by the bulk-export pipeline.
 */
export function exportGeometryBuffer(geometry: THREE.BufferGeometry, formato: MeshExportFormat): ExportResult {
    const mesh = new THREE.Mesh(geometry, matSolido);
    mesh.rotation.set(0, 0, 0);
    mesh.updateMatrixWorld(true);

    if (formato === 'stl-binary') {
        const exporter = new STLExporter();
        const raw = exporter.parse(mesh, { binary: true });
        let data: Uint8Array;
        if (raw instanceof ArrayBuffer) {
            data = new Uint8Array(raw);
        } else if (raw && typeof (raw as ArrayBufferView).byteLength === 'number' && (raw as ArrayBufferView).buffer) {
            const view = raw as ArrayBufferView;
            data = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        } else {
            data = new Uint8Array(raw);
        }
        return { ext: 'stl', data };
    }
    if (formato === 'stl-ascii') {
        const exporter = new STLExporter();
        const text = exporter.parse(mesh, { binary: false }) as string;
        return { ext: 'stl', data: strToU8(text) };
    }
    if (formato === 'obj') {
        const exporter = new OBJExporter();
        const text = exporter.parse(mesh) as string;
        return { ext: 'obj', data: strToU8(text) };
    }
    throw new Error(`Unsupported mesh format: ${formato}`);
}
