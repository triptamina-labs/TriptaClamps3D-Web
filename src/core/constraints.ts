import type { Dimensions, PieceType } from '../data/store.js';
import { CONSTRAINT_EPSILON, CONSTRAINT_MIN_GAP, PLATTER_MIN_HEIGHT } from './constants.js';

/**
 * Validate and clamp dimensions according to geometric constraints
 * for the given piece type. Returns a new dimensions object (pure).
 *
 * This is the single source of truth — used by both the interactive
 * renderer (main.ts) and the bulk-export pipeline (bulkExport.ts).
 */
export function validateAndClampDimensions(tipo: PieceType, dims: Dimensions, beadRadius: number): Dimensions {
    const bR = beadRadius;
    const d = { ...dims };

    if (tipo === 'gasket') {
        if (d.ferruleOD < d.tubeID + 5) {
            d.ferruleOD = d.tubeID + 5;
        }
        const minBD = d.tubeID + bR * 2 + CONSTRAINT_MIN_GAP;
        const maxBD = d.ferruleOD - bR * 2 - CONSTRAINT_MIN_GAP;
        if (d.beadDistance < minBD) d.beadDistance = minBD;
        if (d.beadDistance > maxBD) d.beadDistance = maxBD;
    } else if (tipo === 'endcap') {
        let rF = d.ferruleOD / 2;
        let rbD = d.beadDistance / 2;

        if (rbD - bR < CONSTRAINT_EPSILON) {
            rbD = bR + CONSTRAINT_EPSILON;
            d.beadDistance = 2 * rbD;
        }
        if (rbD + bR > rF - CONSTRAINT_EPSILON) {
            rbD = rF - bR - CONSTRAINT_EPSILON;
            d.beadDistance = 2 * rbD;
        }
        if (rbD - bR < CONSTRAINT_EPSILON) {
            rbD = bR + CONSTRAINT_EPSILON;
            d.beadDistance = 2 * rbD;
            rF = rbD + bR + CONSTRAINT_EPSILON;
            d.ferruleOD = 2 * rF;
        }
    } else if (tipo === 'nptUnion') {
        // NPT union sizes are fully fixed (ASME B16.11 body + ANSI B1.20.1 thread):
        // nothing to clamp, the profile reads its own size record.
        return d;
    } else {
        // default: ferrule / spool
        if (d.tubeOD <= d.tubeID + 1) d.tubeOD = d.tubeID + 1;
        if (d.ferruleOD <= d.tubeOD + 2) d.ferruleOD = d.tubeOD + 2;
        if (d.beadDistance - bR * 2 <= d.tubeOD) {
            d.beadDistance = d.tubeOD + bR * 2 + CONSTRAINT_EPSILON;
        }
        if (d.beadDistance + bR * 2 >= d.ferruleOD) {
            d.beadDistance = d.ferruleOD - bR * 2 - CONSTRAINT_EPSILON;
        }
        // platter: keep the vessel body tall enough for the flat bottom + flange
        if (tipo === 'platter' && d.platterHeight < PLATTER_MIN_HEIGHT) {
            d.platterHeight = PLATTER_MIN_HEIGHT;
        }
    }

    return d;
}
