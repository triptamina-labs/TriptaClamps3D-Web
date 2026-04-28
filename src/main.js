import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

let presetsList = [];
let aplicandoPreset = false;
/** Longitudes reales ASME BPE (mm) por preset: corta 14WMP / larga 14AM7, desde CSV. */
let lastTubeHeightsCortaLarga = { corta: 12.7, larga: 28.6 };
/** Por preset (CSV); no editables por slider. */
let beadRadiusFijo = 1.5;
let gasketThicknessFijo = 1.4;
/** Grosor de brida fijo (mm). */
let ferrHeightFijo = 2;
/** Altura tubo férula (mm): preset + corta/larga; no slider. */
let tubeHeightFijo = 28.6;

/**
 * Respaldo si fetch('presets.csv') falla (p. ej. abrir index.html con file://).
 * Debe mantenerse alineado con src/presets.csv del repositorio.
 */
const PRESETS_CSV_FALLBACK = `Preset,DN,ferruleOD,beadDistance,tubeOD,tubeID,tubeHeightCorta,tubeHeightLarga,gasketThickness,Standard
1/2",Mini,25.20,18.66,12.70,9.40,12.7,28.6,1.4,ASME BPE
3/4",Mini,29.20,23.82,19.05,15.75,12.7,28.6,1.4,ASME BPE
1",TC50,50.40,37.60,25.40,22.10,12.7,28.6,2.25,ASME BPE
1.5",TC64,63.90,50.70,38.10,34.80,12.7,28.6,2.25,ASME BPE
2",TC64,74.00,62.10,50.80,47.50,12.7,28.6,2.25,ASME BPE
2.5",TC77,87.00,74.96,63.50,60.20,12.7,28.6,2.25,ASME BPE
3",TC91,100.00,87.80,76.20,72.90,12.7,28.6,2.25,ASME BPE
4",TC119,125.00,113.00,101.60,97.38,15.9,28.6,2.25,ASME BPE
6",TC167,179.00,165.40,152.40,146.86,19.1,38.1,2.75,ASME BPE
8",TC218,230.00,216.30,203.20,197.66,19.1,38.1,2.75,ASME BPE
10",TC268,281.00,267.20,254.00,248.46,19.1,38.1,2.75,ASME BPE
12",TC319,332.00,318.10,304.80,298.70,19.1,44.5,2.75,ASME BPE
`;

function parsePresetsCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    const headerIndex = new Map(headers.map((h, i) => [h, i]));
    const getCol = (cols, name) => {
        const idx = headerIndex.get(name);
        return idx !== undefined ? cols[idx] : undefined;
    };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = line.split(',');
        if (cols.length < 6) continue;
        rows.push({
            preset: getCol(cols, 'Preset') ?? cols[0],
            dn: getCol(cols, 'DN') ?? cols[1],
            ferruleOD: parseFloat(getCol(cols, 'ferruleOD') ?? cols[2]),
            beadDistance: parseFloat(getCol(cols, 'beadDistance') ?? cols[3]),
            tubeOD: parseFloat(getCol(cols, 'tubeOD') ?? cols[4]),
            tubeID: parseFloat(getCol(cols, 'tubeID') ?? cols[5]),
            tubeHeightCorta: parseFloat(getCol(cols, 'tubeHeightCorta') ?? cols[6]),
            tubeHeightLarga: parseFloat(getCol(cols, 'tubeHeightLarga') ?? cols[7]),
            gasketThickness: parseFloat(getCol(cols, 'gasketThickness') ?? cols[8]),
            standard: (getCol(cols, 'Standard') ?? getCol(cols, 'standard') ?? cols[9] ?? '').trim(),
            notaPerfil: (getCol(cols, 'notaPerfil') ?? getCol(cols, 'NotaPerfil') ?? cols[10] ?? '').trim()
        });
    }
    return rows;
}

function setSliderValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Number(val);
    if (Number.isNaN(n)) return;
    let min = parseFloat(el.min);
    let max = parseFloat(el.max);
    if (n > max) {
        el.max = String(n);
        max = n;
    }
    if (n < min) {
        el.min = String(n);
        min = n;
    }
    const clamped = Math.min(max, Math.max(min, n));
    el.value = String(clamped);
}

function aplicarRadiosYGrosorFijosDesdePreset(p) {
    if (!p) return;
    gasketThicknessFijo = p.gasketThickness;
}

function aplicarTubeHeightFijo(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return;
    tubeHeightFijo = v;
}

function aplicarLongitudesASMEDesdePreset(p) {
    const hC = Number.isFinite(p.tubeHeightCorta) ? p.tubeHeightCorta : 12.7;
    const hL = Number.isFinite(p.tubeHeightLarga) ? p.tubeHeightLarga : 28.6;
    lastTubeHeightsCortaLarga = { corta: hC, larga: hL };
    const mc = document.getElementById('ferrula-meta-corta');
    const ml = document.getElementById('ferrula-meta-larga');
    if (mc) mc.textContent = `${hC.toFixed(1)} mm · 14WMP`;
    if (ml) ml.textContent = `${hL.toFixed(1)} mm · 14AM7`;
}

function aplicarTipoFerrulaUI(tipo) {
    const t = tipo === 'corta' ? 'corta' : 'larga';
    document.querySelectorAll('input[name="ferrulaLength"]').forEach((r) => {
        r.checked = r.value === t;
    });
    syncFerrulaLengthChipsActive();
}

function syncFerrulaLengthChipsActive() {
    document.querySelectorAll('.ferrula-length-chip').forEach((chip) => {
        const input = chip.querySelector('input[name="ferrulaLength"]');
        chip.classList.toggle('ferrula-length-chip--active', Boolean(input && input.checked));
    });
}

function applyPresetDataToForm(p) {
    if (!p) return;
    aplicandoPreset = true;
    try {
        setSliderValue('tubeID', p.tubeID);
        setSliderValue('tubeOD', p.tubeOD);
        setSliderValue('ferruleOD', p.ferruleOD);
        setSliderValue('beadDistance', p.beadDistance);
        const tipoNorm = 'larga';
        aplicarLongitudesASMEDesdePreset(p);
        aplicarTipoFerrulaUI(tipoNorm);
        const th =
            tipoNorm === 'corta'
                ? lastTubeHeightsCortaLarga.corta
                : lastTubeHeightsCortaLarga.larga;
        aplicarTubeHeightFijo(th);
        aplicarRadiosYGrosorFijosDesdePreset(p);
    } finally {
        aplicandoPreset = false;
    }
}

function applyPresetIndex(idx) {
    const p = presetsList[idx];
    if (!p) return;
    applyPresetDataToForm(p);
    actualizarVisibilidadTipoPieza();
    generarFerula();
    syncPresetNota(idx);
}

function syncPresetNota(idx) {
    const el = document.getElementById('presetNota');
    if (!el) return;
    const p =
        idx !== null && idx !== undefined && !Number.isNaN(idx) ? presetsList[idx] : null;
    const txt = p && p.notaPerfil ? String(p.notaPerfil).trim() : '';
    if (txt) {
        el.textContent = txt;
        el.removeAttribute('hidden');
    } else {
        el.textContent = '';
        el.setAttribute('hidden', '');
    }
}

/** Sliders editables solo en modo Custom (preset vacío). */
function setCustomSlidersVisible(show) {
    const pc = document.getElementById('panel-custom');
    const div = document.getElementById('divider-custom');
    if (pc) pc.hidden = !show;
    if (div) div.hidden = !show;
    document.querySelectorAll('#panel-custom .param-range').forEach((el) => {
        el.disabled = !show;
    });
}

async function loadPresets() {
    const noteEl = document.getElementById('presetNota');
    noteEl.removeAttribute('hidden');
    noteEl.textContent = 'Cargando presets.csv…';

    let text = '';
    const presetUrls = [
        new URL('presets.csv', import.meta.url).href,
        new URL('presets.csv', window.location.href).href
    ];
    try {
        for (const u of presetUrls) {
            const r = await fetch(u);
            if (r.ok) {
                text = await r.text();
                break;
            }
        }
        if (!text) text = PRESETS_CSV_FALLBACK;
    } catch (_) {
        text = PRESETS_CSV_FALLBACK;
    }

    presetsList = parsePresetsCSV(text);
    const sel = document.getElementById('presetSelect');
    sel.innerHTML = '<option value="">Custom</option>';
    presetsList.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${p.preset} · ${p.dn}`;
        sel.appendChild(opt);
    });

    if (presetsList.length > 0) {
        const idx15 = presetsList.findIndex((p) => String(p.preset).startsWith('1.5"'));
        const defaultIdx = idx15 >= 0 ? idx15 : 0;
        sel.value = String(defaultIdx);
        applyPresetDataToForm(presetsList[defaultIdx]);
        syncPresetNota(defaultIdx);
        actualizarVisibilidadTipoPieza();
    } else {
        noteEl.textContent = 'presets.csv está vacío o no es válido.';
        noteEl.removeAttribute('hidden');
        setCustomSlidersVisible(true);
    }

    sel.disabled = false;
    document.querySelectorAll('input[name="ferrulaLength"]').forEach((el) => {
        el.disabled = false;
    });
    document.getElementById('btnDescargar').disabled = false;
}

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

const matPuntos = new THREE.PointsMaterial({
    color: 0xeeeeee,
    size: 0.18,
    sizeAttenuation: true
});
const matLineas = new THREE.LineBasicMaterial({ color: 0xeeeeee });
const matMalla = new THREE.MeshBasicMaterial({ color: 0xeeeeee, wireframe: true, transparent: true, opacity: 0.15, side: THREE.DoubleSide });

function aplicarColorVistaTecnica(hex) {
    const c = Number(hex);
    if (!Number.isFinite(c) || c < 0 || c > 0xffffff) return;
    matPuntos.color.setHex(c);
    matLineas.color.setHex(c);
    matMalla.color.setHex(c);
    document.querySelectorAll('.color-vista-swatch').forEach((btn) => {
        const bh = parseInt(btn.getAttribute('data-hex') || '0', 16);
        const on = bh === c;
        btn.classList.toggle('color-vista-swatch--active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}
const matSolido = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide, flatShading: true });
const matGasketSolido = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide
});

let objetoActual = null;
/** Copia de la LatheGeometry actual para exportar (sin rotación de vista). */
let geometriaExportacion = null;

function disposeGeometriaExportacion() {
    if (geometriaExportacion) {
        geometriaExportacion.dispose();
        geometriaExportacion = null;
    }
}

function registrarGeometriaParaExport(geometriaBase) {
    disposeGeometriaExportacion();
    geometriaExportacion = geometriaBase.clone();
}

function getExportBaseName() {
    const tipo = document.getElementById('tipoPieza').value;
    const ps = document.getElementById('presetSelect');
    let slug = 'custom';
    if (ps.value !== '') {
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

function descargarArchivo(nombre, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function exportarMallaActual() {
    if (!geometriaExportacion) {
        return;
    }

    const formato = document.getElementById('exportFormat').value;
    const base = getExportBaseName();
    const mesh = new THREE.Mesh(geometriaExportacion, matSolido);
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

/** Perfil revolución simétrico: doble bead (convexo arriba/abajo), alma plana. gasketThickness = espesor axial total del cuerpo (mm, mismo sistema que tubeOD/ferruleOD). */
function dibujarPerfilGasket(shape, rID, rF, rbD, bR, gasketThickness) {
    const espesorMedio = gasketThickness / 2;

    shape.moveTo(rID, espesorMedio);
    shape.lineTo(rbD - bR, espesorMedio);
    shape.absarc(rbD, espesorMedio, bR, Math.PI, 0, true);
    shape.lineTo(rF, espesorMedio);

    shape.lineTo(rF, -espesorMedio);
    shape.lineTo(rbD + bR, -espesorMedio);
    shape.absarc(rbD, -espesorMedio, bR, 0, Math.PI, true);
    shape.lineTo(rID, -espesorMedio);

    shape.lineTo(rID, espesorMedio);
}

/** Perfil revolución férula: cuerpo del tubo + brida cónica + canal bead. */
function dibujarPerfilFerula(shape, rID, rOD, rF, rbD, bR, tH, fH) {
    const anguloRadianes = 20 * (Math.PI / 180);
    const distanciaX = rF - rOD;
    const subidaY = distanciaX * Math.tan(anguloRadianes);
    const puntoX_Y = fH + subidaY;

    // Empezar en rID, tH según requerimiento
    shape.moveTo( rID, tH ); 
    shape.lineTo( rOD, tH ); 
    shape.lineTo( rOD, puntoX_Y ); 
    shape.lineTo( rF, fH ); 
    shape.lineTo( rF, 0 ); 
    shape.lineTo( rbD + bR, 0 ); 
    shape.absarc( rbD, 0, bR, 0, Math.PI, false ); 
    shape.lineTo( rID, 0 ); 
    shape.lineTo( rID, tH ); 
}

/** Perfil revolución Spool: dos férulas unidas por un tubo central de longitud sL. */
function dibujarPerfilSpool(shape, rID, rOD, rF, rbD, bR, tH, fH, sL) {
    const anguloRadianes = 20 * (Math.PI / 180);
    const distanciaX = rF - rOD;
    const subidaY = distanciaX * Math.tan(anguloRadianes);
    const puntoX_Y = fH + subidaY;
    const totalH = (2 * tH) + sL;

    // 1. Férula inferior (exterior)
    shape.moveTo( rID, tH );
    shape.lineTo( rID, 0 );
    shape.lineTo( rbD - bR, 0 );
    shape.absarc( rbD, 0, bR, Math.PI, 0, true );
    shape.lineTo( rF, 0 );
    shape.lineTo( rF, fH );
    shape.lineTo( rOD, puntoX_Y );
    shape.lineTo( rOD, tH );

    // 2. Tubo central (exterior)
    shape.lineTo( rOD, tH + sL );

    // 3. Férula superior (invertida)
    const topPuntoX_Y = totalH - (fH + subidaY);
    const topFH = totalH - fH;

    shape.lineTo( rOD, topPuntoX_Y );
    shape.lineTo( rF, topFH );
    shape.lineTo( rF, totalH );
    shape.lineTo( rbD + bR, totalH );
    shape.absarc( rbD, totalH, bR, 0, Math.PI, true );
    shape.lineTo( rID, totalH );

    // 4. Pared interior (regreso al punto de inicio)
    shape.lineTo( rID, tH );
}

function actualizarVisibilidadTipoPieza() {
    const tipo = document.getElementById('tipoPieza').value;
    const presetVal = document.getElementById('presetSelect').value;
    const esFerrula = tipo === 'ferrula';
    const esGasket = tipo === 'gasket';
    const esSpool = tipo === 'spool';
    const esCustom = presetVal === '';

    // Visibilidad de secciones base (Férula/Gasket/Spool)
    document.querySelectorAll('.solo-ferrula').forEach((el) => {
        el.style.display = (esFerrula || esSpool) ? '' : 'none';
    });
    document.querySelectorAll('.solo-gasket').forEach((el) => {
        el.style.display = esGasket ? '' : 'none';
    });
    document.querySelectorAll('.solo-spool').forEach((el) => {
        el.style.display = esSpool ? '' : 'none';
    });

    // Control de visibilidad del panel de parámetros editables
    // Si es Spool, el panel SIEMPRE se muestra (para el slider de longitud)
    // Si es Férula/Gasket, solo se muestra en modo Custom
    const mostrarPanelCustom = esCustom || esSpool; 
    setCustomSlidersVisible(mostrarPanelCustom);

    // Filtrado granular de sliders dentro del panel custom
    document.querySelectorAll('.slider-container').forEach((container) => {
        const isSpoolLength = container.classList.contains('solo-spool');
        const isFerruleSpecific = container.classList.contains('solo-ferrula');
        const rangeEl = container.querySelector('.param-range');
        
        if (isSpoolLength) {
            // Slider de longitud solo visible e interactivo en modo Spool
            container.style.display = esSpool ? '' : 'none';
            if (rangeEl) rangeEl.disabled = !esSpool;
        } else {
            // Sliders de dimensiones (tubeID, tubeOD, etc.)
            if (esCustom) {
                // En modo custom, mostrar según el tipo de pieza
                if (isFerruleSpecific) {
                    container.style.display = (esFerrula || esSpool) ? '' : 'none';
                    if (rangeEl) rangeEl.disabled = !(esFerrula || esSpool);
                } else {
                    // Sliders comunes (tubeID, etc.)
                    container.style.display = '';
                    if (rangeEl) rangeEl.disabled = false;
                }
            } else {
                // Si hay un preset activo, ocultar todas las dimensiones editables
                container.style.display = 'none';
                if (rangeEl) rangeEl.disabled = true;
            }
        }
    });

    // Ajustar visibilidad del divisor "Parámetros editables"
    const divCustom = document.getElementById('divider-custom');
    if (divCustom) divCustom.hidden = !mostrarPanelCustom;

    // Ajustar cámara
    let targetY = 15;
    if (esGasket) targetY = 0;
    if (esSpool) {
        const sL = parseFloat(document.getElementById('spoolLength').value) || 0;
        const tH = tubeHeightFijo;
        targetY = ( (2 * tH) + sL ) / 2;
    }
    controls.target.set(0, targetY, 0);
}

function getModoVista() {
    const sel = document.querySelector('input[name="modoVista"]:checked');
    return sel ? sel.value : 'lineas';
}

function syncVistaChips() {
    document.querySelectorAll('.vista-chip').forEach((chip) => {
        const input = chip.querySelector('input[name="modoVista"]');
        chip.classList.toggle('vista-chip--active', Boolean(input && input.checked));
    });
}

function generarFerula() {
    const vista = getModoVista();
    const tipoPieza = document.getElementById('tipoPieza').value;

    if (tipoPieza === 'gasket') {
        generarGasket(vista);
        return;
    }
    if (tipoPieza === 'spool') {
        generarSpool(vista);
        return;
    }

    // 1. LEER VALORES ACTUALES
    let tubeID = parseFloat(document.getElementById('tubeID').value);
    let tubeOD = parseFloat(document.getElementById('tubeOD').value);
    let ferruleOD = parseFloat(document.getElementById('ferruleOD').value);
    let beadDistance = parseFloat(document.getElementById('beadDistance').value);
    const tubeHeight = tubeHeightFijo;
    const ferrHeight = ferrHeightFijo;
    const beadRadius = beadRadiusFijo;

    // 2. APLICAR RESTRICCIONES (CONSTRAINTS)
    // Pared mínima del tubo (ej. 1mm de grosor mínimo)
    if (tubeOD <= tubeID + 1) tubeOD = tubeID + 1;
    
    // Brida mínima respecto al tubo (ej. 2mm más ancha)
    if (ferruleOD <= tubeOD + 2) ferruleOD = tubeOD + 2;
    
    // Canal del empaque (Bead) no puede chocar con el tubo interno
    if (beadDistance - (beadRadius * 2) <= tubeOD) {
        beadDistance = tubeOD + (beadRadius * 2) + 0.2;
    }
    // Canal del empaque no puede salirse de la brida
    if (beadDistance + (beadRadius * 2) >= ferruleOD) {
        beadDistance = ferruleOD - (beadRadius * 2) - 0.2;
    }

    // 3. ACTUALIZAR INTERFAZ (SLIDERS Y LABELS)
    // Esta es la parte que faltaba: Escribir de vuelta al DOM
    document.getElementById('tubeOD').value = tubeOD;
    document.getElementById('ferruleOD').value = ferruleOD;
    document.getElementById('beadDistance').value = beadDistance;

    document.getElementById('val-tubeID').innerText = tubeID.toFixed(2);
    document.getElementById('val-tubeOD').innerText = tubeOD.toFixed(2);
    document.getElementById('val-ferruleOD').innerText = ferruleOD.toFixed(2);
    document.getElementById('val-beadDistance').innerText = beadDistance.toFixed(2);

    // 4. CÁLCULOS GEOMÉTRICOS (RADIOS)
    const tubeID_r = tubeID / 2;
    const tubeOD_r = tubeOD / 2;
    const ferruleOD_r = ferruleOD / 2;
    const beadDistance_r = beadDistance / 2;

    // 5. TRAZADO Y GENERACIÓN 3D
    const perfil = new THREE.Shape();
    dibujarPerfilFerula(perfil, tubeID_r, tubeOD_r, ferruleOD_r, beadDistance_r, beadRadius, tubeHeight, ferrHeight);

    const puntos = perfil.getPoints(60);
    const segmentosRadiales = (vista === 'solido') ? 128 : 64; 
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales); 
    registrarGeometriaParaExport(geometriaBase);

    if (objetoActual) {
        scene.remove(objetoActual);
        objetoActual.geometry.dispose();
    }

    if (vista === 'puntos') {
        objetoActual = new THREE.Points(geometriaBase, matPuntos);
    } else if (vista === 'lineas') {
        const geometriaBordes = new THREE.EdgesGeometry(geometriaBase, 0.1);
        objetoActual = new THREE.LineSegments(geometriaBordes, matLineas);
    } else if (vista === 'malla') {
        objetoActual = new THREE.Mesh(geometriaBase, matMalla);
    } else if (vista === 'solido') {
        objetoActual = new THREE.Mesh(geometriaBase, matSolido);
    }

    scene.add(objetoActual);
}

function generarGasket(vista) {
    let tID = parseFloat(document.getElementById('tubeID').value);
    let fOD = parseFloat(document.getElementById('ferruleOD').value);
    let bD = parseFloat(document.getElementById('beadDistance').value);
    const bR = beadRadiusFijo;
    const gTh = gasketThicknessFijo;

    if (fOD < tID + 5) {
        fOD = tID + 5;
        document.getElementById('ferruleOD').value = fOD;
    }
    const minBD = tID + (bR * 2) + 0.5;
    const maxBD = fOD - (bR * 2) - 0.5;
    if (bD < minBD) bD = minBD;
    if (bD > maxBD) bD = maxBD;
    document.getElementById('beadDistance').value = bD;

    document.getElementById('val-tubeID').innerText = tID.toFixed(2);
    document.getElementById('val-ferruleOD').innerText = fOD.toFixed(2);
    document.getElementById('val-beadDistance').innerText = bD.toFixed(2);

    const rID = tID / 2;
    const rF = fOD / 2;
    const rbD = bD / 2;

    const perfil = new THREE.Shape();
    dibujarPerfilGasket(perfil, rID, rF, rbD, bR, gTh);

    const puntos = perfil.getPoints(60);
    const segmentosRadiales = (vista === 'solido') ? 128 : 64;
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales);
    registrarGeometriaParaExport(geometriaBase);

    if (objetoActual) {
        scene.remove(objetoActual);
        objetoActual.geometry.dispose();
    }

    if (vista === 'puntos') {
        objetoActual = new THREE.Points(geometriaBase, matPuntos);
    } else if (vista === 'lineas') {
        const geometriaBordes = new THREE.EdgesGeometry(geometriaBase, 0.1);
        objetoActual = new THREE.LineSegments(geometriaBordes, matLineas);
    } else if (vista === 'malla') {
        objetoActual = new THREE.Mesh(geometriaBase, matMalla);
    } else if (vista === 'solido') {
        objetoActual = new THREE.Mesh(geometriaBase, matGasketSolido);
    }

    scene.add(objetoActual);
}

function generarSpool(vista) {
    // 1. LEER VALORES ACTUALES
    let tubeID = parseFloat(document.getElementById('tubeID').value);
    let tubeOD = parseFloat(document.getElementById('tubeOD').value);
    let ferruleOD = parseFloat(document.getElementById('ferruleOD').value);
    let beadDistance = parseFloat(document.getElementById('beadDistance').value);
    let spoolLength = parseFloat(document.getElementById('spoolLength').value);
    const tubeHeight = tubeHeightFijo;
    const ferrHeight = ferrHeightFijo;
    const beadRadius = beadRadiusFijo;

    // 2. APLICAR RESTRICCIONES (CONSTRAINTS)
    if (tubeOD <= tubeID + 1) tubeOD = tubeID + 1;
    if (ferruleOD <= tubeOD + 2) ferruleOD = tubeOD + 2;
    if (beadDistance - (beadRadius * 2) <= tubeOD) {
        beadDistance = tubeOD + (beadRadius * 2) + 0.2;
    }
    if (beadDistance + (beadRadius * 2) >= ferruleOD) {
        beadDistance = ferruleOD - (beadRadius * 2) - 0.2;
    }

    // 3. ACTUALIZAR INTERFAZ
    document.getElementById('tubeOD').value = tubeOD;
    document.getElementById('ferruleOD').value = ferruleOD;
    document.getElementById('beadDistance').value = beadDistance;

    document.getElementById('val-tubeID').innerText = tubeID.toFixed(2);
    document.getElementById('val-tubeOD').innerText = tubeOD.toFixed(2);
    document.getElementById('val-ferruleOD').innerText = ferruleOD.toFixed(2);
    document.getElementById('val-beadDistance').innerText = beadDistance.toFixed(2);
    
    document.getElementById('val-spoolLength').innerText = spoolLength.toFixed(2);

    // 4. CÁLCULOS GEOMÉTRICOS
    const tubeID_r = tubeID / 2;
    const tubeOD_r = tubeOD / 2;
    const ferruleOD_r = ferruleOD / 2;
    const beadDistance_r = beadDistance / 2;

    // 5. TRAZADO Y GENERACIÓN 3D
    const perfil = new THREE.Shape();
    dibujarPerfilSpool(perfil, tubeID_r, tubeOD_r, ferruleOD_r, beadDistance_r, beadRadius, tubeHeight, ferrHeight, spoolLength);

    const puntos = perfil.getPoints(80);
    const segmentosRadiales = (vista === 'solido') ? 128 : 64; 
    const geometriaBase = new THREE.LatheGeometry(puntos, segmentosRadiales); 
    registrarGeometriaParaExport(geometriaBase);

    if (objetoActual) {
        scene.remove(objetoActual);
        objetoActual.geometry.dispose();
    }

    if (vista === 'puntos') {
        objetoActual = new THREE.Points(geometriaBase, matPuntos);
    } else if (vista === 'lineas') {
        const geometriaBordes = new THREE.EdgesGeometry(geometriaBase, 0.1);
        objetoActual = new THREE.LineSegments(geometriaBordes, matLineas);
    } else if (vista === 'malla') {
        objetoActual = new THREE.Mesh(geometriaBase, matMalla);
    } else if (vista === 'solido') {
        objetoActual = new THREE.Mesh(geometriaBase, matSolido);
    }

    scene.add(objetoActual);
}

// Eventos
document.querySelectorAll('.param-range').forEach((input) => {
    input.addEventListener('input', () => {
        if (!aplicandoPreset && input.id !== 'spoolLength') {
            document.getElementById('presetSelect').value = '';
            syncPresetNota(null);
            actualizarVisibilidadTipoPieza();
        }
        generarFerula();
    });
});

document.querySelectorAll('input[name="ferrulaLength"]').forEach((el) => {
    el.addEventListener('change', () => {
        if (aplicandoPreset) return;
        const v = document.querySelector('input[name="ferrulaLength"]:checked')?.value;
        if (v !== 'corta' && v !== 'larga') return;
        const h =
            v === 'corta'
                ? lastTubeHeightsCortaLarga.corta
                : lastTubeHeightsCortaLarga.larga;
        aplicandoPreset = true;
        try {
            aplicarTubeHeightFijo(h);
        } finally {
            aplicandoPreset = false;
        }
        syncFerrulaLengthChipsActive();
        generarFerula();
    });
});

document.querySelectorAll('input[name="modoVista"]').forEach((el) => {
    el.addEventListener('change', () => {
        syncVistaChips();
        generarFerula();
    });
});

document.querySelectorAll('.color-vista-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
        const h = parseInt(btn.getAttribute('data-hex') || '0', 16);
        aplicarColorVistaTecnica(h);
    });
});

document.getElementById('tipoPieza').addEventListener('change', () => {
    actualizarVisibilidadTipoPieza();
    generarFerula();
});

document.getElementById('presetSelect').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === '') {
        syncPresetNota(null);
        actualizarVisibilidadTipoPieza();
        generarFerula();
        return;
    }
    applyPresetIndex(parseInt(v, 10));
});

document.getElementById('btnDescargar').addEventListener('click', () => {
    exportarMallaActual();
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

loadPresets().then(() => {
    syncVistaChips();
    actualizarVisibilidadTipoPieza();
    generarFerula();
});

function animate() {
    requestAnimationFrame(animate);
    if(objetoActual) {
        objetoActual.rotation.y += 0.003;
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
