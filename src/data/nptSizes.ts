/**
 * Fixed NPT female union sizes (round body, no hex).
 *
 * Source of record is `src/npt.csv` (mirrors how `src/presets.csv` drives the
 * ASME BPE tri-clamp table). Thread geometry per ANSI/ASME B1.20.1 (NPT):
 * 60 deg thread angle, thread height = 0.8 x pitch, `e1Diameter` = pitch
 * diameter at the mouth of the internal thread (= bore at the thread roots),
 * `threadLength` = L2 (effective/wrench thread length per mouth).
 * Body dimensions per ASME B16.11 full coupling (3000# threaded).
 */
import type { NptUnionParams } from '../cad/profileDescriptor.js';

/** One fully specified, non-editable NPT union size. */
export interface NptSize extends NptUnionParams {
    /** Display label, e.g. `1/4"`. */
    preset: string;
    /** Threads per inch. */
    tpi: number;
    standard: string;
    notaPerfil: string;
}

export const NPT_CSV_FALLBACK = `Preset,TPI,pitch,e1Diameter,bodyOD,bodyLength,threadLength,threadHeight,Standard,notaPerfil
1/8",27,0.9407,9.489,16,32,6.703,0.7526,NPT ANSI B1.20.1 · ASME B16.11,OD 16 mm · largo 32 mm · 27 TPI
1/4",18,1.4111,12.487,19,35,10.206,1.1289,NPT ANSI B1.20.1 · ASME B16.11,OD 19 mm · largo 35 mm · 18 TPI
1/2",14,1.8143,19.772,28,48,13.556,1.4514,NPT ANSI B1.20.1 · ASME B16.11,OD 28 mm · largo 48 mm · 14 TPI
1",11.5,2.2087,31.461,44,60,17.343,1.767,NPT ANSI B1.20.1 · ASME B16.11,OD 44 mm · largo 60 mm · 11.5 TPI
1 1/2",11.5,2.2087,46.287,64,79,18.377,1.767,NPT ANSI B1.20.1 · ASME B16.11,OD 64 mm · largo 79 mm · 11.5 TPI
`;

/** Parse raw CSV text into typed NPT size rows (mirrors parsePresetsCSV). */
export function parseNptCSV(text: string): NptSize[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    const headerIndex = new Map<string, number>(headers.map((h, i) => [h, i]));
    const getCol = (cols: string[], name: string): string | undefined => {
        const idx = headerIndex.get(name);
        return idx !== undefined ? cols[idx] : undefined;
    };
    const rows: NptSize[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = line.split(',');
        if (cols.length < 8) continue;
        rows.push({
            preset: (getCol(cols, 'Preset') ?? cols[0]).trim(),
            tpi: parseFloat(getCol(cols, 'TPI') ?? cols[1]),
            pitch: parseFloat(getCol(cols, 'pitch') ?? cols[2]),
            e1Diameter: parseFloat(getCol(cols, 'e1Diameter') ?? cols[3]),
            bodyOD: parseFloat(getCol(cols, 'bodyOD') ?? cols[4]),
            bodyLength: parseFloat(getCol(cols, 'bodyLength') ?? cols[5]),
            threadLength: parseFloat(getCol(cols, 'threadLength') ?? cols[6]),
            threadHeight: parseFloat(getCol(cols, 'threadHeight') ?? cols[7]),
            standard: (getCol(cols, 'Standard') ?? cols[8] ?? '').trim(),
            notaPerfil: (getCol(cols, 'notaPerfil') ?? cols[9] ?? '').trim(),
        });
    }
    return rows;
}

let _sizes: NptSize[] = [];

/** Currently loaded NPT size table. Falls back to the embedded CSV if the fetch never ran. */
export function getNptSizes(): NptSize[] {
    if (_sizes.length === 0) {
        _sizes = parseNptCSV(NPT_CSV_FALLBACK);
    }
    return _sizes;
}

/** Default selected size index (1/4"). */
export const NPT_DEFAULT_INDEX = 1;

/**
 * Fetch the NPT size CSV from the closest reachable URL, falling back to an
 * embedded table if both URLs fail (same strategy as fetchPresetsData).
 */
export async function fetchNptSizes(): Promise<NptSize[]> {
    let text = '';
    const urls = [new URL('../npt.csv', import.meta.url).href, new URL('npt.csv', window.location.href).href];
    try {
        for (const u of urls) {
            const r = await fetch(u);
            if (r.ok) {
                text = await r.text();
                break;
            }
        }
        if (!text) text = NPT_CSV_FALLBACK;
    } catch (_) {
        text = NPT_CSV_FALLBACK;
    }
    _sizes = parseNptCSV(text);
    return _sizes;
}
