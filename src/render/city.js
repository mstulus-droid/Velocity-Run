// A neon city either side of the road: instanced boxes with a lit-window
// texture, placed deterministically from the segment index so the same
// buildings come back around every lap. Three height classes so the window
// texture tiles at a sensible density on each.

import * as THREE from 'three';
import { ROADW, COL } from '../config.js';
import { path, ROWS, sample } from './path.js';

const hash = (n) => { let x = (n * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

function windowTexture() {
  const W = 128, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#12051f'; x.fillRect(0, 0, W, H);
  const cols = 6, rows = 14, pw = W / cols, ph = H / rows;
  const tints = ['#ffbe0b', '#00f5ff', '#ff2e86', '#fff2c0', '#b829dd'];
  for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
    const on = Math.random() < 0.42;
    x.fillStyle = on ? tints[(Math.random() * tints.length) | 0] : '#1c0a2e';
    x.globalAlpha = on ? 0.55 + Math.random() * 0.45 : 1;
    x.fillRect(cc * pw + pw * 0.22, r * ph + ph * 0.25, pw * 0.56, ph * 0.5);
  }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, quality) {
    const tex = windowTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62, color: 0x7a5a98 });
    const roofMat = new THREE.MeshLambertMaterial({ color: COL.building });
    this.classes = [];
    const total = quality.buildings;
    // (height in road half-widths, window repeat) per class
    const specs = [[1.0, 2], [2.0, 4], [3.6, 7]];
    for (const [h, rep] of specs) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      // scale the side-face UVs so windows stay a constant size across classes
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * rep);
      const count = Math.max(4, Math.round(total / specs.length));
      const mesh = new THREE.InstancedMesh(geo, [mat, mat, roofMat, roofMat, mat, mat], count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.classes.push({ mesh, h, count, used: 0 });
    }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  update() {
    for (const c of this.classes) c.used = 0;
    // Slots every 3 rows; the segment index (not the row) seeds the hash so a
    // building stays put while the window slides over it.
    for (let i = 0; i < ROWS; i++) {
      const seg = path.segIndex[i];
      if (seg % 3 !== 0) continue;
      for (let side = -1; side <= 1; side += 2) {
        const r = hash(seg * 2 + (side + 1) / 2);
        if (r < 0.38) continue;                        // gap
        const cls = this.classes[Math.min(2, Math.floor(hash(seg * 7 + side) * 3))];
        if (cls.used >= cls.count) continue;
        const lat = side * (3.6 + hash(seg * 11 + side) * 7);
        const w = ROADW * (0.7 + hash(seg * 13 + side) * 1.3);
        const d = ROADW * (0.55 + hash(seg * 17 + side) * 0.5);
        const h = ROADW * cls.h * (0.75 + hash(seg * 19 + side) * 0.5);
        const p = sample(i, lat, -2, ROADW);
        this.p.set(p.x, p.y, p.z);
        this.q.setFromAxisAngle(this.up, p.heading);
        this.s.set(w, h, d);
        this.m.compose(this.p, this.q, this.s);
        cls.mesh.setMatrixAt(cls.used++, this.m);
      }
    }
    for (const c of this.classes) {
      // park the unused instances out of sight
      this.s.set(0.001, 0.001, 0.001);
      this.m.compose(this.p.set(0, -1e6, 0), this.q.identity(), this.s);
      for (let k = c.used; k < c.count; k++) c.mesh.setMatrixAt(k, this.m);
      c.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
