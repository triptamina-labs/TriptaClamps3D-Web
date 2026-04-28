import { fetchPresetsData } from './data/presets.js';
import { setupScene } from './scene/setup.js';
import { updateMaterialsColor } from './scene/materials.js';
import { generarGeometriaFerula } from './parts/ferrule.js';
import { generarGeometriaGasket } from './parts/gasket.js';
import { generarGeometriaSpool } from './parts/spool.js';
import { exportarMallaActual } from './export/exporter.js';
import { exportarCAD } from './cad/bridge.js';
import {
    setSliderValue, syncPresetNota, setCustomSlidersVisible,
    syncFerrulaLengthChipsActive, aplicarTipoFerrulaUI,
    syncVistaChips, aplicarLongitudesASMEDesdePreset,
    displayLoadState, populatePresetsSelect, getModoVista,
    getTipoPieza, readDOMDimensions, writeDOMDimensions
} from './ui/dom.js';
import {
    state,
    setAplicandoPreset, setTubeHeightFijo, setGasketThicknessFijo,
    setLastTubeHeightsCortaLarga, setGeometriaExportacion, setObjetoActual,
    setCadParams
} from './data/store.js';

// Setup global scene
const { scene, camera, renderer, controls } = setupScene();

function renderPiece() {
    const vista = getModoVista();
    const tipoPieza = getTipoPieza();
    let dims = readDOMDimensions();
    
    // Validar constraints
    if (tipoPieza === 'gasket') {
        if (dims.ferruleOD < dims.tubeID + 5) {
            dims.ferruleOD = dims.tubeID + 5;
        }
        const minBD = dims.tubeID + (state.beadRadiusFijo * 2) + 0.5;
        const maxBD = dims.ferruleOD - (state.beadRadiusFijo * 2) - 0.5;
        if (dims.beadDistance < minBD) dims.beadDistance = minBD;
        if (dims.beadDistance > maxBD) dims.beadDistance = maxBD;
    } else {
        if (dims.tubeOD <= dims.tubeID + 1) dims.tubeOD = dims.tubeID + 1;
        if (dims.ferruleOD <= dims.tubeOD + 2) dims.ferruleOD = dims.tubeOD + 2;
        if (dims.beadDistance - (state.beadRadiusFijo * 2) <= dims.tubeOD) {
            dims.beadDistance = dims.tubeOD + (state.beadRadiusFijo * 2) + 0.2;
        }
        if (dims.beadDistance + (state.beadRadiusFijo * 2) >= dims.ferruleOD) {
            dims.beadDistance = dims.ferruleOD - (state.beadRadiusFijo * 2) - 0.2;
        }
    }

    writeDOMDimensions(dims);

    const params = {
        ...dims,
        beadRadius: state.beadRadiusFijo,
        tubeHeight: state.tubeHeightFijo,
        ferrHeight: state.ferrHeightFijo,
        gasketThickness: state.gasketThicknessFijo
    };

    let result;
    if (tipoPieza === 'gasket') {
        result = generarGeometriaGasket(vista, params);
    } else if (tipoPieza === 'spool') {
        result = generarGeometriaSpool(vista, params);
    } else {
        result = generarGeometriaFerula(vista, params);
    }

    if (state.objetoActual) {
        scene.remove(state.objetoActual);
        state.objetoActual.geometry.dispose();
    }

    setGeometriaExportacion(result.geometriaBase);
    setObjetoActual(result.malla);
    setCadParams(tipoPieza, params);
    scene.add(result.malla);
}

function actualizarVisibilidadTipoPieza() {
    const tipo = getTipoPieza();
    const presetVal = document.getElementById('presetSelect').value;
    const esFerrula = tipo === 'ferrula';
    const esGasket = tipo === 'gasket';
    const esSpool = tipo === 'spool';
    const esCustom = presetVal === '';

    document.querySelectorAll('.solo-ferrula').forEach(el => {
        el.style.display = (esFerrula || esSpool) ? '' : 'none';
    });
    document.querySelectorAll('.solo-gasket').forEach(el => {
        el.style.display = esGasket ? '' : 'none';
    });
    document.querySelectorAll('.solo-spool').forEach(el => {
        el.style.display = esSpool ? '' : 'none';
    });

    const mostrarPanelCustom = esCustom || esSpool; 
    setCustomSlidersVisible(mostrarPanelCustom);

    document.querySelectorAll('.slider-container').forEach((container) => {
        const isSpoolLength = container.classList.contains('solo-spool');
        const isFerruleSpecific = container.classList.contains('solo-ferrula');
        const rangeEl = container.querySelector('.param-range');
        
        if (isSpoolLength) {
            container.style.display = esSpool ? '' : 'none';
            if (rangeEl) rangeEl.disabled = !esSpool;
        } else {
            if (esCustom) {
                if (isFerruleSpecific) {
                    container.style.display = (esFerrula || esSpool) ? '' : 'none';
                    if (rangeEl) rangeEl.disabled = !(esFerrula || esSpool);
                } else {
                    container.style.display = '';
                    if (rangeEl) rangeEl.disabled = false;
                }
            } else {
                container.style.display = 'none';
                if (rangeEl) rangeEl.disabled = true;
            }
        }
    });

    let targetY = 15;
    if (esGasket) targetY = 0;
    if (esSpool) {
        const sL = parseFloat(document.getElementById('spoolLength')?.value) || 0;
        const tH = state.tubeHeightFijo;
        targetY = ( (2 * tH) + sL ) / 2;
    }
    controls.target.set(0, targetY, 0);
}

function applyPresetDataToForm(p) {
    if (!p) return;
    setAplicandoPreset(true);
    try {
        setSliderValue('tubeID', p.tubeID);
        setSliderValue('tubeOD', p.tubeOD);
        setSliderValue('ferruleOD', p.ferruleOD);
        setSliderValue('beadDistance', p.beadDistance);
        const tipoNorm = 'larga';
        
        aplicarLongitudesASMEDesdePreset(p);
        aplicarTipoFerrulaUI(tipoNorm);
        
        const th = tipoNorm === 'corta' ? state.lastTubeHeightsCortaLarga.corta : state.lastTubeHeightsCortaLarga.larga;
        setTubeHeightFijo(th);
        setGasketThicknessFijo(p.gasketThickness);
    } finally {
        setAplicandoPreset(false);
    }
}

function applyPresetIndex(idx) {
    const p = state.presetsList[idx];
    if (!p) return;
    applyPresetDataToForm(p);
    actualizarVisibilidadTipoPieza();
    renderPiece();
    syncPresetNota(idx);
}

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

    // SETUP EVENTS
    document.querySelectorAll('.param-range').forEach((input) => {
        input.addEventListener('input', () => {
            if (!state.aplicandoPreset && input.id !== 'spoolLength') {
                document.getElementById('presetSelect').value = '';
                syncPresetNota(null);
                actualizarVisibilidadTipoPieza();
            }
            renderPiece();
        });
    });

    document.querySelectorAll('input[name="ferrulaLength"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (state.aplicandoPreset) return;
            const v = document.querySelector('input[name="ferrulaLength"]:checked')?.value;
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

    document.querySelectorAll('input[name="modoVista"]').forEach((el) => {
        el.addEventListener('change', () => {
            syncVistaChips();
            renderPiece();
        });
    });

    document.querySelectorAll('.color-vista-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
            const h = parseInt(btn.getAttribute('data-hex') || '0', 16);
            updateMaterialsColor(h);
            document.querySelectorAll('.color-vista-swatch').forEach((btn2) => {
                const bh = parseInt(btn2.getAttribute('data-hex') || '0', 16);
                const on = bh === h;
                btn2.classList.toggle('color-vista-swatch--active', on);
                btn2.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        });
    });

    document.getElementById('tipoPieza').addEventListener('change', () => {
        actualizarVisibilidadTipoPieza();
        renderPiece();
    });

    document.getElementById('presetSelect').addEventListener('change', (e) => {
        const v = e.target.value;
        if (v === '') {
            syncPresetNota(null);
            actualizarVisibilidadTipoPieza();
            renderPiece();
            return;
        }
        applyPresetIndex(parseInt(v, 10));
    });

    document.getElementById('btnDescargar').addEventListener('click', async () => {
        const formato = document.getElementById('exportFormat')?.value ?? 'stl-binary';
        const cadFormatos = ['step', 'brep', 'both'];

        if (cadFormatos.includes(formato)) {
            if (!state.cadParams) return;
            const btn = document.getElementById('btnDescargar');
            btn.disabled = true;
            try {
                await exportarCAD(state.cadTipo, state.cadParams, formato);
            } catch (err) {
                console.error('Error exportando CAD:', err);
                alert('Error al exportar CAD: ' + (err.message ?? err));
            } finally {
                btn.disabled = false;
            }
        } else {
            exportarMallaActual();
        }
    });

    (function initResponsivePanel() {
        const panel = document.getElementById('panel-control');
        const toggle = document.getElementById('panel-toggle');
        if (!panel || !toggle) return;
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
            const collapsed = panel.classList.contains('panel-control--collapsed');
            toggle.setAttribute('aria-expanded', String(!collapsed));
        });
    })();

    function animate() {
        requestAnimationFrame(animate);
        if(state.objetoActual) {
            state.objetoActual.rotation.y += 0.003;
        }
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

start();
