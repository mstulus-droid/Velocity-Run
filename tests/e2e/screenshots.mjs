// Beauty shots for visual review: menu, countdown, cruising, a corner, a boost.
// Usage: node tests/e2e/screenshots.mjs   (a server must be running on BASE_URL)

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
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (err) => { errors.push(String(err)); console.error('PAGE ERROR:', String(err)); });
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__vr, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(SHOTS, '01-menu.png') });

await page.click('#btnPlay');
await page.waitForTimeout(700);
await page.screenshot({ path: join(SHOTS, '02-countdown.png') });

// skip the countdown and let it cruise
await page.evaluate(() => { window.__vr.G.countT = 0.01; });
await page.waitForTimeout(3500);
await page.screenshot({ path: join(SHOTS, '03-cruise.png') });

// hold nitro
await page.keyboard.down('Shift');
await page.waitForTimeout(1400);
await page.screenshot({ path: join(SHOTS, '04-boost.png') });
await page.keyboard.up('Shift');

// steer hard left for a bit
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(900);
await page.screenshot({ path: join(SHOTS, '05-steer.png') });
await page.keyboard.up('ArrowLeft');

// pause menu
await page.keyboard.press('p');
await page.waitForTimeout(400);
await page.screenshot({ path: join(SHOTS, '06-pause.png') });

const s = await page.evaluate(() => ({ state: window.__vr.G.state, dist: window.__vr.G.distM, cars: window.__vr.G.cars.length }));
console.log('state', s, 'errors', errors.length);
await browser.close();
if (errors.length) process.exit(1);
