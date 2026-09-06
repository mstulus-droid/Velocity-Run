// Velocity Run — central tuning.
//
// Two coordinate systems live here and it matters which is which:
//
//   * GAME units — the ones the original pseudo-3D game ran in. `pos`, `SEGLEN`,
//     `ROADW`, car speeds, collision windows. Every gameplay number below is
//     untouched from the 2D version, so the game plays identically.
//   * RENDER units — what the Three.js scene uses. Lateral (x) and vertical (y)
//     are the same as game units; the z axis is stretched by Z_STRETCH so that
//     a car long enough to look like a car still matches the collision window
//     it was tuned with. See ROAD.md-worthy note: the old renderer drew traffic
//     as flat sprites, so length never had to agree with anything.

/* ---------- track / gameplay (unchanged from the 2D build) ---------- */
export const SEGLEN = 200;          // length of one road segment, game units
export const ROADW = 2200;          // half-width of the road, game units
export const DRAW_DIST = 190;       // segments the game logic looks ahead (spawning)
export const LANE_X = [-0.66, 0, 0.66];
export const UNITS_PER_M = 110;     // game units per metre (HUD speed/distance)

/* ---------- render ---------- */
export const Z_STRETCH = 3;               // game z → render z
export const Y_SCALE = 0.35;              // hills are visual only; tame them so slopes read as roads
export const SEG_R = SEGLEN * Z_STRETCH;  // one segment in render units
export const ROAD_ROWS = DRAW_DIST;       // segments of road actually meshed
export const BACK_ROWS = 10;              // rows kept behind the player (camera sits here)
export const CURVE_RAD = 0.0030;          // radians of heading per unit of `curve`, per segment

// A fairly long lens: it keeps distant traffic legible (the 2D build's
// projection was effectively telephoto too) and flattens the road into that
// endless-highway look.
export const CAM = {
  back: 4600,        // render units behind the car
  height: 1550,      // render units above the road
  lookAhead: 7,      // segments ahead the camera aims at
  lookUp: 260,
  fov: 48,
  fovBoost: 60,
  lag: 9,            // lateral follow stiffness
};

/* Car proportions, render units. A car long enough to look like a car is
   longer than the crash window (1.4 segments), so traffic is drawn slightly
   ahead of its logical position — see VIS_OFFSET in render/world.js — which
   puts the moment of visual contact exactly on the moment of the crash. */
export const CAR = {
  width: 1150,
  height: 620,
  length: 2600,
  truckWidth: 1500,
  truckHeight: 1450,
  truckLength: 3400,
};

export const FOG = { near: 18000, far: 112000 };
export const SKY_R = 160000;              // backdrop radius; camera far plane sits beyond it

/* ---------- palette ---------- */
export const COL = {
  neon: 0xff006e,
  neonSoft: 0xff2e86,
  cyan: 0x00f5ff,
  yellow: 0xffbe0b,
  green: 0x06ffa5,
  purple: 0xb829dd,
  skyTop: 0x090318,
  skyMid: 0x2b0a4e,
  skyLow: 0x7a1360,
  fog: 0x3a0c52,
  ground: 0x1a0930,
  groundGrid: 0x8324c9,
  asphaltA: 0x241735,
  asphaltB: 0x1c1029,
  rumbleA: 0xc4105e,
  rumbleB: 0x8d84b8,
  slabSide: 0x14071f,
  mountainFar: 0x240a44,
  mountainNear: 0x160525,
  building: 0x1b0733,
};

export const CAR_COLORS = [0x00f5ff, 0xffbe0b, 0xb829dd, 0x06ffa5, 0xff8c42, 0x3b82f6];

/* ---------- quality profiles ---------- */
// Picked once at boot from the device, then downgraded automatically if the
// frame rate can't hold up (see main.js).
export const QUALITY = {
  tinggi: { label: 'TINGGI', maxPixelRatio: 2, bloom: true, bloomStrength: 0.55, antialias: true, stars: 900, props: 46, buildings: 96, particles: true },
  sedang: { label: 'SEDANG', maxPixelRatio: 1.5, bloom: true, bloomStrength: 0.45, antialias: true, stars: 500, props: 34, buildings: 64, particles: true },
  rendah: { label: 'RENDAH', maxPixelRatio: 1, bloom: false, bloomStrength: 0, antialias: false, stars: 260, props: 22, buildings: 36, particles: false },
};
export const QUALITY_ORDER = ['tinggi', 'sedang', 'rendah'];

/* ---------- small helpers shared everywhere ---------- */
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeIn = (a, b, p) => a + (b - a) * p * p;
export const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
