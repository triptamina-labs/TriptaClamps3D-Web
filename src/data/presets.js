import { state } from './store.js';

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

export function parsePresetsCSV(text) {
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
            notaPerfil: (getCol(cols, 'notaPerfil') ?? getCol(cols, 'NotaPerfil') ?? cols[10] ?? '').trim(),
        });
    }
    return rows;
}

export async function fetchPresetsData() {
    let text = '';
    const presetUrls = [
        new URL('../presets.csv', import.meta.url).href,
        new URL('presets.csv', window.location.href).href,
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

    state.presetsList = parsePresetsCSV(text);
    return state.presetsList;
}
