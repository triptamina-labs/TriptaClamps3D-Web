import { zipSync } from 'fflate';
import type * as THREE from 'three';
import { exportarCADBlob, resetOccWorker } from '../cad/bridge.js';
import type { PieceType, PresetRow } from '../data/store.js';
import { generarGeometriaEndCap } from '../parts/endcap.js';
import { generarGeometriaFerula } from '../parts/ferrule.js';
import { generarGeometriaGasket } from '../parts/gasket.js';
import { generarGeometriaSpool } from '../parts/spool.js';
import type { MeshExportFormat } from './exporter.js';
import { exportGeometryBuffer } from './exporter.js';

export interface BulkFixedState {
    beadRadiusFijo: number;
    ferrHeightFijo: number;
}

interface BulkPartMeta {
    id: PieceType;
    folder: string;
    fileTag: string;
}

type BulkExportFormat = MeshExportFormat | 'step' | 'brep' | 'both';

interface Dimensions {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    spoolLength: number;
}

interface BulkParams extends Dimensions {
    beadRadius: number;
    tubeHeight: number;
    ferrHeight: number;
    gasketThickness: number;
}

const BULK_PARTS: BulkPartMeta[] = [
    { id: 'ferrula', folder: 'Ferrule', fileTag: 'Ferrule' },
    { id: 'gasket', folder: 'Gasket', fileTag: 'Gasket' },
    { id: 'spool', folder: 'Spool', fileTag: 'Spool' },
    { id: 'endcap', folder: 'EndCap', fileTag: 'EndCap' },
];

const VISTA_EXPORT = 'solido';
const DEFAULT_SPOOL_LENGTH = 50;
const BULK_CAD_RESET_EVERY = 10;

function presetSlug(p: PresetRow): string {
    const raw = `${p.preset || ''}`.trim();
    return (
        raw
            .replace(/"/g, 'in')
            .replace(/\s*·\s*/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 'preset'
    );
}

function buildDimsFromPreset(p: PresetRow): Dimensions {
    return {
        tubeID: p.tubeID,
        tubeOD: p.tubeOD,
        ferruleOD: p.ferruleOD,
        beadDistance: p.beadDistance,
        spoolLength: DEFAULT_SPOOL_LENGTH,
    };
}

function clampDimensions(tipo: PieceType, dims: Dimensions, beadRadiusFijo: number): Dimensions {
    const bR = beadRadiusFijo;
    const d = { ...dims };
    if (tipo === 'gasket') {
        if (d.ferruleOD < d.tubeID + 5) d.ferruleOD = d.tubeID + 5;
        const minBD = d.tubeID + bR * 2 + 0.5;
        const maxBD = d.ferruleOD - bR * 2 - 0.5;
        if (d.beadDistance < minBD) d.beadDistance = minBD;
        if (d.beadDistance > maxBD) d.beadDistance = maxBD;
    } else if (tipo === 'endcap') {
        const eps = 0.2;
        let rF = d.ferruleOD / 2;
        let rbD = d.beadDistance / 2;
        if (rbD - bR < eps) {
            rbD = bR + eps;
            d.beadDistance = 2 * rbD;
        }
        if (rbD + bR > rF - eps) {
            rbD = rF - bR - eps;
            d.beadDistance = 2 * rbD;
        }
        if (rbD - bR < eps) {
            rbD = bR + eps;
            d.beadDistance = 2 * rbD;
            rF = rbD + bR + eps;
            d.ferruleOD = 2 * rF;
        }
    } else {
        if (d.tubeOD <= d.tubeID + 1) d.tubeOD = d.tubeID + 1;
        if (d.ferruleOD <= d.tubeOD + 2) d.ferruleOD = d.tubeOD + 2;
        if (d.beadDistance - bR * 2 <= d.tubeOD) {
            d.beadDistance = d.tubeOD + bR * 2 + 0.2;
        }
        if (d.beadDistance + bR * 2 >= d.ferruleOD) {
            d.beadDistance = d.ferruleOD - bR * 2 - 0.2;
        }
    }
    return d;
}

function buildParams(dims: Dimensions, preset: PresetRow, fixed: BulkFixedState): BulkParams {
    const tubeHeight = Number.isFinite(preset.tubeHeightLarga) ? preset.tubeHeightLarga : 28.6;
    return {
        ...dims,
        beadRadius: fixed.beadRadiusFijo,
        tubeHeight,
        ferrHeight: fixed.ferrHeightFijo,
        gasketThickness: preset.gasketThickness,
    };
}

function generateGeometry(tipo: PieceType, params: BulkParams): THREE.BufferGeometry {
    if (tipo === 'gasket') return generarGeometriaGasket(VISTA_EXPORT, params).geometriaBase;
    if (tipo === 'spool') return generarGeometriaSpool(VISTA_EXPORT, params).geometriaBase;
    if (tipo === 'endcap') return generarGeometriaEndCap(VISTA_EXPORT, params).geometriaBase;
    return generarGeometriaFerula(VISTA_EXPORT, params).geometriaBase;
}

/** Render the bulk-export checklist in the DOM. */
export function renderBulkCheckboxNest(presetsList: PresetRow[], nestEl: HTMLElement): void {
    nestEl.innerHTML = '';
    for (const part of BULK_PARTS) {
        const fs = document.createElement('fieldset');
        fs.className = 'bulk-fieldset';

        const leg = document.createElement('legend');
        leg.className = 'bulk-legend';
        leg.textContent = part.folder;

        const master = document.createElement('label');
        master.className = 'bulk-master';
        const masterCb = document.createElement('input');
        masterCb.type = 'checkbox';
        masterCb.className = 'bulk-master-cb';
        masterCb.dataset.part = part.id;
        const masterSpan = document.createElement('span');
        masterSpan.textContent = 'Marcar todas';
        master.append(masterCb, document.createTextNode(' '), masterSpan);

        const list = document.createElement('div');
        list.className = 'bulk-preset-list';

        presetsList.forEach((p, i) => {
            const lab = document.createElement('label');
            lab.className = 'bulk-check-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'bulk-preset-cb';
            cb.dataset.tipo = part.id;
            cb.dataset.presetIndex = String(i);
            const span = document.createElement('span');
            span.textContent = `${p.preset} · ${p.dn}`;
            lab.append(cb, document.createTextNode(' '), span);
            list.appendChild(lab);
        });

        fs.append(leg, master, list);
        nestEl.appendChild(fs);
    }

    nestEl.querySelectorAll<HTMLInputElement>('.bulk-master-cb').forEach((m) => {
        m.addEventListener('change', () => {
            const part = m.dataset.part;
            nestEl.querySelectorAll<HTMLInputElement>(`.bulk-preset-cb[data-tipo="${part}"]`).forEach((c) => {
                c.checked = m.checked;
            });
        });
    });
}

export interface BulkDownloadOptions {
    getFixedState: () => BulkFixedState;
    presetsList: PresetRow[];
}

/** Setup the bulk download modal including its run button handler. */
export function setupBulkDownload(opts: BulkDownloadOptions): void {
    const { getFixedState, presetsList } = opts;
    const btnToggle = document.getElementById('btnBulkToggle');
    const panel = document.getElementById('bulkPanel');
    const nest = document.getElementById('bulkNest');
    const btnRun = document.getElementById('btnBulkDownload');
    const statusEl = document.getElementById('bulkStatus');
    const formatSel = document.getElementById('bulkExportFormat') as HTMLSelectElement | null;

    if (!btnToggle || !panel || !nest || !btnRun || !statusEl) return;

    renderBulkCheckboxNest(presetsList, nest);

    btnToggle.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        btnToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    btnRun.addEventListener('click', async () => {
        const cbs = [...panel.querySelectorAll<HTMLInputElement>('.bulk-preset-cb:checked')];
        if (cbs.length === 0) {
            statusEl.hidden = false;
            statusEl.textContent = 'Selecciona al menos una combinación parte + preset.';
            return;
        }

        const formato = (formatSel?.value as BulkExportFormat) || 'stl-binary';
        const fixed = getFixedState();
        const lista = presetsList.length ? presetsList : [];
        const zipEntries: Record<string, Uint8Array> = {};
        const total = cbs.length;
        let done = 0;

        const isCadBulk = formato === 'step' || formato === 'brep' || formato === 'both';
        let bulkCadCount = 0;
        if (isCadBulk) {
            resetOccWorker();
        }

        (btnRun as HTMLButtonElement).disabled = true;
        statusEl.hidden = false;
        statusEl.textContent = `Generando 0/${total}…`;

        try {
            for (const cb of cbs) {
                const tipo = cb.dataset.tipo as PieceType | undefined;
                const idx = parseInt(cb.dataset.presetIndex ?? '', 10);
                const preset = lista[idx];
                if (!preset || !tipo) continue;

                const partMeta = BULK_PARTS.find((p) => p.id === tipo);
                if (!partMeta) continue;

                const { folder, fileTag } = partMeta;
                const slug = presetSlug(preset);
                const baseFile = `TriClamp-${fileTag}-${slug}`;

                let dims = buildDimsFromPreset(preset);
                dims = clampDimensions(tipo, dims, fixed.beadRadiusFijo);
                const params = buildParams(dims, preset, fixed);
                const zipPath = (name: string) => `${folder}/${name}`;

                if (formato === 'stl-binary' || formato === 'stl-ascii' || formato === 'obj') {
                    const geo = generateGeometry(tipo, params);
                    try {
                        const { ext, data } = exportGeometryBuffer(geo, formato as MeshExportFormat);
                        zipEntries[zipPath(`${baseFile}.${ext}`)] = data;
                    } finally {
                        geo.dispose();
                    }
                } else {
                    // CAD export: step, brep, or both
                    if (isCadBulk && bulkCadCount > 0 && bulkCadCount % BULK_CAD_RESET_EVERY === 0) {
                        resetOccWorker();
                    }
                    bulkCadCount += 1;
                    const cadResult = await exportarCADBlob(tipo, params, formato);
                    if (cadResult.step) {
                        zipEntries[zipPath(`${baseFile}.step`)] = new Uint8Array(await cadResult.step.arrayBuffer());
                    }
                    if (cadResult.brep) {
                        zipEntries[zipPath(`${baseFile}.brep`)] = new Uint8Array(await cadResult.brep.arrayBuffer());
                    }
                }

                done += 1;
                statusEl.textContent = `Generando ${done}/${total}…`;
            }

            const nFiles = Object.keys(zipEntries).length;
            if (nFiles === 0) {
                statusEl.textContent = 'No se generó ningún archivo (revisa el formato o los datos).';
                return;
            }

            const zipped = zipSync(zipEntries, { level: 6 });
            const blob = new Blob([zipped], { type: 'application/zip' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `tripta-lote-${Date.now()}.zip`;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            statusEl.textContent = `Listo: ${nFiles} archivo(s) en el ZIP.`;
        } catch (err) {
            console.error(err);
            statusEl.textContent = `Error: ${(err as Error)?.message ?? err}`;
        } finally {
            if (isCadBulk) {
                resetOccWorker();
            }
            (btnRun as HTMLButtonElement).disabled = false;
        }
    });
}
