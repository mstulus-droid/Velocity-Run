// The 3D world: owns every render piece and, once per frame, reads the game
// state and poses them — road, backdrop, city, props, traffic, the player car,
// and the chase camera.

import * as THREE from 'three';
import { ROADW, SEGLEN, SEG_R, ROAD_ROWS, CAM, CAR, COL, FOG, clamp, rnd } from '../config.js';
import { track } from '../track.js';
import { path, rebuildPath, sample, rowForDz } from './path.js';
import { Road } from './road.js';
import { Sky } from './sky.js';
import { Items } from './items.js';
import { Props } from './props.js';
import { City } from './city.js';
import { makePlayerCar, makeTrafficCar, makeTruck, tailMatPlayer, brakeMat } from './vehicles.js';
import { G, ST, wrapDz } from '../game.js';

const ROAD_TOP = 42;   // slab thickness, see road.js
const VISIBLE_DZ = (ROAD_ROWS - 8) * SEGLEN;   // game units ahead still worth posing
// Traffic is drawn this many rows ahead of its logical spot so that bumpers
// touch exactly when the crash window (dz = 1.4 segments) triggers.
const visOffsetRows = (otherLength) => ((CAR.length + otherLength) / 2 - 1.4 * SEG_R) / SEG_R;
const VIS_OFFSET = { car: visOffsetRows(CAR.length), truck: visOffsetRows(CAR.truckLength) };

/* ---------- 3D particles: nitro trail + off-road dust ---------- */
class Trail {
  constructor(scene, n) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 240, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, map: softDot(), sizeAttenuation: true, fog: true, toneMapped: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -1e6;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, life) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1e6; continue; }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 3] *= 0.9 + f * 0.1; this.col[i * 3 + 1] *= 0.9 + f * 0.1; this.col[i * 3 + 2] *= 0.9 + f * 0.1;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
function softDot() {
  const S = 64;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

/* ---------- world ---------- */
export class World {
  constructor(scene, camera, quality) {
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;

    scene.fog = new THREE.Fog(COL.fog, FOG.near, FOG.far);

    // Key light from the sun ahead (high, off to the left) so roofs and
    // flanks catch warm light; a cool fill from behind keeps the rear faces —
    // the ones the camera mostly sees — from going flat.
    const hemi = new THREE.HemisphereLight(0xd04ab0, 0x120722, 0.9);
    const sun = new THREE.DirectionalLight(0xffb377, 1.7);
    sun.position.set(-0.55, 0.9, 0.7).multiplyScalar(10000);
    const rim = new THREE.DirectionalLight(0x5ad8ff, 1.0);
    rim.position.set(0.45, 0.35, -1).multiplyScalar(10000);
    const amb = new THREE.AmbientLight(0x4a2a6a, 0.35);
    scene.add(hemi, sun, rim, amb);
    this.sun = sun; this.rim = rim;

    this.road = new Road(scene);
    this.sky = new Sky(scene, quality);
    this.items = new Items(scene);
    this.props = new Props(scene, quality);
    this.city = new City(scene, quality);
    this.trail = quality.particles ? new Trail(scene, 260) : null;

    this.player = makePlayerCar();
    scene.add(this.player);

    // traffic: one slot per possible car, each holding both body styles
    this.traffic = [];
    for (let i = 0; i < 26; i++) {
      const car = makeTrafficCar(0xffffff), truck = makeTruck(0xffffff);
      car.visible = truck.visible = false;
      scene.add(car, truck);
      this.traffic.push({ car, truck, color: -1 });
    }

    this.camLat = 0;
    this.camYaw = 0;
    this.fov = CAM.fov;
    this.roll = 0;
    this.bounce = 0;
    this._v = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._lastPos = -1;
  }

  update(dt, t) {
    rebuildPath(G.pos);
    this.road.update();
    this.props.update(track);
    this.city.update();
    this.items.update(G, t);

    const playing = G.state === ST.COUNT || G.state === ST.PLAY || G.state === ST.CRASH || G.state === ST.PAUSE;
    const spdPct = clamp(G.speed / 11000, 0, 1);

    /* player car */
    const pp = sample(path.playerRow, G.playerX, ROAD_TOP, ROADW);
    const u = this.player.userData;
    this.player.visible = playing;
    this.bounce = G.speed > 0 ? Math.sin(t * 22) * Math.min(6, G.speed / 1500) : 0;
    this.player.position.set(pp.x, pp.y + this.bounce, pp.z);
    // yaw slightly into the steer, roll against it, pitch a touch under braking
    this.player.rotation.set(G.braking ? 0.02 : -spdPct * 0.008, pp.heading - G.steerS * 0.14, -G.steerS * 0.07);
    if (G.state === ST.CRASH) {
      // spin out: a decaying yaw wobble and a lurch as the speed bleeds off
      const k = clamp(G.crashT / 1.5, 0, 1);
      const spin = Math.sin((1.5 - G.crashT) * 7) * 0.55 * k;
      this.player.rotation.y = pp.heading + spin;
      this.player.rotation.z = -spin * 0.35;
      this.player.rotation.x = -0.06 * k;
    }
    const flameScale = G.boosting ? 0.9 + Math.random() * 0.35 : 0.001;
    for (const f of u.flames) f.scale.set(1, flameScale, 1);
    u.shell.visible = G.shield;
    u.shell.rotation.y = t * 0.8;
    u.body.material[2] = G.braking ? brakeMat : tailMatPlayer;
    u.glow.material.opacity = 0.75 + 0.25 * Math.sin(t * 9);

    /* 3D particles */
    if (this.trail) {
      if (G.boosting && G.state === ST.PLAY) {
        const h = pp.heading;
        const bx = -Math.sin(h), bz = -Math.cos(h);   // backwards along the road
        for (const sx of [-0.26, 0.26]) {
          const ox = -Math.cos(h) * CAR.width * sx, oz = Math.sin(h) * CAR.width * sx;
          const cyan = Math.random() < 0.6;
          this.trail.emit(
            pp.x + ox + bx * CAR.length * 0.5, pp.y + CAR.height * 0.36, pp.z + oz + bz * CAR.length * 0.5,
            bx * 9000 + rnd(-300, 300), rnd(-100, 500), bz * 9000 + rnd(-300, 300),
            cyan ? 0.2 : 1, cyan ? 1.9 : 1.6, 2.2, rnd(0.18, 0.32));
        }
      }
      if (G.offroad && G.state === ST.PLAY && G.speed > 0) {
        const h = pp.heading;
        const side = G.playerX > 0 ? 1 : -1;
        const ox = -Math.cos(h) * CAR.width * 0.5 * side, oz = Math.sin(h) * CAR.width * 0.5 * side;
        this.trail.emit(pp.x + ox, pp.y + 40, pp.z + oz, rnd(-800, 800), rnd(300, 900), -Math.cos(h) * 3000, 0.55, 0.4, 0.75, rnd(0.3, 0.6));
      }
      this.trail.update(dt);
    }

    /* traffic */
    const cars = G.cars;
    for (let i = 0; i < this.traffic.length; i++) {
      const slot = this.traffic[i];
      const c = cars[i];
      if (!c || !playing) { slot.car.visible = slot.truck.visible = false; continue; }
      const dz = wrapDz(c.z);   // game units
      if (dz < -SEGLEN * 6 || dz > VISIBLE_DZ) { slot.car.visible = slot.truck.visible = false; continue; }
      const obj = c.truck ? slot.truck : slot.car;
      (c.truck ? slot.car : slot.truck).visible = false;
      if (slot.color !== c.color) {
        slot.color = c.color;
        for (const o of [slot.car, slot.truck]) {
          o.userData.body.material[0].color.set(c.color);
          o.userData.body.material[0].emissive.set(c.color);
        }
      }
      const p = sample(rowForDz(dz) + (c.truck ? VIS_OFFSET.truck : VIS_OFFSET.car), c.x, ROAD_TOP, ROADW);
      const lean = clamp((c.tx - c.x) * 0.6, -0.12, 0.12);
      obj.position.set(p.x, p.y + Math.sin(t * 17 + c.wobble) * 3, p.z);
      obj.rotation.set(0, p.heading - lean * 0.8, -lean * 0.5);
      obj.visible = true;
    }

    /* camera */
    const targetLat = G.playerX * 0.72;
    this.camLat += (targetLat - this.camLat) * Math.min(1, dt * CAM.lag);
    const camRow = path.playerRow - CAM.back / SEG_R;
    const cp = sample(camRow, this.camLat, ROAD_TOP + CAM.height, ROADW);
    this._camPos.set(cp.x, cp.y, cp.z);
    const lp = sample(path.playerRow + CAM.lookAhead, G.playerX * 0.35, ROAD_TOP + CAM.lookUp, ROADW);
    this._target.set(lp.x, lp.y, lp.z);

    if (G.shake > 0) {
      const s = G.shake * 4;
      this._camPos.x += rnd(-s, s); this._camPos.y += rnd(-s, s);
      this._target.x += rnd(-s, s) * 0.5;
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._target);
    // bank into corners and with the steer
    const wantRoll = -G.steerS * 0.045 + (path.heading[Math.min(path.heading.length - 1, (path.playerRow | 0) + 8)] - pp.heading) * 0.35;
    this.roll += (wantRoll - this.roll) * Math.min(1, dt * 5);
    this.camera.rotateZ(this.roll);

    // CAM.fov is the vertical fov for a 16:9 screen. Portrait phones keep the
    // same *horizontal* field of view (else the road would fill the whole
    // width), capped so it never turns into a fisheye.
    const aspect = this.camera.aspect;
    const hFov = 2 * Math.atan(Math.tan((CAM.fov * Math.PI) / 360) * (16 / 9));
    const baseFov = clamp((2 * Math.atan(Math.tan(hFov / 2) / aspect) * 180) / Math.PI, CAM.fov, 82);
    const wantFov = baseFov + (G.boosting ? CAM.fovBoost - CAM.fov : 0) + spdPct * 5;
    this.fov += (wantFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }

    this.camYaw = pp.heading;
    this.sky.update(this.camera.position, this.camYaw, dt, t);
  }

  /** Screen position (0..1) of a point on the track — used by the 2D sparks. */
  project(z, laneX) {
    const dz = wrapDz(z);
    const p = sample(rowForDz(dz), laneX, ROAD_TOP + 120, ROADW);
    this._v.set(p.x, p.y, p.z).project(this.camera);
    if (this._v.z > 1) return null;
    return { x: (this._v.x + 1) / 2, y: (1 - this._v.y) / 2 };
  }
}
