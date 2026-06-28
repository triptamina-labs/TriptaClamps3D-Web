import type * as THREE from 'three';
import { exportarCAD } from './cad/bridge.js';
import type { ProfileParams } from './cad/profileDescriptor.js';
import { validateAndClampDimensions } from './core/constraints.js';
import type { ViewMode } from './core/createLatheMesh.js';
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
    if (tipoPieza === 'gasket') result = generarGeometriaGasket(vista, params);
    else if (tipoPieza === 'spool') result = generarGeometriaSpool(vista, params);
    else if (tipoPieza === 'endcap') result = generarGeometriaEndCap(vista, params);
    else result = generarGeometriaFerula(vista, params);

    if (state.objetoActual) {
        scene.remove(state.objetoActual);
        (state.objetoActual as THREE.Mesh).geometry.dispose();
    }
    setGeometriaExportacion(result.geometriaBase);
    setObjetoActual(result.malla);
    setCadParams(tipoPieza, params as unknown as Record<string, number>);
    scene.add(result.malla);
}

function actualizarVisibilidadTipoPieza() {
    const tipo = getTipoPieza();
    const presetVal = (document.getElementById('presetSelect') as HTMLSelectElement).value;
    const esFerrula = tipo === 'ferrula',
        esGasket = tipo === 'gasket',
        esSpool = tipo === 'spool',
        esEndcap = tipo === 'endcap',
        esCustom = presetVal === '';

    document.querySelectorAll<HTMLElement>('.solo-ferrula').forEach((el) => {
        el.style.display = esFerrula || esSpool ? '' : 'none';
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

    setCustomSlidersVisible(esCustom || esSpool);

    document.querySelectorAll<HTMLElement>('.slider-container').forEach((container) => {
        const isSpoolLength = container.classList.contains('solo-spool');
        const isFerruleSpecific = container.classList.contains('solo-ferrula');
        const rangeEl = container.querySelector('.param-range') as HTMLInputElement | null;
        if (isSpoolLength) {
            container.style.display = esSpool ? '' : 'none';
            if (rangeEl) rangeEl.disabled = !esSpool;
        } else if (esCustom) {
            if (container.classList.contains('omit-endcap') && esEndcap) {
                container.style.display = 'none';
                if (rangeEl) rangeEl.disabled = true;
            } else if (isFerruleSpecific) {
                container.style.display = esFerrula || esSpool ? '' : 'none';
                if (rangeEl) rangeEl.disabled = !(esFerrula || esSpool);
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
    const presetsList = await fetchPresetsData();
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
            if (!state.aplicandoPreset && input.id !== 'spoolLength') {
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
    (document.getElementById('tipoPieza') as HTMLSelectElement).addEventListener('change', () => {
        actualizarVisibilidadTipoPieza();
        renderPiece();
    });
    (document.getElementById('presetSelect') as HTMLSelectElement).addEventListener('change', (e) => {
        const v = (e.target as HTMLSelectElement).value;
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
