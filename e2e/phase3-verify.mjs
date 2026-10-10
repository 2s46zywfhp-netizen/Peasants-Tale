// Uses the container's global Playwright (not a project dependency).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const dir = process.env.SHOTS ?? '/tmp/peasant-shots/';
import { mkdirSync } from 'node:fs';
mkdirSync(dir, { recursive: true });
const BLOCK = 86400000 / 42;
const T0 = Date.UTC(2026, 9, 10, 8, 0, 0);
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.clock.setFixedTime(T0 + 2 * BLOCK + 1000);
await page.goto(URL);
await page.waitForTimeout(1200);
const box = await page.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const shot = (n) => page.screenshot({ path: dir + n + '.png', clip: box });
const data = (k) => page.evaluate((k) => document.body.dataset[k] ?? '', k);
/** Hold a key until data[key] equals want (or timeout). */
async function holdUntil(key, probeKey, want, maxMs = 8000) {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs && (await data(probeKey)) !== want) await page.waitForTimeout(40);
  await page.keyboard.up(key);
  await page.waitForTimeout(450); // let the fade finish
  return (await data(probeKey)) === want;
}
async function hold(key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(60); }
async function pixels() {
  const buf = await page.screenshot({ clip: box });
  return buf;
}

// ── Criterion 3: walk every scene in the real app ──
await page.keyboard.press('Enter'); await page.waitForTimeout(900);
// Phase 4: a fresh save is named first (keep the suggested names), then the intro is skipped.
if ((await data('scene')) === 'naming') {
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(900);
}
const visited = [await data('scene')];
const go = async (key, want, ms) => { const ok = await holdUntil(key, 'scene', want, ms); if (ok) { visited.push(want); await shot(`walk-${visited.length}-${want}`); } return ok; };
check('start in cottage', visited[0] === 'cottage', visited[0]);
check('cottage -> green (door)', await go('ArrowRight', 'green'));
check('green -> fields (west)', await go('ArrowLeft', 'fields'));
check('fields -> woods (west)', await go('ArrowLeft', 'woods', 9000));
check('woods -> fields (east)', await go('ArrowRight', 'fields', 9000));
check('fields -> green (east)', await go('ArrowRight', 'green', 9000));
check('green -> churchyard (east)', await go('ArrowRight', 'churchyard', 9000));
await hold('ArrowRight', 1550); // to the church door (col 4)
check('churchyard -> church (door)', await go('ArrowUp', 'church'));
check('church -> churchyard (door)', await go('ArrowDown', 'churchyard'));
check('churchyard -> manor (east)', await go('ArrowRight', 'manor', 9000));
check('manor -> churchyard (west)', await go('ArrowLeft', 'churchyard', 9000));
check('churchyard -> green (west)', await go('ArrowLeft', 'green', 9000));
// Back to the cottage door (col 1) on the wide green: out west to the fields and straight back in,
// which puts you at the green's west edge, a step from the door.
await holdUntil('ArrowLeft', 'scene', 'fields', 12000);
await holdUntil('ArrowRight', 'scene', 'green', 3000);
await hold('ArrowRight', 380);
check('green -> cottage (door)', await go('ArrowUp', 'cottage'));
check('all 7 village scenes visited', new Set(visited).size === 7, [...new Set(visited)].join(','));

// ── Criterion 4: day/night, seasons, weather, moon visibly change ──
await holdUntil('ArrowRight', 'scene', 'green');
const midday = await pixels(); await shot('c4-green-midday');
await page.clock.setFixedTime(T0 + 5 * BLOCK + 1000); await page.waitForTimeout(800);
const night = await pixels(); await shot('c4-green-night');
check('day -> night changes the picture', Buffer.compare(midday, night) !== 0);
const moon0 = await data('moon');
// Debug panel: hold SELECT + START (START opens the status page first, debug goes on top).
async function debug(stepsDown) {
  await page.keyboard.down('Backspace'); await page.keyboard.down('Enter'); await page.waitForTimeout(2300);
  await page.keyboard.up('Enter'); await page.keyboard.up('Backspace'); await page.waitForTimeout(300);
  for (let i = 0; i < stepsDown; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('KeyX'); await page.waitForTimeout(500);
}
async function closeToWorld() {
  for (let i = 0; i < 4 && (await page.evaluate(() => 1)); i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(350); }
}
// FF 1 week -> Parchment Log (criterion 5)
const dayBefore = Number(await data('day'));
await debug(1);
const parchment = await data('parchment');
await shot('c5-parchment-week');
check('FF 1 week opens the Parchment Log summarising 7 days', parchment.startsWith('7 days have passed.'), parchment.slice(0, 140));
check('Parchment Log lists activities and meals', /meals were eaten/.test(parchment) && /worked the strips|laboured for the lord|slept/.test(parchment));
await page.keyboard.press('KeyX'); await page.waitForTimeout(650); // close parchment -> debug
await page.keyboard.press('KeyZ'); await page.waitForTimeout(650); // close debug -> status
await page.keyboard.press('KeyZ'); await page.waitForTimeout(800); // close status -> world
const dayAfter = Number(await data('day'));
check('a week passed in the world', dayAfter - dayBefore === 7, `${dayBefore} -> ${dayAfter}`);
const nightWeek = await pixels(); await shot('c4-green-night-week-later');
const moon1 = await data('moon');
check('moon phase changes over a week', moon0 !== moon1, `${moon0} -> ${moon1}`);
// Season: FF one season
const season0 = await data('season');
await debug(2); await page.keyboard.press('KeyX'); await page.waitForTimeout(650); await page.keyboard.press('KeyZ'); await page.waitForTimeout(650); await page.keyboard.press('KeyZ'); await page.waitForTimeout(800);
const season1 = await data('season');
await page.clock.setFixedTime(T0 + 2 * BLOCK + 1000); // fixed clock; the sim block is wherever FF left it
await shot('c4-green-next-season');
check('a season later the season changes', season0 !== season1, `${season0} -> ${season1}`);
// Weather: fast-forward day by day until we have seen rain and a dry day, on screen.
const seen = {};
for (let i = 0; i < 30 && !(seen.rain && seen.dry); i++) {
  const w = await data('weather');
  const key = w === 'rain' || w === 'storm' || w === 'snow' ? 'rain' : 'dry';
  if (!seen[key]) { seen[key] = w; await shot(`c4-weather-${key}-${w}`); }
  await debug(0); await page.keyboard.press('KeyX'); await page.waitForTimeout(650); await page.keyboard.press('KeyZ'); await page.waitForTimeout(650); await page.keyboard.press('KeyZ'); await page.waitForTimeout(800);
}
check('weather varies day to day (wet and dry seen on screen)', !!(seen.rain && seen.dry), JSON.stringify(seen));

// ── Criterion 2: Sprite Gallery with cycling palettes ──
await ctx.clearCookies();
await page.clock.resume?.().catch(() => {});
await debug(7);
const g0 = await data('gallery');
const p0 = await pixels(); await shot('c2-gallery-a');
await page.waitForTimeout(2000);
const g1 = await data('gallery');
const p1 = await pixels(); await shot('c2-gallery-b');
check('gallery shows every sprite and animation', /\d+\/\d+ \w+ (\d+)/.test(g0) && Number(g0.split(' ').pop()) > 100, g0);
check('gallery cycles palettes', g0.split(' ')[1] !== g1.split(' ')[1] && Buffer.compare(p0, p1) !== 0, `${g0} -> ${g1}`);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
check('gallery pages', (await data('gallery')).startsWith('2/'), await data('gallery'));

console.log(results.join('\n'));
console.log('errors', errors);
await browser.close();
