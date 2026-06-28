// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { state } from '../../data/store.js';
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
} from '../dom.js';

function setupDOM() {
    document.body.innerHTML = `
        <input id="tubeID" type="range" min="5" max="300" value="34.8">
        <input id="tubeOD" type="range" min="5" max="300" value="38.1">
        <input id="ferruleOD" type="range" min="5" max="300" value="63.9">
        <input id="beadDistance" type="range" min="5" max="300" value="50.7">
        <input id="spoolLength" type="range" min="5" max="300" value="50">
        <span id="val-tubeID">34.80</span>
        <span id="val-tubeOD">38.10</span>
        <span id="val-ferruleOD">63.90</span>
        <span id="val-beadDistance">50.70</span>
        <span id="val-spoolLength">50.00</span>
        <span id="presetNota" hidden></span>
        <select id="presetSelect" disabled><option value="">Custom</option></select>
        <select id="tipoPieza"><option value="ferrula" selected>Todos</option></select>
        <select id="exportFormat"><option value="stl-binary">STL</option></select>
        <button id="btnDescargar" disabled>Descargar</button>
        <div id="panel-custom" hidden></div>
        <div id="divider-custom" hidden></div>
        <span id="ferrula-meta-corta">12.7 mm</span>
        <span id="ferrula-meta-larga">28.6 mm</span>
        <label class="ferrula-length-chip"><input name="ferrulaLength" type="radio" value="corta"></label>
        <label class="ferrula-length-chip"><input name="ferrulaLength" type="radio" value="larga" checked></label>
        <label class="vista-chip"><input name="modoVista" type="radio" value="lineas" checked></label>
        <label class="vista-chip"><input name="modoVista" type="radio" value="solido"></label>
    `;
}

beforeEach(() => {
    setupDOM();
    state.presetsList = [
        {
            preset: '1/2"',
            dn: 'Mini',
            ferruleOD: 25.2,
            beadDistance: 18.66,
            tubeOD: 12.7,
            tubeID: 9.4,
            tubeHeightCorta: 12.7,
            tubeHeightLarga: 28.6,
            gasketThickness: 1.4,
            standard: 'ASME',
            notaPerfil: '',
        },
        {
            preset: '1.5"',
            dn: 'TC64',
            ferruleOD: 63.9,
            beadDistance: 50.7,
            tubeOD: 38.1,
            tubeID: 34.8,
            tubeHeightCorta: 12.7,
            tubeHeightLarga: 28.6,
            gasketThickness: 2.25,
            standard: 'ASME',
            notaPerfil: 'Test note',
        },
    ];
});

describe('setSliderValue', () => {
    it('sets the value of an existing slider', () => {
        setSliderValue('tubeID', 50);
        const el = document.getElementById('tubeID') as HTMLInputElement;
        expect(el.value).toBe('50');
    });

    it('expands max when value exceeds current max', () => {
        setSliderValue('tubeID', 500);
        const el = document.getElementById('tubeID') as HTMLInputElement;
        expect(el.max).toBe('500');
        expect(el.value).toBe('500');
    });

    it('expands min when value is below current min', () => {
        setSliderValue('tubeID', 1);
        const el = document.getElementById('tubeID') as HTMLInputElement;
        expect(el.min).toBe('1');
        expect(el.value).toBe('1');
    });

    it('does nothing for NaN values', () => {
        setSliderValue('tubeID', NaN);
        const el = document.getElementById('tubeID') as HTMLInputElement;
        expect(el.value).toBe('34.8');
    });

    it('does nothing for non-existent element', () => {
        expect(() => setSliderValue('nonexistent', 10)).not.toThrow();
    });
});

describe('syncPresetNota', () => {
    it('shows note text for a valid preset index', () => {
        syncPresetNota(1);
        const el = document.getElementById('presetNota')!;
        expect(el.textContent).toBe('Test note');
        expect(el.hasAttribute('hidden')).toBe(false);
    });

    it('hides when note text is empty', () => {
        syncPresetNota(0);
        const el = document.getElementById('presetNota')!;
        expect(el.hasAttribute('hidden')).toBe(true);
    });

    it('hides for null index', () => {
        syncPresetNota(null);
        const el = document.getElementById('presetNota')!;
        expect(el.hasAttribute('hidden')).toBe(true);
    });
});

describe('setCustomSlidersVisible', () => {
    it('shows panel and divider when true', () => {
        setCustomSlidersVisible(true);
        expect(document.getElementById('panel-custom')!.hidden).toBe(false);
        expect(document.getElementById('divider-custom')!.hidden).toBe(false);
    });

    it('hides panel and divider when false', () => {
        setCustomSlidersVisible(false);
        expect(document.getElementById('panel-custom')!.hidden).toBe(true);
        expect(document.getElementById('divider-custom')!.hidden).toBe(true);
    });
});

describe('syncFerrulaLengthChipsActive', () => {
    it('adds active class to chip with checked radio', () => {
        syncFerrulaLengthChipsActive();
        const chips = document.querySelectorAll<HTMLElement>('.ferrula-length-chip');
        const checkedChip = [...chips].find((c) => c.querySelector('input:checked'));
        expect(checkedChip?.classList.contains('ferrula-length-chip--active')).toBe(true);
    });
});

describe('aplicarTipoFerrulaUI', () => {
    it('checks the correct radio button', () => {
        aplicarTipoFerrulaUI('corta');
        const cortaRadio = document.querySelector<HTMLInputElement>('input[name="ferrulaLength"][value="corta"]');
        expect(cortaRadio?.checked).toBe(true);
    });
});

describe('syncVistaChips', () => {
    it('adds active class to chip with checked vista radio', () => {
        syncVistaChips();
        const chips = document.querySelectorAll<HTMLElement>('.vista-chip');
        const checkedChip = [...chips].find((c) => c.querySelector('input:checked'));
        expect(checkedChip?.classList.contains('vista-chip--active')).toBe(true);
    });
});

describe('aplicarLongitudesASMEDesdePreset', () => {
    it('updates meta labels with preset values', () => {
        aplicarLongitudesASMEDesdePreset({ tubeHeightCorta: 15.9, tubeHeightLarga: 38.1 });
        expect(document.getElementById('ferrula-meta-corta')!.textContent).toContain('15.9');
        expect(document.getElementById('ferrula-meta-larga')!.textContent).toContain('38.1');
    });

    it('falls back to defaults when values are NaN', () => {
        aplicarLongitudesASMEDesdePreset({ tubeHeightCorta: NaN, tubeHeightLarga: NaN });
        expect(document.getElementById('ferrula-meta-corta')!.textContent).toContain('12.7');
        expect(document.getElementById('ferrula-meta-larga')!.textContent).toContain('28.6');
    });
});

describe('displayLoadState', () => {
    it('shows message in presetNota', () => {
        displayLoadState('Loading...');
        const el = document.getElementById('presetNota')!;
        expect(el.textContent).toBe('Loading...');
        expect(el.hasAttribute('hidden')).toBe(false);
    });

    it('optionally shows custom panel', () => {
        displayLoadState('Ready', true);
        expect(document.getElementById('panel-custom')!.hidden).toBe(false);
    });
});

describe('populatePresetsSelect', () => {
    it('fills select with preset options and enables download button', () => {
        const sel = populatePresetsSelect(state.presetsList);
        expect(sel.options.length).toBe(3);
        expect(sel.options[1].textContent).toBe('1/2" · Mini');
        expect(sel.options[2].textContent).toBe('1.5" · TC64');
        expect(sel.disabled).toBe(false);
        const btn = document.getElementById('btnDescargar') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });
});

describe('readDOMDimensions', () => {
    it('reads all slider values as numbers', () => {
        const dims = readDOMDimensions();
        expect(dims.tubeID).toBe(34.8);
        expect(dims.tubeOD).toBe(38.1);
        expect(dims.ferruleOD).toBe(63.9);
        expect(dims.beadDistance).toBe(50.7);
        expect(dims.spoolLength).toBe(50);
    });
});

describe('writeDOMDimensions', () => {
    it('writes partial dimensions to sliders and readout spans', () => {
        writeDOMDimensions({ tubeOD: 25.4, ferruleOD: 50.8 });
        expect((document.getElementById('val-tubeOD') as HTMLElement).innerText).toBe('25.40');
        expect((document.getElementById('ferruleOD') as HTMLInputElement).value).toBe('50.8');
    });
});

describe('getModoVista', () => {
    it('returns the value of the checked vista radio', () => {
        expect(getModoVista()).toBe('lineas');
    });
});

describe('getTipoPieza', () => {
    it('returns the tipoPieza select value', () => {
        expect(getTipoPieza()).toBe('ferrula');
    });
});
