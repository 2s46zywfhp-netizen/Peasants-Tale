// Phase 5 visual QA: every scene, the shell, the menus and the gallery at five phone viewports.
// Usage: node e2e/screenshots.mjs [url] [outDir]  (serve a production build first: npx vite preview)
// Uses the container's global Playwright when the project's own is not installed.
import { mkdirSync, writeFileSync } from 'node:fs';
let pw;
try {
  pw = await import('playwright');
} catch {
  pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
}
const { chromium } = pw;
const URL = (process.argv[2] ?? 'http://localhost:4173/') + '?qa';
const OUT = process.argv[3] ?? 'docs/screenshots/';
const VIEWPORTS = [
  { name: '375x667@2', width: 375, height: 667, dpr: 2 },
  { name: '390x844@3', width: 390, height: 844, dpr: 3 },
  { name: '393x852@3', width: 393, height: 852, dpr: 3 },
  { name: '430x932@3', width: 430, height: 932, dpr: 3 },
  { name: '412x915@2.625', width: 412, height: 915, dpr: 2.625 },
];
const BLOCK = 86400000 / 42;
const T0 = Date.UTC(2026, 9, 10, 8, 0, 0);
const only = process.env.ONLY;

/** What to shoot in each viewport: [name, steps in the page]. */
const SHOTS = [
  ['title', async () => {}],
  ['cottage-day', (q) => q.world('cottage', 200, 0)],
  ['cottage-hearth', (q) => q.world('cottage', 60, 0, 'left')],
  ['green', (q) => q.world('green', 140, 80)],
  ['green-home-door', (q) => q.world('green', 25, 60, 'up')],
  ['fields', (q) => q.world('fields', 250, 72)],
  ['woods', (q) => q.world('woods', 220, 100, 'up')],
  ['churchyard', (q) => q.world('churchyard', 101, 70, 'up')],
  ['church', (q) => q.world('church', 280, 0)],
  ['manor', (q) => q.world('manor', 228, 72, 'up')],
  ['town', (q) => { q.patch((s) => { s.station.residence = 'town'; }); q.world('town', 256, 90); }],
  ['camp', (q) => { q.patch((s) => { s.station.residence = 'camp'; }); q.world('camp', 240, 104, 'up'); }],
  ['camp-night', (q) => { q.at(5); q.world('camp', 240, 104, 'up'); }],
  ['menu-action', (q) => { q.patch((s) => { s.station.residence = 'village'; }); q.world('cottage', 60, 0); q.push('menu'); }],
  ['menu-status', (q) => q.push('status')],
  ['menu-settings', (q) => q.push('settings')],
  ['menu-queue', (q) => { q.world('green', 140, 80); q.push('queue'); }],
  ['menu-dialogue', (q) => { q.world('green', 140, 80); q.push('talk'); }],
  ['menu-working', (q) => { q.world('fields', 250, 40); q.push('working'); }],
  ['menu-log', (q) => q.push('log')],
  ['gallery', (q) => q.push('gallery')],
  ['midday-green', (q) => { q.at(2); q.world('green', 140, 80); }],
  ['midday-fields', (q) => q.world('fields', 250, 72)],
  ['midday-woods', (q) => q.world('woods', 220, 100, 'up')],
  ['midday-churchyard', (q) => q.world('churchyard', 101, 70, 'up')],
  ['midday-manor', (q) => q.world('manor', 228, 72, 'up')],
  ['midday-cottage', (q) => q.world('cottage', 200, 0)],
  ['dusk-green', (q) => { q.at(4); q.world('green', 60, 66); }],
  ['night-green', (q) => { q.at(5); q.world('green', 60, 66); }],
  ['night-cottage', (q) => q.world('cottage', 120, 0)],
  ['night-woods', (q) => q.world('woods', 200, 120)],
  ['winter-green', (q) => { q.ff(6 * 285); q.at(2); q.world('green', 200, 90); }],
  ['winter-fields', (q) => q.world('fields', 250, 72)],
];

const browser = await chromium.launch();
const log = [];
for (const vp of VIEWPORTS) {
  const dir = `${OUT}${vp.name}/`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(T0 + 2 * BLOCK + 1000);
  await page.goto(URL);
  await page.waitForTimeout(1200);
  // Shell, at the device's own resolution.
  await page.screenshot({ path: `${dir}shell.png` });
  {
    const url = await page.evaluate(() => window.qa.frame());
    writeFileSync(`${dir}title.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  // A life, named and begun.
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(800);
  await page.evaluate(() => window.qa.tutorialDone());
  for (const [name, step] of SHOTS) {
    if (only && !name.includes(only)) continue;
    if (name === 'title') continue;
    await page.evaluate(`(${step.toString()})(window.qa)`);
    await page.waitForTimeout(name.startsWith('menu-working') ? 900 : 450);
    const url = await page.evaluate(() => window.qa.frame());
    writeFileSync(`${dir}${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await page.screenshot({ path: `${dir}shell-world.png` });
  const scale = await page.evaluate(() => document.body.dataset.scale);
  const box = await page.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.width, r.height, r.left, r.top]; });
  writeFileSync(`${dir}canvas.json`, JSON.stringify({ dpr: vp.dpr, scale: Number(scale), left: box[2], top: box[3], width: box[0], height: box[1] }));
  log.push(`${vp.name}: scale ${scale} (${box[0].toFixed(1)}x${box[1].toFixed(1)} CSS px)${errors.length ? ` ERRORS ${errors.join(' | ')}` : ''}`);
  await ctx.close();
}
await browser.close();
console.log(log.join('\n'));
