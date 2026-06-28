export const state = {
    presetsList: [],
    aplicandoPreset: false,
    lastTubeHeightsCortaLarga: { corta: 12.7, larga: 28.6 },
    beadRadiusFijo: 1.5,
    gasketThicknessFijo: 1.4,
    ferrHeightFijo: 2.0,
    tubeHeightFijo: 28.6,
    objetoActual: null,
    geometriaExportacion: null,
    // Estado CAD — se actualiza en cada renderPiece para que el bridge lo use
    cadParams: null,
    cadTipo: 'ferrula',
};

export function setAplicandoPreset(val) {
    state.aplicandoPreset = val;
}

export function setTubeHeightFijo(v) {
    if (Number.isFinite(v)) {
        state.tubeHeightFijo = v;
    }
}

export function setGasketThicknessFijo(v) {
    if (Number.isFinite(v)) {
        state.gasketThicknessFijo = v;
    }
}

export function setLastTubeHeightsCortaLarga(corta, larga) {
    state.lastTubeHeightsCortaLarga = { corta, larga };
}

export function setGeometriaExportacion(geo) {
    if (state.geometriaExportacion) {
        state.geometriaExportacion.dispose();
    }
    state.geometriaExportacion = geo ? geo.clone() : null;
}

export function setObjetoActual(obj) {
    state.objetoActual = obj;
}

export function setCadParams(tipo, params) {
    state.cadTipo = tipo;
    state.cadParams = params;
}
