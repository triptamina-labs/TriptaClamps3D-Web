import type * as THREE from 'three';

/** All dimensions relevant to profile generation and export. */
export interface Dimensions {
    tubeID: number;
    tubeOD: number;
    ferruleOD: number;
    beadDistance: number;
    spoolLength: number;
    platterHeight: number;
}

/** Piece type identifiers. */
export type PieceType = 'ferrula' | 'gasket' | 'spool' | 'endcap' | 'platter' | 'nptUnion';

/** Cad export format identifiers. */
export type CadFormat = 'step' | 'brep' | 'both';

/**
 * Core application state — all mutable state lives here.
 * External code should use the exported getters/setters
 * rather than accessing this object directly.
 */
export interface AppState {
    presetsList: PresetRow[];
    aplicandoPreset: boolean;
    lastTubeHeightsCortaLarga: { corta: number; larga: number };
    beadRadiusFijo: number;
    gasketThicknessFijo: number;
    ferrHeightFijo: number;
    tubeHeightFijo: number;
    objetoActual: THREE.Object3D | null;
    geometriaExportacion: THREE.BufferGeometry | null;
    cadParams: Record<string, number> | null;
    cadTipo: PieceType;
}

/** CSV row shape for ASME BPE presets. */
export interface PresetRow {
    preset: string;
    dn: string;
    ferruleOD: number;
    beadDistance: number;
    tubeOD: number;
    tubeID: number;
    tubeHeightCorta: number;
    tubeHeightLarga: number;
    gasketThickness: number;
    standard: string;
    notaPerfil: string;
}

const _state: AppState = {
    presetsList: [],
    aplicandoPreset: false,
    lastTubeHeightsCortaLarga: { corta: 12.7, larga: 28.6 },
    beadRadiusFijo: 1.5,
    gasketThicknessFijo: 1.4,
    ferrHeightFijo: 2.0,
    tubeHeightFijo: 28.6,
    objetoActual: null,
    geometriaExportacion: null,
    cadParams: null,
    cadTipo: 'ferrula',
};

// Backward-compatible export (removed in final refactor wave)
export const state = _state;

// ── Getters ──────────────────────────────────────────────

export function getPresetsList(): PresetRow[] {
    return _state.presetsList;
}

export function getAplicandoPreset(): boolean {
    return _state.aplicandoPreset;
}

export function getLastTubeHeightsCortaLarga(): { corta: number; larga: number } {
    return _state.lastTubeHeightsCortaLarga;
}

export function getBeadRadiusFijo(): number {
    return _state.beadRadiusFijo;
}

export function getGasketThicknessFijo(): number {
    return _state.gasketThicknessFijo;
}

export function getFerrHeightFijo(): number {
    return _state.ferrHeightFijo;
}

export function getTubeHeightFijo(): number {
    return _state.tubeHeightFijo;
}

export function getObjetoActual(): THREE.Object3D | null {
    return _state.objetoActual;
}

export function getGeometriaExportacion(): THREE.BufferGeometry | null {
    return _state.geometriaExportacion;
}

export function getCadParams(): Record<string, number> | null {
    return _state.cadParams;
}

export function getCadTipo(): PieceType {
    return _state.cadTipo;
}

// ── Setters ──────────────────────────────────────────────

export function setAplicandoPreset(val: boolean): void {
    _state.aplicandoPreset = val;
}

export function setTubeHeightFijo(v: number): void {
    if (Number.isFinite(v)) {
        _state.tubeHeightFijo = v;
    }
}

export function setGasketThicknessFijo(v: number): void {
    if (Number.isFinite(v)) {
        _state.gasketThicknessFijo = v;
    }
}

export function setLastTubeHeightsCortaLarga(corta: number, larga: number): void {
    _state.lastTubeHeightsCortaLarga = { corta, larga };
}

export function setGeometriaExportacion(geo: THREE.BufferGeometry | null): void {
    if (_state.geometriaExportacion) {
        _state.geometriaExportacion.dispose();
    }
    _state.geometriaExportacion = geo ? geo.clone() : null;
}

export function setObjetoActual(obj: THREE.Object3D | null): void {
    _state.objetoActual = obj;
}

export function setCadParams(tipo: PieceType, params: Record<string, number>): void {
    _state.cadTipo = tipo;
    _state.cadParams = params;
}
