import type * as THREE from 'three';
import { exportarCAD } from './cad/bridge.js';
import type { NptUnionParams, ProfileParams } from './cad/profileDescriptor.js';
import { validateAndClampDimensions } from './core/constraints.js';
import type { ViewMode } from './core/createLatheMesh.js';
import type { NptSize } from './data/nptSizes.js';
import { fetchNptSizes, getNptSizes, NPT_DEFAULT_INDEX } from './data/nptSizes.js';
import { fetchPresetsData } from './data/presets.js';
import type { PieceType } from './data/store.js';
import {
    setAplicandoPreset,
    setCadParams,
    setGasketThicknessFijo,
    setGeometriaExportacion,
    setObjetoActual,
    setTubeHeightFijo,
    state,
} from './data/store.js';
import { setupBulkDownload } from './export/bulkExport.js';
import { exportarMallaActual } from './export/exporter.js';
import { generarGeometriaEndCap } from './parts/endcap.js';
import { generarGeometriaFerula } from './parts/ferrule.js';
import { generarGeometriaGasket } from './parts/gasket.js';
import { generarGeometriaNptUnion } from './parts/nptUnion.js';
import { generarGeometriaPlatter } from './parts/platter.js';
import { generarGeometriaSpool } from './parts/spool.js';
import { updateMaterialsColor } from './scene/materials.js';
import { setupScene } from './scene/setup.js';
import {
    aplicarLongitudesASMEDesdePreset,
    aplicarTipoFerrulaUI,
    displayLoadState,
    getModoVista,
    getTipoPieza,
    populatePresetsSelect,
    readDOMDimensions,
    setCustomSlidersVisible,
    setSliderValue,
    syncFerrulaLengthChipsActive,
    syncPresetNota,
    syncVistaChips,
    writeDOMDimensions,
} from './ui/dom.js';

// ── Scene setup ─────────────────────────────────────────

const { scene, camera, renderer, controls } = setupScene();

// ── NPT sizes (fixed, no editable parameters) ───────────

function populateNptSelect(): void {
    const sel = document.getElementById('presetSelect') as HTMLSelectElement | null;
    if (!sel) return;
    const label = document.getElementById('presetLabel');
    if (label) label.textContent = 'Medida NPT (fija)';
    const sizes = getNptSizes();
    sel.innerHTML = '';
    sizes.forEach((s, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${s.preset} NPT · ${s.tpi} TPI`;
        sel.appendChild(opt);
    });
    const def = Math.min(NPT_DEFAULT_INDEX, Math.max(0, sizes.length - 1));
    sel.value = String(def);
}

function getSelectedNptSize(): NptSize {
    const sizes = getNptSizes();
    const i = getSelectedNptSizeIndex();
    return sizes[i] ?? sizes[0];
}

function getSelectedNptSizeIndex(): number {
    const sel = document.getElementById('presetSelect') as HTMLSelectElement | null;
    const idx = sel ? parseInt(sel.value, 10) : Number.NaN;
    return Number.isFinite(idx) ? idx : NPT_DEFAULT_INDEX;
}

/** Show the selected NPT size's note in the preset-note slot. */
function syncNptNota(): void {
    const el = document.getElementById('presetNota');
    if (!el) return;
    const txt = (getSelectedNptSize().notaPerfil || '').trim();
    if (txt) {
        el.textContent = txt;
        el.removeAttribute('hidden');
    } else {
        el.textContent = '';
        el.setAttribute('hidden', '');
    }
}

/** ASME preset index to restore when leaving the NPT piece type. */
let lastAsmePresetIndex = 0;

// ── Core functions ──────────────────────────────────────

function renderPiece() {
    const vista = getModoVista() as ViewMode;
    const tipoPieza = getTipoPieza() as PieceType;
    const dims = readDOMDimensions();
    const clamped = validateAndClampDimensions(tipoPieza, dims, state.beadRadiusFijo);
    writeDOMDimensions(clamped);
    const params = {
        ...clamped,
        beadRadius: state.beadRadiusFijo,
        tubeHeight: state.tubeHeightFijo,
        ferrHeight: state.ferrHeightFijo,
        gasketThickness: state.gasketThicknessFijo,
    };

    let result: { malla: THREE.Object3D; geometriaBase: THREE.LatheGeometry };
    let nptParams: NptUnionParams | null = null;
    if (tipoPieza === 'gasket') result = generarGeometriaGasket(vista, params);
    else if (tipoPieza === 'spool') result = generarGeometriaSpool(vista, params);
    else if (tipoPieza === 'endcap') result = generarGeometriaEndCap(vista, params);
    else if (tipoPieza === 'platter') result = generarGeometriaPlatter(vista, params);
    else if (tipoPieza === 'nptUnion') {
        nptParams = getSelectedNptSize();
        result = generarGeometriaNptUnion(vista, nptParams);
    } else result = generarGeometriaFerula(vista, params);

    if (state.objetoActual) {
        scene.remove(state.objetoActual);
        (state.objetoActual as THREE.Mesh).geometry.dispose();
    }
    setGeometriaExportacion(result.geometriaBase);
    setObjetoActual(result.malla);
    setCadParams(tipoPieza, (nptParams ?? params) as unknown as Record<string, number>);
    scene.add(result.malla);
}

function actualizarVisibilidadTipoPieza() {
    const tipo = getTipoPieza();
    const presetVal = (document.getElementById('presetSelect') as HTMLSelectElement).value;
    const esFerrula = tipo === 'ferrula',
        esGasket = tipo === 'gasket',
        esSpool = tipo === 'spool',
        esEndcap = tipo === 'endcap',
        esPlatter = tipo === 'platter',
        esNptUnion = tipo === 'nptUnion',
        esCustom = presetVal === '';

    document.querySelectorAll<HTMLElement>('.solo-ferrula').forEach((el) => {
        el.style.display = esFerrula || esSpool || esPlatter ? '' : 'none';
    });
    document.querySelectorAll<HTMLElement>('.omit-endcap').forEach((el) => {
        el.style.display = esEndcap ? 'none' : '';
    });
    document.querySelectorAll<HTMLElement>('.solo-gasket').forEach((el) => {
        el.style.display = esGasket ? '' : 'none';
    });
    document.querySelectorAll<HTMLElement>('.solo-spool').forEach((el) => {
        el.style.display = esSpool ? '' : 'none';
    });

    setCustomSlidersVisible(!esNptUnion && (esCustom || esSpool || esPlatter));

    document.querySelectorAll<HTMLElement>('.slider-container').forEach((container) => {
        const isSpoolLength = container.classList.contains('solo-spool');
        const isPlatterHeight = container.classList.contains('solo-platter');
        const isFerruleSpecific = container.classList.contains('solo-ferrula');
        const rangeEl = container.querySelector('.param-range') as HTMLInputElement | null;
        if (esNptUnion) {
            // NPT sizes are fixed: no editable sliders at all
            container.style.display = 'none';
            if (rangeEl) rangeEl.disabled = true;
        } else if (isSpoolLength) {
            container.style.display = esSpool ? '' : 'none';
            if (rangeEl) rangeEl.disabled = !esSpool;
        } else if (isPlatterHeight) {
            container.style.display = esPlatter ? '' : 'none';
            if (rangeEl) rangeEl.disabled = !esPlatter;
        } else if (esCustom) {
            if (container.classList.contains('omit-endcap') && esEndcap) {
                container.style.display = 'none';
                if (rangeEl) rangeEl.disabled = true;
            } else if (isFerruleSpecific) {
                container.style.display = esFerrula || esSpool || esPlatter ? '' : 'none';
                if (rangeEl) rangeEl.disabled = !(esFerrula || esSpool || esPlatter);
            } else {
                container.style.display = '';
                if (rangeEl) rangeEl.disabled = false;
            }
        } else {
            container.style.display = 'none';
            if (rangeEl) rangeEl.disabled = true;
        }
    });

    let targetY = 15;
    if (esGasket) targetY = 0;
    if (esEndcap) targetY = 2.5;
    if (esSpool) {
        const sL = parseFloat((document.getElementById('spoolLength') as HTMLInputElement)?.value) || 0;
        targetY = (2 * state.tubeHeightFijo + sL) / 2;
    }
    if (esPlatter) {
        const pH = parseFloat((document.getElementById('platterHeight') as HTMLInputElement)?.value) || 0;
        targetY = (3 + pH + state.tubeHeightFijo) / 2;
    }
    if (esNptUnion) {
        targetY = getSelectedNptSize().bodyLength / 2;
    }
    controls.target.set(0, targetY, 0);
}

function applyPresetDataToForm(p: {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    tubeHeightCorta: number;
    tubeHeightLarga: number;
    gasketThickness: number;
}) {
    if (!p) return;
    setAplicandoPreset(true);
    try {
        setSliderValue('tubeID', p.tubeID);
        setSliderValue('tubeOD', p.tubeOD);
        setSliderValue('ferruleOD', p.ferruleOD);
        setSliderValue('beadDistance', p.beadDistance);
        aplicarLongitudesASMEDesdePreset(p);
        aplicarTipoFerrulaUI('larga');
        setTubeHeightFijo(state.lastTubeHeightsCortaLarga.larga);
        setGasketThicknessFijo(p.gasketThickness);
    } finally {
        setAplicandoPreset(false);
    }
}

function applyPresetIndex(idx: number) {
    const p = state.presetsList[idx];
    if (!p) return;
    applyPresetDataToForm(p);
    actualizarVisibilidadTipoPieza();
    renderPiece();
    syncPresetNota(idx);
}

// ── Animation loop ──────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);
    if (state.objetoActual) state.objetoActual.rotation.y += 0.003;
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Bootstrap ───────────────────────────────────────────

async function start() {
    displayLoadState('Cargando presets.csv…');
    const [presetsList] = await Promise.all([fetchPresetsData(), fetchNptSizes()]);
    const sel = populatePresetsSelect(presetsList);

    if (presetsList.length > 0) {
        const idx15 = presetsList.findIndex((p) => String(p.preset).startsWith('1.5"'));
        const defaultIdx = idx15 >= 0 ? idx15 : 0;
        sel.value = String(defaultIdx);
        applyPresetDataToForm(presetsList[defaultIdx]);
        syncPresetNota(defaultIdx);
        actualizarVisibilidadTipoPieza();
    } else {
        displayLoadState('presets.csv está vacío o no es válido.', true);
    }

    syncVistaChips();
    renderPiece();

    setupBulkDownload({
        getFixedState: () => ({ beadRadiusFijo: state.beadRadiusFijo, ferrHeightFijo: state.ferrHeightFijo }),
        presetsList: state.presetsList,
    });

    setupEventListeners();
    animate();
}

function setupEventListeners() {
    document.querySelectorAll<HTMLInputElement>('.param-range').forEach((input) => {
        input.addEventListener('input', () => {
            if (!state.aplicandoPreset && input.id !== 'spoolLength' && input.id !== 'platterHeight') {
                (document.getElementById('presetSelect') as HTMLSelectElement).value = '';
                syncPresetNota(null);
                actualizarVisibilidadTipoPieza();
            }
            renderPiece();
        });
    });
    document.querySelectorAll<HTMLInputElement>('input[name="ferrulaLength"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (state.aplicandoPreset) return;
            const v = document.querySelector<HTMLInputElement>('input[name="ferrulaLength"]:checked')?.value;
            if (v !== 'corta' && v !== 'larga') return;
            const h = v === 'corta' ? state.lastTubeHeightsCortaLarga.corta : state.lastTubeHeightsCortaLarga.larga;
            setAplicandoPreset(true);
            try {
                setTubeHeightFijo(h);
            } finally {
                setAplicandoPreset(false);
            }
            syncFerrulaLengthChipsActive();
            renderPiece();
        });
    });
    document.querySelectorAll<HTMLInputElement>('input[name="modoVista"]').forEach((el) => {
        el.addEventListener('change', () => {
            syncVistaChips();
            renderPiece();
        });
    });
    document.querySelectorAll<HTMLButtonElement>('.color-vista-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
            const h = parseInt(btn.getAttribute('data-hex') || '0', 16);
            updateMaterialsColor(h);
            document.querySelectorAll<HTMLButtonElement>('.color-vista-swatch').forEach((btn2) => {
                const bh = parseInt(btn2.getAttribute('data-hex') || '0', 16);
                const on = bh === h;
                btn2.classList.toggle('color-vista-swatch--active', on);
                btn2.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        });
    });
    (document.getElementById('tipoPieza') as HTMLSelectElement).addEventListener('change', (e) => {
        const tipo = (e.target as HTMLSelectElement).value;
        if (tipo === 'nptUnion') {
            // Remember the ASME selection before the NPT list replaces it.
            const prev = (document.getElementById('presetSelect') as HTMLSelectElement).value;
            const prevIdx = parseInt(prev, 10);
            if (Number.isFinite(prevIdx)) lastAsmePresetIndex = prevIdx;
            // Fixed NPT sizes replace the ASME BPE preset list; no editable sliders.
            populateNptSelect();
            syncNptNota();
        } else {
            const label = document.getElementById('presetLabel');
            if (label) label.textContent = 'Preset ASME BPE';
            populatePresetsSelect(state.presetsList);
            const sel = document.getElementById('presetSelect') as HTMLSelectElement;
            if (state.presetsList.length > 0) {
                const idx = Math.min(lastAsmePresetIndex, state.presetsList.length - 1);
                sel.value = String(idx);
                applyPresetDataToForm(state.presetsList[idx]);
                syncPresetNota(idx);
            } else {
                syncPresetNota(null);
            }
        }
        actualizarVisibilidadTipoPieza();
        renderPiece();
    });
    (document.getElementById('presetSelect') as HTMLSelectElement).addEventListener('change', (e) => {
        const v = (e.target as HTMLSelectElement).value;
        if (getTipoPieza() === 'nptUnion') {
            syncNptNota();
            actualizarVisibilidadTipoPieza();
            renderPiece();
            return;
        }
        if (v === '') {
            syncPresetNota(null);
            actualizarVisibilidadTipoPieza();
            renderPiece();
            return;
        }
        applyPresetIndex(parseInt(v, 10));
    });
    (document.getElementById('btnDescargar') as HTMLButtonElement).addEventListener('click', async () => {
        const formato = (document.getElementById('exportFormat') as HTMLSelectElement)?.value ?? 'stl-binary';
        if (['step', 'brep', 'both'].includes(formato)) {
            if (!state.cadParams) return;
            const btn = document.getElementById('btnDescargar') as HTMLButtonElement;
            btn.disabled = true;
            try {
                await exportarCAD(
                    state.cadTipo,
                    state.cadParams as unknown as ProfileParams,
                    formato as 'step' | 'brep' | 'both',
                );
            } catch (err) {
                console.error('Error exportando CAD:', err);
                alert(`Error al exportar CAD: ${(err as Error).message ?? err}`);
            } finally {
                btn.disabled = false;
            }
        } else {
            exportarMallaActual();
        }
    });
    const panel = document.getElementById('panel-control') as HTMLElement;
    const toggle = document.getElementById('panel-toggle') as HTMLElement;
    if (panel && toggle) {
        const mq = window.matchMedia('(max-width: 899px)');
        mq.addEventListener('change', () => {
            if (!mq.matches) {
                panel.classList.remove('panel-control--collapsed');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
        toggle.addEventListener('click', () => {
            if (!mq.matches) return;
            panel.classList.toggle('panel-control--collapsed');
            toggle.setAttribute('aria-expanded', String(!panel.classList.contains('panel-control--collapsed')));
        });
    }
}

start();
