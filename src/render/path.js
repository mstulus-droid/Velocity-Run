// The road path: a window of track segments turned into a curve in render space.
//
// Rebuilt every frame starting a few rows behind the player, so the loop point
// of the track never shows and floating-point stays comfortable. Each row
// carries a position, a heading and the road's left/right normal; everything
// on the road (the mesh itself, cars, coins, props) samples it via `sample()`.
//
// Curvature is applied by rotating the heading — a real bend, not the sheared
// road of the 2D build — while the amount of bend per unit of `curve` is a
// visual choice (CURVE_RAD): gameplay reads `curve` straight from the track.

import { SEGLEN, SEG_R, Y_SCALE, ROAD_ROWS, BACK_ROWS, CURVE_RAD } from '../config.js';
import { track } from '../track.js';

export const ROWS = ROAD_ROWS + BACK_ROWS;

export const path = {
  x: new Float32Array(ROWS),
  y: new Float32Array(ROWS),
  z: new Float32Array(ROWS),
  heading: new Float32Array(ROWS),
  segIndex: new Int32Array(ROWS),   // absolute track segment for each row
  baseIndex: -1,
  basePct: 0,
  playerRow: 0,                     // fractional row the player sits on
};

export function rebuildPath(pos) {
  const segs = track.segments;
  const n = segs.length;
  const baseIndex = Math.floor(pos / SEGLEN) % n;
  const basePct = (pos % SEGLEN) / SEGLEN;
  path.baseIndex = baseIndex;
  path.basePct = basePct;
  path.playerRow = BACK_ROWS + basePct;

  const startIndex = ((baseIndex - BACK_ROWS) % n + n) % n;
  const baseY = segs[baseIndex].y0 + (segs[baseIndex].y - segs[baseIndex].y0) * basePct;

  let px = 0, pz = 0, heading = 0;
  for (let i = 0; i < ROWS; i++) {
    const s = segs[(startIndex + i) % n];
    path.segIndex[i] = s.index;
    path.x[i] = px;
    path.z[i] = pz;
    path.y[i] = (s.y0 - baseY) * Y_SCALE;
    path.heading[i] = heading;
    heading -= s.curve * CURVE_RAD;      // positive curve bends right (see sample())
    px += Math.sin(heading) * SEG_R;
    pz += Math.cos(heading) * SEG_R;
  }
}

const out = { x: 0, y: 0, z: 0, heading: 0, row: 0 };

/**
 * Position on/next to the road.
 * @param row   fractional row (0 = window start; path.playerRow = the player)
 * @param lat   lateral offset in units of ROADW (negative = left)
 * @param up    height above the road surface
 */
export function sample(row, lat = 0, up = 0, ROADW = 2200) {
  const r = row < 0 ? 0 : row > ROWS - 1.001 ? ROWS - 1.001 : row;
  const i = r | 0;
  const f = r - i;
  const h = path.heading[i] + (path.heading[i + 1] - path.heading[i]) * f;
  const cx = path.x[i] + (path.x[i + 1] - path.x[i]) * f;
  const cz = path.z[i] + (path.z[i + 1] - path.z[i]) * f;
  const cy = path.y[i] + (path.y[i + 1] - path.y[i]) * f;
  // forward is (sin h, 0, cos h); right = forward × up = (-cos h, 0, sin h)
  const nx = -Math.cos(h), nz = Math.sin(h);
  out.x = cx + nx * lat * ROADW;
  out.z = cz + nz * lat * ROADW;
  out.y = cy + up;
  out.heading = h;
  out.row = r;
  return out;
}

/** Row for a thing at track distance dz (game units) ahead of the player. */
export const rowForDz = (dz) => path.playerRow + dz / SEGLEN;
