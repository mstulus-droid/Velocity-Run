// Screen-space juice drawn on a 2D canvas above the WebGL one: sparks, floating
// score pops, the countdown, and the boost speed lines. Keeping these in 2D is
// deliberate — they are UI-flavoured effects that should stay crisp and sit on
// top of the bloom, and the code carried straight over from the 2D build.

import { rnd } from './config.js';

let cv, ctx, W = 800, H = 600;
let parts = [];
let pops = [];
let project = null;   // set by main.js: (trackZ, laneX) -> {x, y} in 0..1 screen space

export function initFx(canvas) {
  cv = canvas;
  ctx = cv.getContext('2d');
  resizeFx();
}

export function resizeFx() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  W = cv.width; H = cv.height;
}

export function setProjector(fn) { project = fn; }

export function spark(sx, sy, opts = {}) {
  parts.push({
    sx, sy,
    vx: opts.vx ?? rnd(-0.2, 0.2), vy: opts.vy ?? rnd(-0.4, -0.05),
    life: opts.life ?? 0.5, maxlife: opts.life ?? 0.5,
    r: opts.r ?? rnd(2, 5), c: opts.c ?? '255,255,255', grav: opts.grav ?? 1,
  });
}

/** Burst of sparks at a position on the track (game coords), if it is on screen. */
export function burstAtTrack(z, laneX, n, color) {
  if (!project) return;
  const p = project(z, laneX);
  if (!p) return;
  for (let i = 0; i < n; i++) {
    spark(p.x, p.y, { vx: rnd(-0.15, 0.15), vy: rnd(-0.35, -0.05), life: rnd(0.3, 0.6), r: rnd(2, 4), c: color, grav: 0.8 });
  }
}

export function pop(txt, sy, color, size = 1) {
  pops.push({ sx: 0.5, sy, txt, life: size > 1.4 ? 1.2 : 0.9, c: color, size });
}

export function clearFx() { parts = []; pops = []; }

export function updateFx(dt) {
  for (const p of parts) { p.life -= dt; p.sx += p.vx * dt; p.sy += p.vy * dt; p.vy += (p.grav || 0) * dt; }
  parts = parts.filter((p) => p.life > 0);
  for (const p of pops) { p.life -= dt; p.sy -= 0.08 * dt; }
  pops = pops.filter((p) => p.life > 0);
}

export function drawFx({ t, boosting, countdown }) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (boosting) {
    ctx.strokeStyle = 'rgba(0,245,255,.28)';
    ctx.lineWidth = Math.max(1.5, W / 600);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 4;
      const r1 = Math.min(W, H) * 0.34, r2 = Math.min(W, H) * (0.6 + ((i * 37) % 20) / 100);
      ctx.moveTo(W / 2 + Math.cos(a) * r1, H * 0.5 + Math.sin(a) * r1);
      ctx.lineTo(W / 2 + Math.cos(a) * r2, H * 0.5 + Math.sin(a) * r2);
    }
    ctx.stroke();
  }

  for (const p of parts) {
    ctx.globalAlpha = Math.max(p.life / p.maxlife, 0);
    ctx.fillStyle = `rgb(${p.c})`;
    ctx.beginPath(); ctx.arc(p.sx * W, p.sy * H, p.r * (W / 800), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const p of pops) {
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.font = `700 ${Math.round(H * 0.028 * (p.size || 1))}px "JetBrains Mono",monospace`;
    ctx.fillStyle = p.c;
    ctx.shadowColor = p.c; ctx.shadowBlur = 18;
    ctx.fillText(p.txt, p.sx * W, p.sy * H);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  if (countdown > 0) {
    const n = Math.ceil(countdown);
    if (n > 0 && n <= 3) {
      const frac = countdown - (n - 1);
      const sc = 1 + (1 - frac) * 0.35;
      ctx.save();
      ctx.globalAlpha = Math.min(1, frac * 2 + 0.3);
      ctx.translate(W / 2, H * 0.4); ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.round(H * 0.16)}px Outfit,sans-serif`;
      ctx.fillStyle = n === 1 ? '#06ffa5' : '#ffbe0b';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 30;
      ctx.fillText(n, 0, 0);
      ctx.restore();
    }
  }
}
