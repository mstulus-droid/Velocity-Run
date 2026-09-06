// Smoke playthrough: boot, race for a while with random steering, force a
// crash, check the game-over card, retry, pause/resume, and a portrait
// (phone) framing shot. Fails on any page error.
// Usage: node tests/e2e/playthrough.mjs   (server on BASE_URL)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8950';
const SHOTS = join(fileURLToPath(import.meta.url), '..', 'shots');
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const fail = (msg) => { console.error('FAIL:', msg); errors.push(msg); };

/* ---------- desktop run ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => fail('page error: ' + e));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__vr, null, { timeout: 20000 });

  await page.click('#btnPlay');
  await page.evaluate(() => { window.__vr.G.countT = 0.01; });
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => window.__vr.G.state);
  if (st !== 2) fail('expected PLAY state, got ' + st);

  // race ~6 s with nitro and some steering
  await page.keyboard.down('Shift');
  for (let i = 0; i < 6; i++) {
    const key = i % 2 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key); await page.waitForTimeout(500); await page.keyboard.up(key);
    await page.waitForTimeout(500);
  }
  await page.keyboard.up('Shift');
  const mid = await page.evaluate(() => ({ s: window.__vr.G.state, d: window.__vr.G.distM, kmh: window.__vr.G.kmh, cars: window.__vr.G.cars.length }));
  console.log('mid-run', mid);
  if (mid.d < 50) fail('barely moved: ' + mid.d);

  // force a crash by parking a car right on the player's nose (both stopped,
  // so a slow headless frame can't step straight through the crash window)
  await page.evaluate(() => {
    const { G } = window.__vr;
    if (G.state !== 2) return;
    G.shield = false; G.speed = 0;
    const c = G.cars[0];
    c.z = G.pos + 60; c.x = c.tx = G.playerX; c.speed = 0;
  });
  await page.waitForTimeout(400);
  const crashState = await page.evaluate(() => window.__vr.G.state);
  if (crashState !== 3 && crashState !== 4) fail('expected CRASH/OVER after collision, got ' + crashState);
  await page.screenshot({ path: join(SHOTS, '07-crash.png') });
  // the 1.5 s crash timer runs on clamped game time, which is slower than
  // wall time on a software-rendered headless browser — poll instead of sleeping
  await page.waitForFunction(() => window.__vr.G.state === 4, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const over = await page.evaluate(() => ({
    s: window.__vr.G.state,
    on: document.getElementById('overOv').classList.contains('on'),
    score: document.getElementById('finalScore').textContent,
    dist: document.getElementById('finalDist').textContent,
  }));
  console.log('game over', over);
  if (over.s !== 4 || !over.on) fail('game over overlay not shown');
  await page.screenshot({ path: join(SHOTS, '08-gameover.png') });

  // retry, then pause/resume
  await page.click('#btnRetry');
  await page.waitForTimeout(200);
  if ((await page.evaluate(() => window.__vr.G.state)) !== 1) fail('retry did not start countdown');
  await page.keyboard.press('p');
  await page.waitForTimeout(100);
  if ((await page.evaluate(() => window.__vr.G.state)) !== 5) fail('pause did not engage');
  await page.click('#btnResume');
  await page.waitForTimeout(100);
  if ((await page.evaluate(() => window.__vr.G.state)) !== 1) fail('resume did not return to countdown');

  // quality cycle from the pause menu must not throw
  await page.keyboard.press('p');
  await page.click('#btnQuality'); await page.waitForTimeout(150);
  await page.click('#btnQuality'); await page.waitForTimeout(150);
  await page.click('#btnQuality'); await page.waitForTimeout(150);
  console.log('quality label', await page.evaluate(() => document.getElementById('btnQuality').textContent));
  await page.evaluate(() => localStorage.removeItem('vr_quality'));
  await page.close();
}

/* ---------- portrait phone ---------- */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => fail('mobile page error: ' + e));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__vr, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, '09-mobile-menu.png') });
  await page.tap('#btnPlay');
  await page.evaluate(() => { window.__vr.G.countT = 0.01; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SHOTS, '10-mobile-play.png') });
  const m = await page.evaluate(() => ({ s: window.__vr.G.state, d: window.__vr.G.distM, q: window.__vr.renderer.qualityKey }));
  console.log('mobile', m);
  if (m.s !== 2) fail('mobile not in PLAY state');
  await page.close();
}

await browser.close();
if (errors.length) { console.error(errors.length + ' failure(s)'); process.exit(1); }
console.log('playthrough OK');
