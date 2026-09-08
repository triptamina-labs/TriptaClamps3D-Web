/** Magic numbers extracted for clarity and maintainability. */

/** Number of profile sample points for ferrule and gasket. */
export const PROFILE_POINTS_FERRULE = 60;

/** Number of profile sample points for spool (longer, needs more resolution). */
export const PROFILE_POINTS_SPOOL = 80;

/** Number of profile sample points for platter (similar length to spool). */
export const PROFILE_POINTS_PLATTER = 80;

/** Thickness of the flat bottom plate of a platter (mm). */
export const PLATTER_BOTTOM_THICKNESS = 3.0;

/** Minimum total height of a platter (mm) — keeps the body wall positive. */
export const PLATTER_MIN_HEIGHT = 15;

/** Radial segments when rendering in solid mode. */
export const SEGMENTS_SOLID = 128;

/** Radial segments for wireframe / points / mesh modes. */
export const SEGMENTS_DEFAULT = 64;

/** Threshold angle (radians) for EdgesGeometry face-angle detection. */
export const EDGES_GEOMETRY_THRESHOLD = 0.1;

/** Epsilon for constraint validation (avoids boundary collisions). */
export const CONSTRAINT_EPSILON = 0.2;

/** Minimum gap between bead-diameter bounds. */
export const CONSTRAINT_MIN_GAP = 0.5;

/** Flange taper angle in degrees. */
export const FERRULE_TAPER_ANGLE_DEG = 20;

/** Bead radius for the profile (mm). */
export const BEAD_RADIUS_DEFAULT = 1.5;

/** Default tube height for the "larga" variant (mm). */
export const TUBE_HEIGHT_LARGA_DEFAULT = 28.6;

/** Default tube height for the "corta" variant (mm). */
export const TUBE_HEIGHT_CORTA_DEFAULT = 12.7;
