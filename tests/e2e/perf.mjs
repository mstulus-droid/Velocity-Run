// Draw-call / triangle budget check for one racing frame.
// Usage: node tests/e2e/perf.mjs   (server on BASE_URL)

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8950';
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__vr);
await page.click('#btnPlay');
await page.evaluate(() => { window.__vr.G.countT = 0.01; });
await page.waitForTimeout(3000);
const info = await page.evaluate(async () => {
  const r = window.__vr.renderer.renderer;
  r.info.autoReset = false; r.info.reset();
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  const out = { quality: window.__vr.renderer.qualityKey, calls: r.info.render.calls, triangles: r.info.render.triangles, points: r.info.render.points, programs: r.info.programs.length };
  r.info.autoReset = true;
  return out;
});
console.log(JSON.stringify(info));
await browser.close();
