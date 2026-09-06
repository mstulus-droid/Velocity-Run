// Backdrop: gradient sky dome, striped synth sun, stars and two mountain
// ridges. The whole group rides along with the camera and its yaw follows the
// camera with a lag, so the sun and the ridges slide across the screen as you
// turn and settle again — the same parallax trick the 2D build used, now in
// three dimensions. Nothing here is fogged; the ridges are coloured to melt
// into the fog at their base instead.

import * as THREE from 'three';
import { COL, SKY_R } from '../config.js';

const R = SKY_R;   // dome radius — inside the camera's far plane

export class Sky {
  constructor(scene, quality) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.yaw = 0;

    /* dome */
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(COL.skyTop) },
        mid: { value: new THREE.Color(COL.skyMid) },
        low: { value: new THREE.Color(COL.skyLow) },
      },
      vertexShader: `
        varying float vH;
        void main(){ vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying float vH;
        void main(){
          float h = clamp(vH, -0.05, 1.0);
          vec3 c = h < 0.18 ? mix(low, mid, smoothstep(-0.05, 0.18, h)) : mix(mid, top, smoothstep(0.18, 0.75, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 18), domeMat);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    /* stars: a sprinkle on the upper dome */
    const n = quality.stars;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.08 + Math.pow(Math.random(), 0.7) * 0.85;   // elevation, thins out near the horizon
      const r = R * 0.94;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      const b = 0.45 + Math.random() * 0.55;
      const tint = Math.random();
      col[i * 3] = b * (tint < 0.15 ? 1.0 : 0.9);
      col[i * 3 + 1] = b * (tint < 0.15 ? 0.75 : 0.95);
      col[i * 3 + 2] = b;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sgeo, new THREE.PointsMaterial({
      size: 3.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, opacity: 0.9,
      map: makeStarTexture(), alphaTest: 0.05,
    }));
    this.stars.renderOrder = -99;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    /* sun + halo, kept at the horizon dead ahead (with lag) */
    this.sunPivot = new THREE.Group();
    this.group.add(this.sunPivot);
    const sunSize = R * 0.36;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(sunSize * 3.2, sunSize * 3.2), new THREE.MeshBasicMaterial({
      map: makeHaloTexture(), transparent: true, depthWrite: false, fog: false, toneMapped: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.position.set(0, R * 0.055, R * 0.92);     // +z is "ahead" at heading 0
    halo.rotation.y = Math.PI;
    halo.renderOrder = -98;
    this.sunPivot.add(halo);
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(sunSize, sunSize), new THREE.MeshBasicMaterial({
      map: makeSunTexture(), transparent: true, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.sun.position.set(0, R * 0.06, R * 0.9);
    this.sun.rotation.y = Math.PI;
    this.sun.renderOrder = -97;
    this.sunPivot.add(this.sun);
    this.sunYaw = 0;

    /* mountain ridges — full rings so no edge ever shows */
    this.ridgeFar = makeRidge(R * 0.86, R * 0.115, COL.mountainFar, 7);
    this.ridgeFar.renderOrder = -96;
    this.ridgeNear = makeRidge(R * 0.80, R * 0.075, COL.mountainNear, 31);
    this.ridgeNear.renderOrder = -95;
    this.group.add(this.ridgeFar, this.ridgeNear);
    this.farYaw = 0; this.nearYaw = 0;
  }

  /** @param camPos camera world position; @param camYaw the camera's heading (radians) */
  update(camPos, camYaw, dt, t) {
    this.group.position.copy(camPos);
    // Each layer chases the camera heading at its own pace: the far ridge
    // barely moves, the near ridge swings more, the sun sits in between.
    this.farYaw += (camYaw - this.farYaw) * Math.min(1, dt * 6);
    this.nearYaw += (camYaw - this.nearYaw) * Math.min(1, dt * 2.2);
    this.sunYaw += (camYaw - this.sunYaw) * Math.min(1, dt * 3.4);
    this.ridgeFar.rotation.y = this.farYaw;
    this.ridgeNear.rotation.y = this.nearYaw;
    this.sunPivot.rotation.y = this.sunYaw;
    this.stars.rotation.y = this.farYaw + t * 0.004;
    this.stars.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.7);
  }
}

/* ---------- textures & geometry ---------- */

function makeSunTexture() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#ffe08a'); g.addColorStop(0.45, '#ff5e8a'); g.addColorStop(1, '#ff006e');
  x.fillStyle = g;
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2); x.fill();
  // the stripes: wider towards the bottom, like a scanline sunset
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const yy = S * 0.5 + S * 0.05 + i * S * 0.065;
    const h = Math.max(3, S * 0.016 * (i * 0.55 + 0.6));
    x.fillRect(0, yy, S, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarTexture() {
  const S = 32;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function makeHaloTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(255,40,140,0.55)');
  g.addColorStop(0.45, 'rgba(255,0,110,0.18)');
  g.addColorStop(1, 'rgba(255,0,110,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A ring of jagged peaks around the origin, periodic so it has no seam. */
function makeRidge(radius, amp, color, seed) {
  const N = 180;
  const verts = new Float32Array(N * 6 * 3);
  const phase = (k) => ((seed * 9301 + k * 49297) % 233280) / 233280 * Math.PI * 2;
  const h = (a) => {
    let v = 0.35;
    v += 0.30 * Math.abs(Math.sin(a * 3 + phase(1)));
    v += 0.22 * Math.abs(Math.sin(a * 7 + phase(2)));
    v += 0.14 * Math.abs(Math.sin(a * 13 + phase(3)));
    v += 0.09 * Math.abs(Math.sin(a * 23 + phase(4)));
    return v;
  };
  const bottom = -radius * 0.06;   // dip below the horizon so the base is hidden
  let o = 0;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const x0 = Math.sin(a0) * radius, z0 = -Math.cos(a0) * radius;
    const x1 = Math.sin(a1) * radius, z1 = -Math.cos(a1) * radius;
    const y0 = h(a0) * amp, y1 = h(a1) * amp;
    verts.set([x0, bottom, z0, x1, bottom, z1, x1, y1, z1, x0, bottom, z0, x1, y1, z1, x0, y0, z0], o);
    o += 18;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.frustumCulled = false;
  return mesh;
}
