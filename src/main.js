// Velocity Run — entry point. Wires input, UI, the game loop and the renderer.

import { QUALITY, QUALITY_ORDER } from './config.js';
import { buildTrack, track } from './track.js';
import { Snd } from './audio.js';
import { $, applyLang, setLang, I18N, LANG } from './i18n.js';
import { initInput } from './input.js';
import * as FX from './fx.js';
import { G, ST, update, newGame, toMenu, pauseGame, resumeGame } from './game.js';
import { Renderer } from './render/renderer.js';
import { World } from './render/world.js';

/* ---------- quality: pick once from the device, drop if the frame rate says so ---------- */
function detectQuality() {
  const saved = localStorage.getItem('vr_quality');
  if (saved && QUALITY[saved]) return saved;
  const touch = 'ontouchstart' in window;
  const small = Math.min(screen.width, screen.height) < 820;
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  if (touch && small) return weak ? 'rendah' : 'sedang';
  return weak ? 'sedang' : 'tinggi';
}
let qualityKey = detectQuality();

/* ---------- boot ---------- */
const gameCanvas = $('game');
const fxCanvas = $('fx');
buildTrack();
const R = new Renderer(gameCanvas, qualityKey);
const world = new World(R.scene, R.camera, QUALITY[qualityKey]);
FX.initFx(fxCanvas);
FX.setProjector((z, x) => world.project(z, x));

addEventListener('resize', () => { R.resize(); FX.resizeFx(); });

function toggleMute() {
  Snd.muted = !Snd.muted;
  localStorage.setItem('vr_muted', Snd.muted ? '1' : '0');
  $('btnMute').textContent = Snd.muted ? '✕' : '♪';
}

initInput({
  canvas: fxCanvas,
  onStart: () => { if (G.state === ST.MENU || G.state === ST.OVER) newGame(); },
  onTogglePause: () => { G.state === ST.PAUSE ? resumeGame() : pauseGame(); },
  onToggleMute: toggleMute,
});

$('btnPlay').onclick = () => { Snd.ensure(); newGame(); };
$('btnRetry').onclick = () => { Snd.ensure(); newGame(); };
$('btnMenu').onclick = toMenu;
$('btnQuit').onclick = () => { $('pauseOv').classList.remove('on'); toMenu(); };
$('btnResume').onclick = resumeGame;
$('btnPause').onclick = () => { G.state === ST.PAUSE ? resumeGame() : pauseGame(); };
$('btnMute').onclick = toggleMute;
if (Snd.muted) $('btnMute').textContent = '✕';
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

$('langId').onclick = () => { setLang('id'); refreshQualityLabel(); };
$('langEn').onclick = () => { setLang('en'); refreshQualityLabel(); };

/* quality switch lives in the pause menu */
function refreshQualityLabel() {
  $('btnQuality').textContent = I18N[LANG].graphics + ': ' + QUALITY[qualityKey].label;
}
function applyQuality(key, remember) {
  qualityKey = key;
  R.setQuality(key);
  if (remember) localStorage.setItem('vr_quality', key);
  refreshQualityLabel();
}
$('btnQuality').onclick = () => {
  const i = QUALITY_ORDER.indexOf(qualityKey);
  applyQuality(QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length], true);
};

/* ---------- loop ---------- */
let last = performance.now();
let slowFrames = 0, autoDropped = localStorage.getItem('vr_quality') !== null;
function loop(now) {
  requestAnimationFrame(loop);
  // rAF timestamps can precede the performance.now() taken at boot, so clamp
  // both ends: never negative, never a giant catch-up step after a tab switch.
  let dt = (now - last) / 1000;
  const rawDt = dt;
  last = now;
  if (dt < 0) dt = 0;
  if (dt > 0.05) dt = 0.05;
  if (G.state !== ST.PAUSE) update(dt);
  if (G.state === ST.MENU) {
    // attract mode: drift down the road behind the menu
    G.t += dt;
    G.pos = (G.pos + dt * 2400) % track.length;
  }
  world.update(G.state === ST.PAUSE ? 0 : dt, G.t);
  R.render();
  FX.drawFx({ t: G.t, boosting: G.boosting && G.state === ST.PLAY, countdown: G.state === ST.COUNT ? G.countT : 0 });

  // Auto-downgrade: a sustained stretch under ~38 fps while actually racing
  // steps the quality down once (never up — flapping looks worse than low).
  if (!autoDropped && G.state === ST.PLAY) {
    if (rawDt > 0.026) slowFrames++; else slowFrames = Math.max(0, slowFrames - 2);
    if (slowFrames > 150) {
      const i = QUALITY_ORDER.indexOf(qualityKey);
      if (i < QUALITY_ORDER.length - 1) applyQuality(QUALITY_ORDER[i + 1], false);
      autoDropped = true;
    }
  }
}

applyLang();
refreshQualityLabel();
toMenu();
requestAnimationFrame(loop);

// exposed for the e2e scripts
window.__vr = { G, ST, newGame, world, renderer: R, track };
