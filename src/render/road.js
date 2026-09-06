// Road + ground meshes, regenerated from the path every frame.
//
// The road is one non-indexed, vertex-coloured geometry made of parallel
// strips (rumble, neon edge, asphalt, lane dashes, slab sides). Vertices are
// not shared between strips so colours stay crisp. Positions refresh every
// frame; colours only when the window crosses a segment boundary.

import * as THREE from 'three';
import { ROADW, COL } from '../config.js';
import { path, ROWS } from './path.js';

const QUADS = ROWS - 1;

/* each strip: near/far edge as {lat, up}; colour picked per segment */
const altOf = (segIndex) => Math.floor(segIndex / 3) % 2 === 0;

const asphaltA = new THREE.Color(COL.asphaltA), asphaltB = new THREE.Color(COL.asphaltB);
const rumbleA = new THREE.Color(COL.rumbleA), rumbleB = new THREE.Color(COL.rumbleB);
const edge = new THREE.Color(COL.neonSoft).multiplyScalar(1.25);  // > 1 so bloom picks it up
const lane = new THREE.Color(COL.cyan).multiplyScalar(0.95);
const side = new THREE.Color(COL.slabSide);
const sideGlow = new THREE.Color(COL.neon).multiplyScalar(0.55);

const SLAB = 42;   // road slab thickness above the ground

const STRIPS = [
  // slab sides: edge "a" is the bottom on the left, the top on the right (winding)
  { a: { lat: -1.42, up: 0 }, b: { lat: -1.42, up: SLAB }, color: (alt, isA) => (isA ? side : sideGlow) },
  { a: { lat: 1.42, up: SLAB }, b: { lat: 1.42, up: 0 }, color: (alt, isA) => (isA ? sideGlow : side) },
  { a: { lat: -1.42, up: SLAB }, b: { lat: -1.06, up: SLAB }, color: (alt) => (alt ? rumbleA : rumbleB) },
  { a: { lat: -1.06, up: SLAB }, b: { lat: -1.015, up: SLAB }, color: () => edge },
  { a: { lat: -1.015, up: SLAB }, b: { lat: -0.352, up: SLAB }, color: (alt) => (alt ? asphaltA : asphaltB) },
  { a: { lat: -0.352, up: SLAB }, b: { lat: -0.318, up: SLAB }, color: (alt) => (alt ? lane : asphaltB) },
  { a: { lat: -0.318, up: SLAB }, b: { lat: 0.318, up: SLAB }, color: (alt) => (alt ? asphaltA : asphaltB) },
  { a: { lat: 0.318, up: SLAB }, b: { lat: 0.352, up: SLAB }, color: (alt) => (alt ? lane : asphaltB) },
  { a: { lat: 0.352, up: SLAB }, b: { lat: 1.015, up: SLAB }, color: (alt) => (alt ? asphaltA : asphaltB) },
  { a: { lat: 1.015, up: SLAB }, b: { lat: 1.06, up: SLAB }, color: () => edge },
  { a: { lat: 1.06, up: SLAB }, b: { lat: 1.42, up: SLAB }, color: (alt) => (alt ? rumbleA : rumbleB) },
];

export class Road {
  constructor(scene) {
    const verts = STRIPS.length * QUADS * 6;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.lastBase = -1;

    /* ground: two wide strips either side, textured with the scrolling grid */
    const gverts = 2 * QUADS * 6;
    this.gpos = new Float32Array(gverts * 3);
    this.guv = new Float32Array(gverts * 2);
    const ggeo = new THREE.BufferGeometry();
    ggeo.setAttribute('position', new THREE.BufferAttribute(this.gpos, 3).setUsage(THREE.DynamicDrawUsage));
    ggeo.setAttribute('uv', new THREE.BufferAttribute(this.guv, 2).setUsage(THREE.DynamicDrawUsage));
    const gmat = new THREE.MeshBasicMaterial({ map: makeGridTexture(), fog: true, toneMapped: false });
    this.ground = new THREE.Mesh(ggeo, gmat);
    this.ground.frustumCulled = false;
    scene.add(this.ground);
  }

  update() {
    const P = this.pos, C = this.col;
    const colorsDirty = path.baseIndex !== this.lastBase;
    this.lastBase = path.baseIndex;
    let v = 0;

    // per-row edge positions, computed once per row then reused by each strip
    for (let s = 0; s < STRIPS.length; s++) {
      const st = STRIPS[s];
      for (let i = 0; i < QUADS; i++) {
        const j = i + 1;
        const h0 = path.heading[i], h1 = path.heading[j];
        const nx0 = -Math.cos(h0), nz0 = Math.sin(h0);   // road "right", see path.js
        const nx1 = -Math.cos(h1), nz1 = Math.sin(h1);
        // near-left (a,i) near-right (b,i) far-right (b,j) far-left (a,j)
        const ax0 = path.x[i] + nx0 * st.a.lat * ROADW, az0 = path.z[i] + nz0 * st.a.lat * ROADW, ay0 = path.y[i] + st.a.up;
        const bx0 = path.x[i] + nx0 * st.b.lat * ROADW, bz0 = path.z[i] + nz0 * st.b.lat * ROADW, by0 = path.y[i] + st.b.up;
        const ax1 = path.x[j] + nx1 * st.a.lat * ROADW, az1 = path.z[j] + nz1 * st.a.lat * ROADW, ay1 = path.y[j] + st.a.up;
        const bx1 = path.x[j] + nx1 * st.b.lat * ROADW, bz1 = path.z[j] + nz1 * st.b.lat * ROADW, by1 = path.y[j] + st.b.up;
        let o = v * 3;
        // tri 1: a0 b0 b1
        P[o++] = ax0; P[o++] = ay0; P[o++] = az0;
        P[o++] = bx0; P[o++] = by0; P[o++] = bz0;
        P[o++] = bx1; P[o++] = by1; P[o++] = bz1;
        // tri 2: a0 b1 a1
        P[o++] = ax0; P[o++] = ay0; P[o++] = az0;
        P[o++] = bx1; P[o++] = by1; P[o++] = bz1;
        P[o++] = ax1; P[o++] = ay1; P[o++] = az1;

        if (colorsDirty) {
          const alt = altOf(path.segIndex[i]);
          const cEdgeA = st.color(alt, true), cEdgeB = st.color(alt, false);
          let c = v * 3;
          // slab sides shade their two edges differently; flat strips ignore the flag
          for (let k = 0; k < 6; k++) {
            const cc = (k === 0 || k === 3 || k === 5) ? cEdgeA : cEdgeB; // vertices on edge "a"
            C[c++] = cc.r; C[c++] = cc.g; C[c++] = cc.b;
          }
        }
        v += 6;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    if (colorsDirty) this.mesh.geometry.attributes.color.needsUpdate = true;

    /* ground */
    const GP = this.gpos, GU = this.guv;
    const GRID = 2;            // grid cell = 2 segments along the road
    const LATCELL = ROADW;     // and one road half-width across
    let g = 0, u = 0;
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      const inner = sideIdx === 0 ? -1.42 : 1.42;
      const outer = sideIdx === 0 ? -22 : 22;
      for (let i = 0; i < QUADS; i++) {
        const j = i + 1;
        const h0 = path.heading[i], h1 = path.heading[j];
        const nx0 = -Math.cos(h0), nz0 = Math.sin(h0), nx1 = -Math.cos(h1), nz1 = Math.sin(h1);
        const y0 = path.y[i] - 2, y1 = path.y[j] - 2;
        const s0 = path.segIndex[i], s1 = s0 + 1;   // unwrapped for a seamless v
        const v0 = s0 / GRID, v1 = s1 / GRID;
        const ax0 = path.x[i] + nx0 * inner * ROADW, az0 = path.z[i] + nz0 * inner * ROADW;
        const bx0 = path.x[i] + nx0 * outer * ROADW, bz0 = path.z[i] + nz0 * outer * ROADW;
        const ax1 = path.x[j] + nx1 * inner * ROADW, az1 = path.z[j] + nz1 * inner * ROADW;
        const bx1 = path.x[j] + nx1 * outer * ROADW, bz1 = path.z[j] + nz1 * outer * ROADW;
        const ua = inner * ROADW / LATCELL, ub = outer * ROADW / LATCELL;
        GP[g++] = ax0; GP[g++] = y0; GP[g++] = az0; GU[u++] = ua; GU[u++] = v0;
        GP[g++] = bx0; GP[g++] = y0; GP[g++] = bz0; GU[u++] = ub; GU[u++] = v0;
        GP[g++] = bx1; GP[g++] = y1; GP[g++] = bz1; GU[u++] = ub; GU[u++] = v1;
        GP[g++] = ax0; GP[g++] = y0; GP[g++] = az0; GU[u++] = ua; GU[u++] = v0;
        GP[g++] = bx1; GP[g++] = y1; GP[g++] = bz1; GU[u++] = ub; GU[u++] = v1;
        GP[g++] = ax1; GP[g++] = y1; GP[g++] = az1; GU[u++] = ua; GU[u++] = v1;
      }
    }
    this.ground.geometry.attributes.position.needsUpdate = true;
    this.ground.geometry.attributes.uv.needsUpdate = true;
  }
}

/** Synthwave grid: dark ground with thin magenta lines, tiled by UV. */
function makeGridTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#1a0930';
  x.fillRect(0, 0, S, S);
  const grad = x.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(255,0,110,0.06)');
  grad.addColorStop(1, 'rgba(0,245,255,0.04)');
  x.fillStyle = grad; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#b02cff';
  x.lineWidth = 5;
  x.globalAlpha = 0.85;
  x.beginPath();
  x.moveTo(0, 2.5); x.lineTo(S, 2.5);
  x.moveTo(2.5, 0); x.lineTo(2.5, S);
  x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
