// Roadside dressing: neon lamp posts, palms and billboard signs. Each kind has
// a small pool; every frame the visible rows of the path hand out their props
// to the pool in order, nearest first.

import * as THREE from 'three';
import { ROADW, COL } from '../config.js';
import { path, ROWS, sample } from './path.js';
import { placed, concat } from './geo.js';

const U = ROADW;   // the 2D build sized props against the road half-width; so do we

// Every prop is two or three meshes (one per material) — parts that share a
// material are merged into a single geometry so a full roadside costs a
// manageable number of draw calls on phones.
let postGeo, lampGeo, palmTrunkGeo, palmCrownGeo, signFrameGeo, signRimGeo;

function buildGeometries() {
  // lamp post: pole + arm reaching over the road on local +x
  postGeo = concat([
    placed(new THREE.CylinderGeometry(U * 0.014, U * 0.018, U * 0.55, 6), 0, U * 0.275, 0),
    placed(new THREE.BoxGeometry(U * 0.16, U * 0.02, U * 0.02), U * 0.07, U * 0.55, 0),
  ]);
  lampGeo = placed(new THREE.SphereGeometry(U * 0.045, 10, 8), U * 0.14, U * 0.55, 0);

  // palm: curved trunk, crown of seven fronds merged
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(U * 0.08, U * 0.36, 0), new THREE.Vector3(U * 0.18, U * 0.62, 0));
  palmTrunkGeo = new THREE.TubeGeometry(curve, 8, U * 0.03, 6, false);
  const top = curve.getPoint(1);
  const fronds = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    fronds.push(placed(frondGeometry(U * 0.42, U * 0.05), top.x, top.y, top.z, 0, a, 0));
  }
  palmCrownGeo = concat(fronds);

  // billboard: pole + frame in one, the two neon rims in another, panel separate
  signFrameGeo = concat([
    placed(new THREE.CylinderGeometry(U * 0.018, U * 0.018, U * 0.5, 6), 0, U * 0.25, 0),
    placed(new THREE.BoxGeometry(U * 0.52, U * 0.32, U * 0.02), 0, U * 0.5 + U * 0.16, 0),
  ]);
  signRimGeo = concat([
    placed(new THREE.BoxGeometry(U * 0.5, U * 0.012, U * 0.024), 0, U * 0.5 + U * 0.02, 0),
    placed(new THREE.BoxGeometry(U * 0.5, U * 0.012, U * 0.024), 0, U * 0.5 + U * 0.30, 0),
  ]);
}

function makePost() {
  const g = new THREE.Group();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(U * 0.9, U * 0.9), poolMat);
  pool.rotation.x = -Math.PI / 2; pool.position.y = 4; pool.renderOrder = 3;
  g.add(new THREE.Mesh(postGeo, postMat), new THREE.Mesh(lampGeo, lampMat), pool);
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(palmTrunkGeo, trunkMat), new THREE.Mesh(palmCrownGeo, leafMat));
  return g;
}

/** A frond: tapered strip that arcs up and out, then droops. Points along +z. */
function frondGeometry(len, wid) {
  const N = 6;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = 0.55 - t * 1.6;                 // starts rising, ends drooping
    const r = len * t;
    const y = Math.sin(ang) * r * 0.9 + (1 - t) * 0;
    const z = Math.cos(ang) * r;
    const w = wid * (1 - t * 0.85) * (0.4 + 0.6 * Math.sin(Math.min(1, t * 3) * Math.PI / 2));
    pos.push(-w, y, z, w, y, z);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeSign() {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(U * 0.48, U * 0.28), panelMat);
  panel.position.set(0, U * 0.5 + U * 0.16, U * 0.012);
  g.add(new THREE.Mesh(signFrameGeo, postMat), new THREE.Mesh(signRimGeo, rimMat), panel);
  g.userData.panel = panel;
  return g;
}

/* materials */
const postMat = new THREE.MeshLambertMaterial({ color: 0x2a1245 });
const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5ea0).multiplyScalar(2.6), toneMapped: false });
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x1c0836 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x0fbf7f, emissive: COL.green, emissiveIntensity: 0.28, side: THREE.DoubleSide });
const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.cyan).multiplyScalar(2.0), toneMapped: false });
let poolMat, panelMat;

function makePoolTexture() {
  const S = 128;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,94,160,0.5)'); g.addColorStop(1, 'rgba(255,94,160,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

const SIGN_TEXTS = ['RHADZOR', 'VELOCITY', 'NITRO', 'NEON DR.', 'ARCADE', 'OUTRUN', '300 KM/H', 'SYNTH'];
function makePanelTexture() {
  const W = 512, H = 300;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cols = Math.ceil(Math.sqrt(SIGN_TEXTS.length));
  // one atlas cell per text; the panel picks a cell by offsetting the UVs
  x.fillStyle = '#071a20'; x.fillRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  SIGN_TEXTS.forEach((txt, i) => {
    const cellW = W / cols, cellH = H / cols;
    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + cellH / 2;
    // shrink the font until the word fits its cell with a margin
    let size = Math.round(cellH * 0.42);
    do { x.font = `900 ${size}px Outfit, sans-serif`; size -= 2; } while (x.measureText(txt).width > cellW * 0.86 && size > 8);
    x.fillStyle = i % 2 ? '#ff2e86' : '#00f5ff';
    x.shadowColor = x.fillStyle; x.shadowBlur = 18;
    x.fillText(txt, cx, cy);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, cols };
}

export class Props {
  constructor(scene, quality) {
    poolMat = new THREE.MeshBasicMaterial({ map: makePoolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, toneMapped: false });
    const { tex, cols } = makePanelTexture();
    this.panelCols = cols;
    panelMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    buildGeometries();

    this.pools = { post: [], palm: [], sign: [] };
    const n = quality.props;
    const counts = { post: Math.round(n * 0.55), palm: Math.round(n * 0.28), sign: Math.max(3, Math.round(n * 0.17)) };
    for (let i = 0; i < counts.post; i++) { const m = makePost(); m.visible = false; scene.add(m); this.pools.post.push(m); }
    for (let i = 0; i < counts.palm; i++) { const m = makePalm(); m.visible = false; scene.add(m); this.pools.palm.push(m); }
    for (let i = 0; i < counts.sign; i++) {
      const m = makeSign(); m.visible = false; scene.add(m);
      // each sign gets its own material clone so it can show its own text
      const p = m.userData.panel;
      p.material = panelMat.clone();
      p.material.map = tex.clone();
      p.material.map.repeat.set(1 / cols, 1 / cols);
      this.pools.sign.push(m);
    }
  }

  update(track) {
    const used = { post: 0, palm: 0, sign: 0 };
    const segs = track.segments;
    for (let i = 0; i < ROWS; i++) {
      const s = segs[path.segIndex[i]];
      if (!s.props || s.props.length === 0) continue;
      for (const pr of s.props) {
        const pool = this.pools[pr.kind];
        if (used[pr.kind] >= pool.length) continue;
        const m = pool[used[pr.kind]++];
        const p = sample(i, pr.side * 1.62, 0, ROADW);
        m.position.set(p.x, p.y, p.z);
        m.rotation.set(0, p.heading + (pr.kind === 'palm' ? s.index * 1.7 : 0), 0);
        // lat+ is local -x (see path.js): the arm (built on +x) already reaches
        // over the road for the right-hand side; spin left-hand posts round
        if (pr.kind === 'post' && pr.side < 0) m.rotation.y += Math.PI;
        if (pr.kind === 'sign') {
          const cell = s.index % (this.panelCols * this.panelCols);
          m.userData.panel.material.map.offset.set((cell % this.panelCols) / this.panelCols, 1 - (Math.floor(cell / this.panelCols) + 1) / this.panelCols);
          m.rotation.y = p.heading + Math.PI;   // face the oncoming driver
        }
        m.visible = true;
      }
    }
    for (const kind in this.pools) for (let k = used[kind]; k < this.pools[kind].length; k++) this.pools[kind][k].visible = false;
  }
}
