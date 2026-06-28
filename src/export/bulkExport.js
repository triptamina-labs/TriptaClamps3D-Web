import { zipSync } from 'fflate';
import { exportarCADBlob, resetOccWorker } from '../cad/bridge.js';
import { generarGeometriaEndCap } from '../parts/endcap.js';
import { generarGeometriaFerula } from '../parts/ferrule.js';
import { generarGeometriaGasket } from '../parts/gasket.js';
import { generarGeometriaSpool } from '../parts/spool.js';
import { exportGeometryBuffer } from './exporter.js';

/** @typedef {{ beadRadiusFijo: number, ferrHeightFijo: number }} BulkFixedState */

const BULK_PARTS = [
    { id: 'ferrula', folder: 'Ferrule', fileTag: 'Ferrule' },
    { id: 'gasket', folder: 'Gasket', fileTag: 'Gasket' },
    { id: 'spool', folder: 'Spool', fileTag: 'Spool' },
    { id: 'endcap', folder: 'EndCap', fileTag: 'EndCap' },
];

const VISTA_EXPORT = 'solido';
const DEFAULT_SPOOL_LENGTH = 50;
/** Reiniciar el worker OCC cada N exportaciones CAD en el mismo lote (evita corrupción MEMFS). */
const BULK_CAD_RESET_EVERY = 10;

function presetSlug(p) {
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

function buildDimsFromPreset(p) {
    return {
        tubeID: p.tubeID,
        tubeOD: p.tubeOD,
        ferruleOD: p.ferruleOD,
        beadDistance: p.beadDistance,
        spoolLength: DEFAULT_SPOOL_LENGTH,
    };
}

function clampDimensions(tipo, dims, beadRadiusFijo) {
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

/**
 * @param {object} dims
 * @param {object} preset — fila CSV
 * @param {BulkFixedState} fixed
 */
function buildParams(dims, preset, fixed) {
    const tubeHeight = Number.isFinite(preset.tubeHeightLarga) ? preset.tubeHeightLarga : 28.6;
    return {
        ...dims,
        beadRadius: fixed.beadRadiusFijo,
        tubeHeight,
        ferrHeight: fixed.ferrHeightFijo,
        gasketThickness: preset.gasketThickness,
    };
}

/**
 * @param {'ferrula'|'gasket'|'spool'|'endcap'} tipo
 * @param {object} params
 */
function generateGeometry(tipo, params) {
    if (tipo === 'gasket') return generarGeometriaGasket(VISTA_EXPORT, params).geometriaBase;
    if (tipo === 'spool') return generarGeometriaSpool(VISTA_EXPORT, params).geometriaBase;
    if (tipo === 'endcap') return generarGeometriaEndCap(VISTA_EXPORT, params).geometriaBase;
    return generarGeometriaFerula(VISTA_EXPORT, params).geometriaBase;
}

/**
 * @param {object[]} presetsList
 * @param {HTMLElement} nestEl
 */
export function renderBulkCheckboxNest(presetsList, nestEl) {
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

    nestEl.querySelectorAll('.bulk-master-cb').forEach((m) => {
        m.addEventListener('change', () => {
            const part = m.dataset.part;
            nestEl.querySelectorAll(`.bulk-preset-cb[data-tipo="${part}"]`).forEach((c) => {
                c.checked = m.checked;
            });
        });
    });
}

/**
 * @param {{ getFixedState: () => BulkFixedState, presetsList: object[] }} opts
 */
export function setupBulkDownload(opts) {
    const { getFixedState, presetsList } = opts;
    const btnToggle = document.getElementById('btnBulkToggle');
    const panel = document.getElementById('bulkPanel');
    const nest = document.getElementById('bulkNest');
    const btnRun = document.getElementById('btnBulkDownload');
    const statusEl = document.getElementById('bulkStatus');
    const formatSel = document.getElementById('bulkExportFormat');

    if (!btnToggle || !panel || !nest || !btnRun || !statusEl) return;

    renderBulkCheckboxNest(presetsList, nest);

    btnToggle.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        btnToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    btnRun.addEventListener('click', async () => {
        const cbs = [...panel.querySelectorAll('.bulk-preset-cb:checked')];
        if (cbs.length === 0) {
            statusEl.hidden = false;
            statusEl.textContent = 'Selecciona al menos una combinación parte + preset.';
            return;
        }

        const formato = formatSel?.value || 'stl-binary';
        const fixed = getFixedState();
        const lista = presetsList.length ? presetsList : [];
        /** @type {Record<string, Uint8Array>} */
        const zipEntries = {};
        const total = cbs.length;
        let done = 0;

        const isCadBulk = formato === 'step' || formato === 'brep' || formato === 'both';
        let bulkCadCount = 0;
        if (isCadBulk) {
            resetOccWorker();
        }

        btnRun.disabled = true;
        statusEl.hidden = false;
        statusEl.textContent = `Generando 0/${total}…`;

        try {
            for (const cb of cbs) {
                const tipo = cb.dataset.tipo;
                const idx = parseInt(cb.dataset.presetIndex, 10);
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
                const zipPath = (name) => `${folder}/${name}`;

                if (formato === 'stl-binary' || formato === 'stl-ascii' || formato === 'obj') {
                    const geo = generateGeometry(tipo, params);
                    try {
                        const { ext, data } = exportGeometryBuffer(geo, formato);
                        zipEntries[zipPath(`${baseFile}.${ext}`)] = data;
                    } finally {
                        geo.dispose();
                    }
                } else if (formato === 'step') {
                    if (isCadBulk && bulkCadCount > 0 && bulkCadCount % BULK_CAD_RESET_EVERY === 0) {
                        resetOccWorker();
                    }
                    bulkCadCount += 1;
                    const { step } = await exportarCADBlob(tipo, params, 'step');
                    if (step) {
                        zipEntries[zipPath(`${baseFile}.step`)] = new Uint8Array(await step.arrayBuffer());
                    }
                } else if (formato === 'brep') {
                    if (isCadBulk && bulkCadCount > 0 && bulkCadCount % BULK_CAD_RESET_EVERY === 0) {
                        resetOccWorker();
                    }
                    bulkCadCount += 1;
                    const { brep } = await exportarCADBlob(tipo, params, 'brep');
                    if (brep) {
                        zipEntries[zipPath(`${baseFile}.brep`)] = new Uint8Array(await brep.arrayBuffer());
                    }
                } else if (formato === 'both') {
                    if (isCadBulk && bulkCadCount > 0 && bulkCadCount % BULK_CAD_RESET_EVERY === 0) {
                        resetOccWorker();
                    }
                    bulkCadCount += 1;
                    const { step, brep } = await exportarCADBlob(tipo, params, 'both');
                    if (step) {
                        zipEntries[zipPath(`${baseFile}.step`)] = new Uint8Array(await step.arrayBuffer());
                    }
                    if (brep) {
                        zipEntries[zipPath(`${baseFile}.brep`)] = new Uint8Array(await brep.arrayBuffer());
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
            statusEl.textContent = `Error: ${err?.message ?? err}`;
        } finally {
            if (isCadBulk) {
                resetOccWorker();
            }
            btnRun.disabled = false;
        }
    });
}
