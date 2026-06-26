// --- Gold / Black / White color palette ---
export const BG            = [13, 14, 15]    as const;  // tinted graphite background
export const PANEL_BG      = [24, 25, 27]    as const;  // panel fill
export const PANEL_BG_HOVER = [34, 35, 38]    as const;  // panel hover
export const GOLD          = [212, 175, 55]  as const;  // primary gold
export const GOLD_DIM      = [139, 105, 20]  as const;  // dim gold / borders
export const GOLD_HOVER    = [255, 215, 0]   as const;  // bright gold hover
export const WHITE         = [232, 230, 224] as const;  // main text
export const WHITE_DIM     = [153, 151, 143] as const;  // secondary text
export const BLACK         = [13, 14, 15]    as const;

// --- Player colours ---
export interface PlayerColor {
  name: string;
  base: readonly [number, number, number];
  rim:  readonly [number, number, number];
  trail: readonly [number, number, number];
}

export const PLAYER_COLORS: readonly PlayerColor[] = [
  { name: "Red",     base: [255, 60,  60],  rim: [160, 20,  20], trail: [255, 130, 140] },
  { name: "Blue",    base: [60,  140, 255], rim: [20,  70, 180], trail: [120, 200, 255] },
  { name: "Green",   base: [60,  220, 80],  rim: [20,  120, 40], trail: [130, 255, 160] },
  { name: "Yellow",  base: [255, 220, 40],  rim: [160, 120, 0],  trail: [255, 240, 140] },
  { name: "Magenta", base: [220, 40,  210], rim: [130, 10, 120], trail: [255, 140, 250] },
  { name: "Cyan",    base: [40,  200, 220], rim: [0,   110, 140], trail: [140, 255, 255] },
];

// --- Grid ---
export const UI_HEIGHT = 56;
export const GRID_LINE = [58, 57, 52] as const;

// --- Animation timing ---
export const SPIN_SPEED        = 0.85;
export const EXPLODE_DELAY_MS  = 60;
export const BURST_DURATION_MS = 100;
export const FLY_DURATION_MS   = 320;

// --- Orb appearance ---
export const ORB_RADIUS_RATIO   = 0.24;
export const ORB_OVERLAP_RATIO  = 0.55;

// Grid / player options
export const GRID_OPTIONS   = [5, 6, 7, 8, 9, 10, 11, 12] as const;
export const PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;
