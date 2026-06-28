import type { Dimensions, PresetRow } from '../data/store.js';
import { state } from '../data/store.js';

/**
 * Set a slider input's value, auto‑expanding its min/max range
 * if the provided value falls outside the current bounds.
 */
export function setSliderValue(id: string, val: number): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    if (Number.isNaN(val)) return;
    let min = parseFloat(el.min);
    let max = parseFloat(el.max);
    if (val > max) {
        el.max = String(val);
        max = val;
    }
    if (val < min) {
        el.min = String(val);
        min = val;
    }
    const clamped = Math.min(max, Math.max(min, val));
    el.value = String(clamped);
}

/**
 * Show or hide the optional per‑preset note element.
 */
export function syncPresetNota(idx: number | null): void {
    const el = document.getElementById('presetNota');
    if (!el) return;
    const p: PresetRow | null = idx !== null && idx !== undefined && !Number.isNaN(idx) ? state.presetsList[idx] : null;
    const txt = p?.notaPerfil ? String(p.notaPerfil).trim() : '';
    if (txt) {
        el.textContent = txt;
        el.removeAttribute('hidden');
    } else {
        el.textContent = '';
        el.setAttribute('hidden', '');
    }
}

/** Toggle visibility of the custom‑slider panel and its divider. */
export function setCustomSlidersVisible(show: boolean): void {
    const pc = document.getElementById('panel-custom');
    const div = document.getElementById('divider-custom');
    if (pc) pc.hidden = !show;
    if (div) div.hidden = !show;
    document.querySelectorAll<HTMLInputElement>('#panel-custom .param-range').forEach((el) => {
        el.disabled = !show;
    });
}

/** Mark the active ferrula‑length chip visually. */
export function syncFerrulaLengthChipsActive(): void {
    document.querySelectorAll<HTMLElement>('.ferrula-length-chip').forEach((chip) => {
        const input = chip.querySelector<HTMLInputElement>('input[name="ferrulaLength"]');
        chip.classList.toggle('ferrula-length-chip--active', Boolean(input?.checked));
    });
}

/** Check the "corta" or "larga" radio and refresh chip styling. */
export function aplicarTipoFerrulaUI(tipo: 'corta' | 'larga'): void {
    const t = tipo === 'corta' ? 'corta' : 'larga';
    document.querySelectorAll<HTMLInputElement>('input[name="ferrulaLength"]').forEach((r) => {
        r.checked = r.value === t;
    });
    syncFerrulaLengthChipsActive();
}

/** Mark the active vista chip visually. */
export function syncVistaChips(): void {
    document.querySelectorAll<HTMLElement>('.vista-chip').forEach((chip) => {
        const input = chip.querySelector<HTMLInputElement>('input[name="modoVista"]');
        chip.classList.toggle('vista-chip--active', Boolean(input?.checked));
    });
}

/**
 * Update the UI labels that display the short/long tube‑height
 * values as defined in the active preset.
 */
export function aplicarLongitudesASMEDesdePreset(p: { tubeHeightCorta: number; tubeHeightLarga: number }): void {
    const hC = Number.isFinite(p.tubeHeightCorta) ? p.tubeHeightCorta : 12.7;
    const hL = Number.isFinite(p.tubeHeightLarga) ? p.tubeHeightLarga : 28.6;
    state.lastTubeHeightsCortaLarga = { corta: hC, larga: hL };

    const mc = document.getElementById('ferrula-meta-corta');
    const ml = document.getElementById('ferrula-meta-larga');
    if (mc) mc.textContent = `${hC.toFixed(1)} mm · 14WMP`;
    if (ml) ml.textContent = `${hL.toFixed(1)} mm · 14AM7`;
}

/**
 * Display a transient status message inside the preset note area.
 */
export function displayLoadState(message: string, showCustom = false): void {
    const noteEl = document.getElementById('presetNota');
    if (noteEl) {
        noteEl.removeAttribute('hidden');
        noteEl.textContent = message;
    }
    if (showCustom) {
        setCustomSlidersVisible(true);
    }
}

/**
 * Fill the preset <select> with entries from the parsed CSV,
 * enable the ferrula‑length radios, and activate the download button.
 */
export function populatePresetsSelect(presetsList: PresetRow[]): HTMLSelectElement {
    const sel = document.getElementById('presetSelect') as HTMLSelectElement;
    sel.innerHTML = '<option value="">Custom</option>';
    presetsList.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${p.preset} · ${p.dn}`;
        sel.appendChild(opt);
    });
    sel.disabled = false;

    document.querySelectorAll<HTMLInputElement>('input[name="ferrulaLength"]').forEach((el) => {
        el.disabled = false;
    });
    const btnDescargar = document.getElementById('btnDescargar') as HTMLButtonElement | null;
    if (btnDescargar) btnDescargar.disabled = false;

    return sel;
}

/**
 * Read the current slider values from the DOM and return them
 * as a typed dimensions object.
 */
export function readDOMDimensions(): Dimensions {
    return {
        tubeID: parseFloat((document.getElementById('tubeID') as HTMLInputElement).value),
        tubeOD: parseFloat((document.getElementById('tubeOD') as HTMLInputElement).value),
        ferruleOD: parseFloat((document.getElementById('ferruleOD') as HTMLInputElement).value),
        beadDistance: parseFloat((document.getElementById('beadDistance') as HTMLInputElement).value),
        spoolLength: parseFloat((document.getElementById('spoolLength') as HTMLInputElement)?.value || '0'),
    };
}

/**
 * Push the provided dimension object back into the UI sliders
 * and associated readout spans.
 */
export function writeDOMDimensions(dims: Partial<Dimensions>): void {
    if (dims.tubeOD !== undefined) {
        (document.getElementById('tubeOD') as HTMLInputElement).value = String(dims.tubeOD);
        (document.getElementById('val-tubeOD') as HTMLElement).innerText = dims.tubeOD.toFixed(2);
    }
    if (dims.ferruleOD !== undefined) {
        (document.getElementById('ferruleOD') as HTMLInputElement).value = String(dims.ferruleOD);
        (document.getElementById('val-ferruleOD') as HTMLElement).innerText = dims.ferruleOD.toFixed(2);
    }
    if (dims.beadDistance !== undefined) {
        (document.getElementById('beadDistance') as HTMLInputElement).value = String(dims.beadDistance);
        (document.getElementById('val-beadDistance') as HTMLElement).innerText = dims.beadDistance.toFixed(2);
    }
    if (dims.tubeID !== undefined) {
        (document.getElementById('val-tubeID') as HTMLElement).innerText = dims.tubeID.toFixed(2);
    }
    if (dims.spoolLength !== undefined) {
        const spoolEl = document.getElementById('val-spoolLength');
        if (spoolEl) spoolEl.innerText = dims.spoolLength.toFixed(2);
    }
}

/** Return the currently selected view mode from the radio group. */
export function getModoVista(): string {
    const sel = document.querySelector<HTMLInputElement>('input[name="modoVista"]:checked');
    return sel ? sel.value : 'lineas';
}

/** Return the currently selected piece type from the <select>. */
export function getTipoPieza(): string {
    return (document.getElementById('tipoPieza') as HTMLSelectElement).value;
}
