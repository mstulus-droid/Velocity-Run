// Low-poly vehicles built from primitives and merged into one geometry with
// three material groups (body / dark trim / lights), so a car costs three draw
// calls whatever its colour.

import * as THREE from 'three';
import { CAR, COL } from '../config.js';
import { placed, concat } from './geo.js';

/** Merge [{geo, group}] into one geometry with a material group per part kind:
 *  0 body colour, 1 dark trim, 2 lights. */
function mergeParts(parts) {
  const byGroup = [0, 1, 2].map((grp) => parts.filter((p) => p.group === grp).map((p) => p.geo));
  const merged = byGroup.map((list) => (list.length ? concat(list) : null));
  const total = merged.reduce((n, g) => n + (g ? g.attributes.position.count : 0), 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  const out = new THREE.BufferGeometry();
  let off = 0;
  merged.forEach((g, grp) => {
    if (!g) return;
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    out.addGroup(off, n, grp);
    off += n;
    g.dispose();
  });
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/* ---------- shared materials ---------- */
export const trimMat = new THREE.MeshPhongMaterial({ color: 0x0b0b16, shininess: 60, specular: 0x334455 });
export const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3b3b).multiplyScalar(2.2), toneMapped: false });
export const tailMatPlayer = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.neonSoft).multiplyScalar(2.4), toneMapped: false });
export const brakeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8080).multiplyScalar(3.2), toneMapped: false });
export const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c0).multiplyScalar(2.0), toneMapped: false });

export function bodyMaterial(hex) {
  return new THREE.MeshPhongMaterial({ color: hex, shininess: 70, specular: 0x7a6cdf, emissive: hex, emissiveIntensity: 0.06 });
}

/* ---------- geometry ---------- */
let carGeo = null, truckGeo = null, playerGeo = null;

/**
 * A sports car in three reads: body-coloured tub with the belt line, a dark
 * glass cabin on top, and a body-coloured roof panel. Profiles are drawn in
 * (length, height) and extruded across the width; nose ends up at +z.
 */
function carGeometry({ width, height, length, spoiler }) {
  const L = length, H = height, W = width;
  const LIFT = H * 0.16;   // ride height
  const bev = W * 0.035;

  // tub: nose (-L/2) → tail (+L/2), with the bonnet lower than the tail deck
  const s = new THREE.Shape();
  s.moveTo(-L * 0.5, 0);
  s.lineTo(-L * 0.5, H * 0.30);
  s.lineTo(-L * 0.44, H * 0.40);
  s.lineTo(-L * 0.10, H * 0.46);   // bonnet
  s.lineTo(-L * 0.04, H * 0.52);   // scuttle
  s.lineTo(L * 0.46, H * 0.56);    // belt line back to the tail
  s.lineTo(L * 0.5, H * 0.52);
  s.lineTo(L * 0.5, 0);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 });
  body.translate(0, 0, -W / 2);
  body.rotateY(Math.PI / 2);
  body.translate(0, LIFT, 0);

  // cabin: dark glass wedge sitting on the belt line
  const g = new THREE.Shape();
  g.moveTo(-L * 0.06, H * 0.50);
  g.lineTo(L * 0.06, H * 0.98);    // windscreen
  g.lineTo(L * 0.28, H * 1.0);     // roof
  g.lineTo(L * 0.44, H * 0.58);    // rear glass
  g.closePath();
  const glass = new THREE.ExtrudeGeometry(g, { depth: W * 0.84, bevelEnabled: false });
  glass.translate(0, 0, -W * 0.42);
  glass.rotateY(Math.PI / 2);
  glass.translate(0, LIFT, 0);

  // roof panel in body colour over the flat part of the cabin
  const roof = new THREE.BoxGeometry(W * 0.80, H * 0.05, L * 0.20);
  roof.translate(0, LIFT + H * 1.0, -L * 0.17);

  const wheelR = H * 0.27, wheelW = W * 0.17;
  const wheel = () => new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14);
  const wx = W * 0.5 - wheelW * 0.3, wz = L * 0.31;
  const lightZ = L * 0.5 + bev + 8;
  const parts = [
    { geo: body, group: 0 },
    { geo: roof, group: 0 },
    { geo: glass, group: 1 },
    { geo: placed(wheel(), -wx, wheelR, -wz, 0, 0, Math.PI / 2), group: 1 },
    { geo: placed(wheel(), wx, wheelR, -wz, 0, 0, Math.PI / 2), group: 1 },
    { geo: placed(wheel(), -wx, wheelR, wz, 0, 0, Math.PI / 2), group: 1 },
    { geo: placed(wheel(), wx, wheelR, wz, 0, 0, Math.PI / 2), group: 1 },
    // tail light bar (tail is at -z), just proud of the bevelled face
    { geo: placed(new THREE.BoxGeometry(W * 0.80, H * 0.10, 20), 0, LIFT + H * 0.40, -lightZ), group: 2 },
    // headlights (nose at +z)
    { geo: placed(new THREE.BoxGeometry(W * 0.22, H * 0.09, 16), -W * 0.30, LIFT + H * 0.34, lightZ), group: 2 },
    { geo: placed(new THREE.BoxGeometry(W * 0.22, H * 0.09, 16), W * 0.30, LIFT + H * 0.34, lightZ), group: 2 },
  ];
  if (spoiler) {
    parts.push({ geo: placed(new THREE.BoxGeometry(W * 0.94, H * 0.06, L * 0.075), 0, LIFT + H * 0.86, -L * 0.45), group: 1 });
    parts.push({ geo: placed(new THREE.BoxGeometry(W * 0.05, H * 0.26, L * 0.05), -W * 0.40, LIFT + H * 0.70, -L * 0.46), group: 1 });
    parts.push({ geo: placed(new THREE.BoxGeometry(W * 0.05, H * 0.26, L * 0.05), W * 0.40, LIFT + H * 0.70, -L * 0.46), group: 1 });
  }
  return mergeParts(parts);
}

function truckGeometry({ truckWidth: W, truckHeight: H, truckLength: L }) {
  const wheelR = H * 0.14, wheelW = W * 0.14;
  const wheel = () => new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 12);
  const wx = W * 0.5 - wheelW * 0.3;
  // nose at +z: cab in front, cargo box behind it
  const parts = [
    { geo: placed(new THREE.BoxGeometry(W, H * 0.72, L * 0.66), 0, wheelR + H * 0.36 + 10, -L * 0.14), group: 0 },   // cargo box
    { geo: placed(new THREE.BoxGeometry(W * 0.94, H * 0.5, L * 0.26), 0, wheelR + H * 0.25 + 10, L * 0.34), group: 0 }, // cab
    { geo: placed(new THREE.BoxGeometry(W * 0.9, H * 0.22, 16), 0, wheelR + H * 0.36 + 10, L * 0.47 + 6), group: 1 },  // windscreen
    { geo: placed(new THREE.BoxGeometry(W * 0.96, wheelR * 0.8, L * 0.9), 0, wheelR + 6, 0), group: 1 },              // chassis
  ];
  for (const z of [L * 0.36, -L * 0.16, -L * 0.36]) {
    parts.push({ geo: placed(wheel(), -wx, wheelR, z, 0, 0, Math.PI / 2), group: 1 });
    parts.push({ geo: placed(wheel(), wx, wheelR, z, 0, 0, Math.PI / 2), group: 1 });
  }
  parts.push({ geo: placed(new THREE.BoxGeometry(W * 0.22, H * 0.06, 16), -W * 0.34, wheelR + H * 0.08, -L * 0.47 - 4), group: 2 });
  parts.push({ geo: placed(new THREE.BoxGeometry(W * 0.22, H * 0.06, 16), W * 0.34, wheelR + H * 0.08, -L * 0.47 - 4), group: 2 });
  return mergeParts(parts);
}

/* ---------- blob shadow ---------- */
let shadowTex = null;
function shadowTexture() {
  if (shadowTex) return shadowTex;
  const S = 128;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
const shadowMat = () => new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, fog: true });

export function makeShadow(w, l) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, l * 1.1), shadowMat());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 3;
  m.renderOrder = 2;
  return m;
}

/* ---------- public factories ---------- */
export function makeTrafficCar(hex) {
  if (!carGeo) carGeo = carGeometry({ width: CAR.width, height: CAR.height, length: CAR.length, spoiler: false });
  const mesh = new THREE.Mesh(carGeo, [bodyMaterial(hex), trimMat, tailMat]);
  const root = new THREE.Group();
  root.add(mesh, makeShadow(CAR.width, CAR.length));
  root.userData.body = mesh;
  return root;
}

export function makeTruck(hex) {
  if (!truckGeo) truckGeo = truckGeometry(CAR);
  const mesh = new THREE.Mesh(truckGeo, [bodyMaterial(hex), trimMat, tailMat]);
  const root = new THREE.Group();
  root.add(mesh, makeShadow(CAR.truckWidth, CAR.truckLength));
  root.userData.body = mesh;
  return root;
}

export function makePlayerCar() {
  if (!playerGeo) playerGeo = carGeometry({ width: CAR.width, height: CAR.height, length: CAR.length, spoiler: true });
  const mats = [bodyMaterial(0xe6006a), trimMat, tailMatPlayer];
  const mesh = new THREE.Mesh(playerGeo, mats);
  const root = new THREE.Group();
  root.add(mesh, makeShadow(CAR.width, CAR.length));

  // underglow — additive pink pool of light on the road
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(CAR.width * 1.9, CAR.length * 1.3), new THREE.MeshBasicMaterial({
    map: glowTexture(), color: COL.neon, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 5; glow.renderOrder = 3;
  root.add(glow);

  // nitro flames: two cones out the back, scaled by boost
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.cyan).multiplyScalar(2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flames = [];
  for (const sx of [-0.26, 0.26]) {
    // cone tip points down -y by default; tilt so it trails out behind (-z)
    const f = new THREE.Mesh(new THREE.ConeGeometry(CAR.width * 0.09, CAR.length * 0.5, 10, 1, true), flameMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(CAR.width * sx, CAR.height * 0.36, -CAR.length * 0.5 - CAR.length * 0.25);
    f.scale.set(1, 0.001, 1);
    root.add(f); flames.push(f);
  }

  // shield: translucent shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(CAR.length * 0.62, 20, 14), new THREE.MeshBasicMaterial({
    color: COL.cyan, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: true, toneMapped: false,
  }));
  shell.scale.set(0.62, 0.45, 1);
  shell.position.y = CAR.height * 0.55;
  shell.visible = false;
  root.add(shell);

  root.userData = { body: mesh, mats, glow, flames, shell };
  return root;
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const S = 128;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
