// Game rules: traffic, pickups, speed, scoring, state machine.
//
// Every number in here is carried over unchanged from the 2D build — the
// upgrade is purely in how the world is drawn, so a run should play exactly
// like it used to. The renderer only ever reads this state.

import { SEGLEN, DRAW_DIST, LANE_X, UNITS_PER_M, CAR_COLORS, rnd, clamp } from './config.js';
import { track, buildTrack, findSegment } from './track.js';
import { Snd } from './audio.js';
import { steerAxis, boostHeld, input } from './input.js';
import * as UI from './ui.js';
import * as FX from './fx.js';
import { $ } from './i18n.js';

export const ST = { MENU: 0, COUNT: 1, PLAY: 2, CRASH: 3, OVER: 4, PAUSE: 5 };

export const G = {
  state: ST.MENU, prevState: ST.MENU,
  pos: 0, playerX: 0, speed: 0, steerS: 0,
  distM: 0, coinCount: 0, nearMisses: 0, nmScore: 0,
  combo: 0, comboT: 0, maxCombo: 0,
  nitro: 40, boosting: false, shield: false,
  crashT: 0, shake: 0, t: 0, hitstopT: 0,
  countT: 0, lastCount: 0,
  nextMile: 1000, topKmh: 0, kmh: 0, pickupT: 8, skidT: 0,
  offroad: false, braking: false,
  cars: [], coins: [], pickups: [],
  best: +localStorage.getItem('vr_best') || 0,
  bestScore: +localStorage.getItem('vr_bestscore') || 0,
};

export function maxSpeed() {
  const kmRamp = Math.min(G.distM / 1000, 5);
  return (7700 + kmRamp * 420) * (G.boosting ? 1.45 : 1);
}
const trafficTarget = () => Math.min(8 + Math.floor(G.distM / 350), 24);
export const scoreNow = () => Math.floor(G.distM) + G.coinCount * 50 + G.nmScore;

/* ---------- spawning ---------- */
export function wrapDz(z) {
  let dz = z - G.pos;
  if (dz < -track.length / 2) dz += track.length;
  if (dz > track.length / 2) dz -= track.length;
  return dz;
}
function laneBusy(z, lx) {
  for (const c of G.cars) {
    let a = c.z - z;
    if (a < -track.length / 2) a += track.length;
    if (a > track.length / 2) a -= track.length;
    if (Math.abs(a) < SEGLEN * 5 && Math.abs(c.x - lx) < 0.5) return true;
  }
  return false;
}
function spawnCarAhead(zMin, zMax) {
  const z = (G.pos + rnd(zMin, zMax)) % track.length;
  let lx = LANE_X[(Math.random() * 3) | 0];
  for (let tries = 0; tries < 3 && laneBusy(z, lx); tries++) lx = LANE_X[(Math.random() * 3) | 0];
  if (laneBusy(z, lx)) return;
  const km = G.distM / 1000;
  const truck = Math.random() < clamp(0.10 + km * 0.02, 0.10, 0.24);
  G.cars.push({
    z, x: lx, tx: lx,
    speed: maxSpeed() * rnd(0.30, 0.48) * (truck ? 0.75 : 1),
    color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
    truck, halfW: truck ? 0.40 : 0.30,
    passed: false, changeT: rnd(2, 7),
    wobble: Math.random() * 6.28,
  });
}
function spawnCoinRow() {
  let li = (Math.random() * 3) | 0;
  const slalom = Math.random() < 0.45;
  let dir = Math.random() < 0.5 ? -1 : 1;
  const startDz = rnd(SEGLEN * 70, SEGLEN * 150);
  const n = 4 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    G.coins.push({ z: (G.pos + startDz + i * SEGLEN * 2.2) % track.length, x: LANE_X[li], taken: false, spin: Math.random() * 6.28 });
    if (slalom && i % 2 === 1) { li += dir; if (li < 0 || li > 2) { dir *= -1; li += dir * 2; } }
  }
}
function spawnPickup() {
  const z = (G.pos + rnd(SEGLEN * 90, SEGLEN * 170)) % track.length;
  const lx = LANE_X[(Math.random() * 3) | 0];
  if (laneBusy(z, lx)) return;
  G.pickups.push({ z, x: lx, kind: Math.random() < 0.55 ? 'nitro' : 'shield', taken: false });
}

/* ---------- flow ---------- */
export function toMenu() {
  G.state = ST.MENU;
  UI.show('menu', true); UI.show('overOv', false); UI.show('pauseOv', false);
  UI.hudOn(false);
  $('menuBest').textContent = G.bestScore + ' pts · ' + UI.fmtDist(G.best);
  Snd.stopEngine();
}

export function newGame() {
  buildTrack();
  G.cars = []; G.coins = []; G.pickups = [];
  FX.clearFx();
  G.pos = 0; G.playerX = 0; G.speed = 0; G.steerS = 0;
  G.distM = 0; G.coinCount = 0; G.nearMisses = 0; G.nmScore = 0;
  G.combo = 0; G.comboT = 0; G.maxCombo = 0;
  G.nitro = 40; G.boosting = false; G.shield = false;
  G.crashT = 0; G.shake = 0; G.hitstopT = 0; G.nextMile = 1000; G.topKmh = 0; G.kmh = 0; G.pickupT = 8;
  G.offroad = false; G.braking = false;
  for (let i = 0; i < 9; i++) spawnCarAhead(SEGLEN * 40, SEGLEN * DRAW_DIST * 1.4);
  for (let i = 0; i < 4; i++) spawnCoinRow();
  spawnPickup();
  UI.show('menu', false); UI.show('overOv', false); UI.show('pauseOv', false);
  UI.hudOn(true);
  UI.setCombo(0); UI.setShield(false);
  $('hBest').textContent = G.bestScore;
  $('hCoins').textContent = '⬤ 0';
  $('hScore').textContent = '0';
  if ('ontouchstart' in window) $('touchHint').classList.add('on');
  G.countT = 3.0; G.lastCount = 4;
  G.state = ST.COUNT;
  Snd.ensure(); Snd.startEngine();
}

function endGame() {
  G.state = ST.OVER;
  Snd.stopEngine();
  const score = scoreNow();
  const total = Math.floor(G.distM);
  const isBest = score > G.bestScore && score > 0;
  if (isBest) { G.bestScore = score; localStorage.setItem('vr_bestscore', G.bestScore); Snd.best(); }
  if (total > G.best) { G.best = total; localStorage.setItem('vr_best', G.best); }
  UI.showGameOver({ score, bestScore: G.bestScore, dist: total, coins: G.coinCount, nearMisses: G.nearMisses, maxCombo: G.maxCombo, topKmh: G.topKmh, isBest });
}

export function pauseGame() {
  if (G.state !== ST.PLAY && G.state !== ST.COUNT) return;
  G.prevState = G.state; G.state = ST.PAUSE;
  UI.show('pauseOv', true);
  Snd.setEngine(0);
}
export function resumeGame() {
  if (G.state !== ST.PAUSE) return;
  G.state = G.prevState;
  UI.show('pauseOv', false);
}

function crash() {
  if (G.shield) {
    G.shield = false; UI.setShield(false);
    Snd.noise(0.25, 0.3, 1200); G.shake = 10;
    FX.pop('SHIELD SAVED YOU!', 0.42, '#00f5ff', 1.2);
    G.speed *= 0.5;
    return;
  }
  G.state = ST.CRASH; G.crashT = 1.5; G.shake = 22; G.combo = 0; G.comboT = 0;
  UI.setCombo(0);
  Snd.crash(); Snd.stopEngine();
  UI.flash();
  for (let i = 0; i < 46; i++) {
    FX.spark(0.5 + rnd(-0.03, 0.03), 0.72 + rnd(-0.03, 0.03), {
      vx: rnd(-0.6, 0.6), vy: rnd(-1.1, 0.1), life: rnd(0.5, 1.2), r: rnd(2, 7),
      c: Math.random() < 0.5 ? '255,80,30' : '255,190,11', grav: 1.8,
    });
  }
}

/* ---------- per-frame update ---------- */
export function update(dt) {
  G.t += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);

  if (G.state === ST.COUNT) {
    G.countT -= dt;
    Snd.setEngine(0.35 + 0.3 * Math.abs(Math.sin(G.t * 5)));
    const n = Math.ceil(G.countT);
    if (n < G.lastCount && n > 0) { G.lastCount = n; Snd.count(); }
    if (G.countT <= 0) { G.state = ST.PLAY; Snd.go(); FX.pop('GO!', 0.4, '#06ffa5', 2); }
    FX.updateFx(dt);
    return;
  }

  if (G.state === ST.CRASH) {
    G.crashT -= dt;
    G.speed = Math.max(0, G.speed - dt * 9000);
    G.pos += G.speed * dt;
    if (G.pos >= track.length) G.pos -= track.length;
    FX.updateFx(dt);
    if (G.crashT <= 0) endGame();
    return;
  }
  if (G.state !== ST.PLAY) { FX.updateFx(dt); return; }

  if (G.hitstopT > 0) { G.hitstopT -= dt; dt *= 0.3; }   // brief slow-mo on a near miss

  const steer = steerAxis();
  G.steerS += (steer - G.steerS) * Math.min(1, dt * 11);

  const wasBoosting = G.boosting;
  G.boosting = boostHeld() && G.nitro > 0;
  if (G.boosting && !wasBoosting) Snd.nitroGo();
  if (G.boosting) G.nitro = Math.max(0, G.nitro - 30 * dt);

  const mx = maxSpeed();
  G.braking = input.brake;
  if (input.brake) G.speed = Math.max(G.speed - mx * 1.5 * dt, mx * 0.22);
  else G.speed = Math.min(G.speed + mx * 0.34 * dt, mx);
  if (G.speed > mx) G.speed = Math.max(mx, G.speed - mx * 1.6 * dt);
  const spdPct = G.speed / mx;
  if (!G.boosting) G.nitro = Math.min(100, G.nitro + (spdPct > 0.7 ? 2.5 : 1.2) * dt);

  G.offroad = Math.abs(G.playerX) > 1.05;
  if (G.offroad) {
    G.speed = Math.max(G.speed - dt * 7500, mx * 0.42);
    G.shake = Math.max(G.shake, 3.5);
    G.skidT -= dt;
    if (G.skidT <= 0 && G.speed > mx * 0.3) { G.skidT = 0.15; Snd.noise(0.12, 0.09, 500); }
  }

  G.pos += G.speed * dt;
  while (G.pos >= track.length) G.pos -= track.length;
  G.distM += (G.speed * dt) / UNITS_PER_M;
  G.kmh = (G.speed / UNITS_PER_M) * 3.6;
  G.topKmh = Math.max(G.topKmh, G.kmh);
  if (G.distM >= G.nextMile) {
    FX.pop(G.nextMile / 1000 + ' KM!', 0.3, '#06ffa5', 1.6);
    Snd.mile(); G.nextMile += 1000;
  }

  const seg = findSegment(G.pos);
  G.playerX += G.steerS * dt * 2.1 * (0.45 + 0.55 * spdPct);
  G.playerX -= seg.curve * spdPct * spdPct * dt * 0.30;
  G.playerX = clamp(G.playerX, -1.9, 1.9);

  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) { G.combo = 0; UI.setCombo(0); }
  }

  /* traffic */
  while (G.cars.length < trafficTarget()) spawnCarAhead(SEGLEN * 60, SEGLEN * DRAW_DIST * 2);
  for (const c of G.cars) {
    c.z += c.speed * dt;
    while (c.z >= track.length) c.z -= track.length;
    c.changeT -= dt;
    if (c.changeT <= 0) {
      c.changeT = rnd(2.5, 7);
      if (Math.random() < 0.5) {
        const opts = LANE_X.filter((l) => Math.abs(l - c.tx) > 0.1);
        c.tx = opts[(Math.random() * opts.length) | 0];
      }
    }
    c.x += clamp(c.tx - c.x, -dt * 0.45, dt * 0.45);
    const dz = wrapDz(c.z);

    if (dz > -SEGLEN * 0.5 && dz < SEGLEN * 1.4 && Math.abs(G.playerX - c.x) < c.halfW + 0.28) {
      crash();
      if (G.state === ST.CRASH) return;
      c.z = (G.pos + rnd(SEGLEN * 100, SEGLEN * 200)) % track.length; c.passed = false;
    }

    if (!c.passed && dz < -SEGLEN * 0.5) {
      c.passed = true;
      const d = Math.abs(G.playerX - c.x);
      if (d < 0.98 && Math.abs(G.playerX) < 1.05) {
        G.nearMisses++;
        G.combo = Math.min(G.combo + 1, 8); G.comboT = 4; G.maxCombo = Math.max(G.maxCombo, G.combo);
        const gain = 100 * G.combo; G.nmScore += gain;
        G.nitro = Math.min(100, G.nitro + 14);
        G.hitstopT = 0.12; G.shake = Math.max(G.shake, 4);
        Snd.whoosh(); Snd.tick(G.combo);
        FX.pop('NEAR MISS ×' + G.combo + '  +' + gain, 0.46, '#ffbe0b', 1.1);
        UI.setCombo(G.combo);
      }
    }

    if (dz < -SEGLEN * 22) {
      c.z = (G.pos + rnd(SEGLEN * 80, SEGLEN * DRAW_DIST * 2)) % track.length;
      c.x = c.tx = LANE_X[(Math.random() * 3) | 0];
      c.speed = maxSpeed() * rnd(0.30, 0.48) * (c.truck ? 0.75 : 1);
      c.passed = false; c.color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
    }
  }

  /* coins */
  if (G.coins.length < 14) spawnCoinRow();
  for (const c of G.coins) {
    const dz = wrapDz(c.z);
    if (!c.taken && dz > -SEGLEN * 0.4 && dz < SEGLEN * 1.4 && Math.abs(G.playerX - c.x) < 0.44) {
      c.taken = true; G.coinCount++;
      G.nitro = Math.min(100, G.nitro + 5);
      Snd.coin();
      FX.burstAtTrack(c.z, c.x, 7, '255,215,94');
    }
    if (dz < -SEGLEN * 10) c.taken = true;
  }
  G.coins = G.coins.filter((c) => !c.taken);

  /* pickups */
  G.pickupT -= dt;
  if (G.pickups.length < 1 && G.pickupT <= 0) { spawnPickup(); G.pickupT = rnd(10, 18); }
  for (const p of G.pickups) {
    const dz = wrapDz(p.z);
    if (!p.taken && dz > -SEGLEN * 0.4 && dz < SEGLEN * 1.4 && Math.abs(G.playerX - p.x) < 0.5) {
      p.taken = true;
      if (p.kind === 'nitro') { G.nitro = 100; Snd.nitroGo(); FX.pop('NITRO FULL!', 0.45, '#00f5ff', 1.2); }
      else { G.shield = true; UI.setShield(true); Snd.shield(); FX.pop('SHIELD', 0.45, '#06ffa5', 1.2); }
    }
    if (dz < -SEGLEN * 10) p.taken = true;
  }
  G.pickups = G.pickups.filter((p) => !p.taken);

  UI.updateHud({ dist: G.distM, score: scoreNow(), coins: G.coinCount, kmh: G.kmh, nitro: G.nitro, boosting: G.boosting });
  Snd.setEngine(spdPct);

  FX.updateFx(dt);
}
