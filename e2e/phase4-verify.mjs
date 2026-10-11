// Phase 4 browser checks. Uses the container's global Playwright (not a project dependency).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const URL = process.argv[2] ?? 'http://localhost:4173/';
const dir = process.env.SHOTS ?? '/tmp/peasant-shots/p4/';
mkdirSync(dir, { recursive: true });
const BLOCK = 86400000 / 42;
const T0 = Date.UTC(2026, 9, 10, 8, 0, 0);
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : info}`.trim());
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
const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
async function holdUntil(key, probeKey, want, maxMs = 9000) {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs && (await data(probeKey)) !== want) await page.waitForTimeout(40);
  await page.keyboard.up(key);
  await page.waitForTimeout(450);
  return (await data(probeKey)) === want;
}
async function debug(stepsDown, eventSteps = null) {
  await page.keyboard.down('Backspace'); await page.keyboard.down('Enter'); await page.waitForTimeout(2300);
  await page.keyboard.up('Enter'); await page.keyboard.up('Backspace'); await page.waitForTimeout(300);
  for (let i = 0; i < stepsDown; i++) await page.keyboard.press('ArrowDown');
  await press('KeyX', 500);
  if (eventSteps !== null) {
    for (let i = 0; i < eventSteps; i++) await page.keyboard.press('ArrowDown');
    await press('KeyX', 400);
  }
}
async function statusPage(name) {
  await press('Enter', 500);
  for (let i = 0; i < 10 && !(await data('page')).startsWith(name); i++) await press('ArrowRight', 200);
  const p = await data('page');
  await shot(`status-${name.toLowerCase()}`);
  await press('KeyZ', 600);
  return p;
}

// ── Onboarding ──
await press('Enter', 700);
check('START on a fresh save opens the name grid', (await data('scene')) === 'naming', await data('scene'));
await shot('naming');
for (let i = 0; i < 8; i++) await press('KeyZ', 60); // rub out the suggestion
for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight']) await press(k, 60); // D
await press('KeyX', 80);
await press('ArrowRight', 60); await press('KeyX', 80); // E
await press('Enter', 400); // family name: keep the suggestion
await shot('naming-family');
await press('Enter', 600);
check('then the intro by candlelight', (await data('scene')) === 'intro', await data('scene'));
await page.waitForTimeout(1500); await shot('intro-1');
await press('KeyZ', 900);
check('then the first morning in the cottage', (await data('scene')) === 'cottage', await data('scene'));
check('with the first tutorial hint', (await data('hint')) === '0', await data('hint'));
await shot('tutorial-hint');

// ── The action menu at the hearth ──
// The cottage is seen from the side: walk left to the fireplace.
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(3000); await page.keyboard.up('ArrowLeft');
// The wife wanders the room: if she is beside you, A talks to her instead. Close the talk and try again.
for (let i = 0; i < 6; i++) {
  const before = await data('menu');
  await press('KeyX', 400);
  if ((await data('menu')) !== before && /EAT|COOK|SLEEP/.test(await data('menu'))) break;
  for (let k = 0; k < 4; k++) await press('KeyX', 250);
  await press('KeyZ', 1500);
}
const menu = await data('menu');
check('A at the hearth opens home actions', /EAT|COOK|SLEEP/.test(menu), menu);
check('the hint moves on', (await data('hint')) === '1', await data('hint'));
await shot('menu-home');
await press('KeyX', 500); // the first action of the life, at the hearth (cook)
check('acting moves the hint on again', (await data('hint')) === '2', await data('hint'));
// The task plays out with a bar, its time passes, and the result is shown; A closes it.
if ((await data('working')) === 'busy') {
  await page.waitForTimeout(2800);
  check('a chosen task finishes in a moment, then tells what came of it', (await data('working')) === 'done', await data('working'));
  await press('KeyX', 400);
}

// ── Status pages ──
const fam = await statusPage('FAMILY');
check('FAMILY page: spouse and child, in words', /Your wife .*grown/.test(fam) && /Your son .*child/.test(fam), fam.slice(0, 200));
const self = await statusPage('YOURSELF');
check('YOURSELF page: the chosen name and rank', /^YOURSELF: DE /.test(self) && /villein/.test(self), self.slice(0, 120));
const vil = await statusPage('VILLAGE');
check('VILLAGE page: every villager and how they feel', /FATHER WALTER/.test(vil) && /ALICE BREWSTER/.test(vil) && /NICHOLAS/.test(vil), vil.slice(0, 200));
const chr = await statusPage('CHRONICLE');
check('CHRONICLE page: the family line', /FAMILY OF ASHBY/.test(chr) && /I\. DE /.test(chr), chr.slice(0, 160));
check('the START hint passed', (await data('hint')) === '3', await data('hint'));
await press('KeyZ', 300);
check('B passes the last hint', (await data('hint')) === 'done', await data('hint'));

// ── Villagers in the world, talk tied to opinion ──
check('out of the cottage to the green (walk right, through the door)', await holdUntil('ArrowRight', 'scene', 'green'));
await shot('green-villagers');

// ── Death and the heir (debug: HEADDIES is event 12) ──
await debug(6, 12);
await press('KeyZ', 400); await press('KeyZ', 400); await press('KeyZ', 600);
const chr2 = await statusPage('CHRONICLE');
check('death of the head: heir takes over and the Chronicle records it', /II\. /.test(chr2) && /Died struck down/.test(chr2), chr2.slice(0, 260));
const self2 = await statusPage('YOURSELF');
check('the heir is now YOURSELF', !/^YOURSELF: DE /.test(self2), self2.slice(0, 80));

// ── Flight to the town: walk to the woods and choose FLEE ──
await holdUntil('ArrowLeft', 'scene', 'fields');
await holdUntil('ArrowLeft', 'scene', 'woods');
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600); await page.keyboard.up('ArrowLeft');
await press('KeyX', 400);
const wm = await data('menu');
check('the woods offer flight', /FLEE TO TOWN/.test(wm), wm);
const fleeAt = wm.split('|').findIndex((l) => l.startsWith('FLEE TO TOWN'));
for (let i = 0; i < fleeAt; i++) await press('ArrowDown', 60);
await press('KeyX', 500);
// The flight plays out for a moment, then its time passes; closing the result shows where it led.
await page.waitForTimeout(2800);
if ((await data('working')) === 'done') await press('KeyX', 300);
await page.waitForTimeout(1500);
check('fleeing takes the family to the town', (await data('scene')) === 'town', await data('scene'));
await shot('town');
await press('KeyX', 400);
const tm = await data('menu');
check('the town has its own actions', /WORK FOR HIRE/.test(tm) && !/WORK STRIPS/.test(tm), tm);
await press('KeyZ', 300);
const self3 = await statusPage('YOURSELF');
check('the family is FUGITIVE in the town', /runaway serf/.test(self3), self3.slice(0, 120));

// ── The Black Death: FF three years to 1348, then a year ──
await debug(3); await press('KeyX', 600); await press('KeyZ', 400); await press('KeyZ', 400);
await debug(3); await press('KeyX', 600); await press('KeyZ', 400); await press('KeyZ', 400);
await debug(3);
const p1347 = await data('parchment');
await press('KeyX', 600); await press('KeyZ', 400); await press('KeyZ', 400);
await debug(3);
const p1348 = await data('parchment');
await shot('plague-parchment');
await press('KeyX', 600); await press('KeyZ', 400); await press('KeyZ', 400);
await shot('plague-world');
check('1348: omens and the pestilence in the Parchment Log', /pestilence|swellings|Melcombe|sickness come from over the sea/i.test(p1347 + p1348), (p1347 + p1348).slice(0, 300));
await debug(3);
const p1349 = await data('parchment');
await press('KeyX', 600); await press('KeyZ', 400); await press('KeyZ', 400);
check('1349-50: aftermath and resolution', /Ordinance of Labourers|has passed|vacant/i.test(p1348 + p1349), p1349.slice(0, 300));

console.log(results.join('\n'));
console.log('errors', errors);
await browser.close();
