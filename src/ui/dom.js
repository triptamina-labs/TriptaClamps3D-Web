import { state } from '../data/store.js';

export function setSliderValue(id, val) {
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

export function syncPresetNota(idx) {
    const el = document.getElementById('presetNota');
    if (!el) return;
    const p = idx !== null && idx !== undefined && !Number.isNaN(idx) ? state.presetsList[idx] : null;
    const txt = p?.notaPerfil ? String(p.notaPerfil).trim() : '';
    if (txt) {
        el.textContent = txt;
        el.removeAttribute('hidden');
    } else {
        el.textContent = '';
        el.setAttribute('hidden', '');
    }
}

export function setCustomSlidersVisible(show) {
    const pc = document.getElementById('panel-custom');
    const div = document.getElementById('divider-custom');
    if (pc) pc.hidden = !show;
    if (div) div.hidden = !show;
    document.querySelectorAll('#panel-custom .param-range').forEach((el) => {
        el.disabled = !show;
    });
}

export function syncFerrulaLengthChipsActive() {
    document.querySelectorAll('.ferrula-length-chip').forEach((chip) => {
        const input = chip.querySelector('input[name="ferrulaLength"]');
        chip.classList.toggle('ferrula-length-chip--active', Boolean(input?.checked));
    });
}

export function aplicarTipoFerrulaUI(tipo) {
    const t = tipo === 'corta' ? 'corta' : 'larga';
    document.querySelectorAll('input[name="ferrulaLength"]').forEach((r) => {
        r.checked = r.value === t;
    });
    syncFerrulaLengthChipsActive();
}

export function syncVistaChips() {
    document.querySelectorAll('.vista-chip').forEach((chip) => {
        const input = chip.querySelector('input[name="modoVista"]');
        chip.classList.toggle('vista-chip--active', Boolean(input?.checked));
    });
}

export function aplicarLongitudesASMEDesdePreset(p) {
    const hC = Number.isFinite(p.tubeHeightCorta) ? p.tubeHeightCorta : 12.7;
    const hL = Number.isFinite(p.tubeHeightLarga) ? p.tubeHeightLarga : 28.6;
    state.lastTubeHeightsCortaLarga = { corta: hC, larga: hL };

    const mc = document.getElementById('ferrula-meta-corta');
    const ml = document.getElementById('ferrula-meta-larga');
    if (mc) mc.textContent = `${hC.toFixed(1)} mm · 14WMP`;
    if (ml) ml.textContent = `${hL.toFixed(1)} mm · 14AM7`;
}

export function displayLoadState(message, showCustom = false) {
    const noteEl = document.getElementById('presetNota');
    if (noteEl) {
        noteEl.removeAttribute('hidden');
        noteEl.textContent = message;
    }
    if (showCustom) {
        setCustomSlidersVisible(true);
    }
}

export function populatePresetsSelect(presetsList) {
    const sel = document.getElementById('presetSelect');
    sel.innerHTML = '<option value="">Custom</option>';
    presetsList.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${p.preset} · ${p.dn}`;
        sel.appendChild(opt);
    });
    sel.disabled = false;

    document.querySelectorAll('input[name="ferrulaLength"]').forEach((el) => {
        el.disabled = false;
    });
    const btnDescargar = document.getElementById('btnDescargar');
    if (btnDescargar) btnDescargar.disabled = false;

    const btnDescargarCAD = document.getElementById('btnDescargarCAD');
    if (btnDescargarCAD) btnDescargarCAD.disabled = false;

    return sel;
}

export function readDOMDimensions() {
    return {
        tubeID: parseFloat(document.getElementById('tubeID').value),
        tubeOD: parseFloat(document.getElementById('tubeOD').value),
        ferruleOD: parseFloat(document.getElementById('ferruleOD').value),
        beadDistance: parseFloat(document.getElementById('beadDistance').value),
        spoolLength: parseFloat(document.getElementById('spoolLength')?.value || 0),
    };
}

export function writeDOMDimensions(dims) {
    if (dims.tubeOD !== undefined) {
        document.getElementById('tubeOD').value = dims.tubeOD;
        document.getElementById('val-tubeOD').innerText = dims.tubeOD.toFixed(2);
    }
    if (dims.ferruleOD !== undefined) {
        document.getElementById('ferruleOD').value = dims.ferruleOD;
        document.getElementById('val-ferruleOD').innerText = dims.ferruleOD.toFixed(2);
    }
    if (dims.beadDistance !== undefined) {
        document.getElementById('beadDistance').value = dims.beadDistance;
        document.getElementById('val-beadDistance').innerText = dims.beadDistance.toFixed(2);
    }
    if (dims.tubeID !== undefined) {
        document.getElementById('val-tubeID').innerText = dims.tubeID.toFixed(2);
    }
    if (dims.spoolLength !== undefined) {
        const spoolEl = document.getElementById('val-spoolLength');
        if (spoolEl) spoolEl.innerText = dims.spoolLength.toFixed(2);
    }
}

export function getModoVista() {
    const sel = document.querySelector('input[name="modoVista"]:checked');
    return sel ? sel.value : 'lineas';
}

export function getTipoPieza() {
    return document.getElementById('tipoPieza').value;
}
