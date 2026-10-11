// Phase 5 browser checks against a production build (npx vite preview). Usage: node e2e/verify.mjs [url]
import { mkdirSync } from 'node:fs';
let pw;
try {
  pw = await import('playwright');
} catch {
  pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
}
const { chromium, devices } = pw;
const URL = process.argv[2] ?? 'http://localhost:4173/';
const BLOCK = 86400000 / 42;
const T0 = Date.UTC(2026, 9, 10, 8, 0, 0);
const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${info}`}`);
mkdirSync('/tmp/peasant-verify', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.clock.install({ time: T0 + 2 * BLOCK + 1000 });
await page.goto(`${URL}?qa`);
await page.waitForTimeout(1200);
const data = (k) => page.evaluate((k) => document.body.dataset[k] ?? '', k);
const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(300); };
const qa = (fn, arg) => page.evaluate(fn, arg);

// ── Scaling: whole device pixels per game pixel, smoothing off ──
const scale = Number(await data('scale'));
const css = await page.evaluate(() => { const c = document.getElementById('screen'); return { w: c.width, h: c.height, cw: c.getBoundingClientRect().width }; });
check('integer physical-pixel scale', scale >= 1 && css.w === 256 * scale && css.h === 224 * scale && Math.abs(css.cw * 3 - css.w) < 1, JSON.stringify({ scale, css }));
const touch = await page.evaluate(() => [...document.querySelectorAll('[data-btn], #dpad .arm')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.btn ?? e.dataset.dir, Math.round(r.width), Math.round(r.height)]; }));
const small = touch.filter(([, w, h]) => w < 48 || (h < 48 && !['start', 'select'].includes(touch[0])));
check('touch targets at least 48 CSS px (pills: 48px via their hit area)', touch.filter(([n, w, h]) => w < 48 || (h < 48 && n !== 'start' && n !== 'select')).length === 0, JSON.stringify(small));
check('L and R buttons exist', touch.some(([n]) => n === 'l') && touch.some(([n]) => n === 'r'));
const ta = await page.evaluate(() => getComputedStyle(document.body).touchAction);
check('touch-action none on the page', ta === 'none', ta);

// ── A new life ──
await press('Enter', 700);
check('START on a fresh save opens the name grid', (await data('scene')) === 'naming', await data('scene'));
await press('Enter', 300);
await press('Enter', 500);
check('the intro follows', (await data('scene')) === 'intro', await data('scene'));
await press('KeyZ', 900);
check('the first morning: the cottage', (await data('scene')) === 'cottage', await data('scene'));
check('the first hint shows', (await data('hint')) === '0', await data('hint'));

// ── Walk out of the cottage and back in by our door ──
await hold('ArrowRight', 4000);
await page.waitForTimeout(700);
check('walking out of the door leads to the green', (await data('scene')) === 'green', await data('scene'));
await qa(() => window.qa.world('green', 17 + 8, 64, 'up'));
await page.waitForTimeout(700);
check('UP: HOME prompt at our door', (await data('prompt')) === 'UP: HOME', await data('prompt'));
await hold('ArrowUp', 600);
await page.waitForTimeout(700);
check('walking up into our door goes home', (await data('scene')) === 'cottage', await data('scene'));

// ── Acceleration: a tap moves a little, a hold runs on ──
await qa(() => window.qa.world('green', 200, 100, 'right'));
await page.waitForTimeout(300);
const px = async () => (await qa(() => window.qa.player())).x;
const x0 = await px();
await hold('ArrowRight', 120);
const x1 = await px();
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
const x2 = await px();
check('a tap moves a few pixels; a hold accelerates', x1 - x0 > 0 && x1 - x0 < 12 && (x2 - x1) / 1.5 > 55, `${x0} ${x1} ${x2}`);

// ── A prompt for every usable object, every room spot ──
const missing = await page.evaluate(async () => {
  const out = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const sc of Object.values(window.qa.scenes)) {
    if (sc.id === 'town' || sc.id === 'camp') continue;
    for (const o of sc.objs) {
      if (!o.hot) continue;
      const f = o.foot ?? [0, 16, 12];
      window.qa.world(sc.id, o.x + ((f[0] + f[1]) >> 1), o.y + 5, 'up');
      await wait(560);
      if (!document.body.dataset.prompt) out.push(`${sc.id}:${o.s}@${o.x}`);
    }
  }
  return out;
});
check('every usable object shows its prompt', missing.length === 0, missing.join(' '));
for (const [id, xs] of [['cottage', [40, 180, 300]], ['church', [120, 320]]]) {
  for (const x of xs) {
    await qa(([id, x]) => window.qa.world(id, x, 0), [id, x]);
    await page.waitForTimeout(600);
    check(`${id} spot at ${x} prompts`, (await data('prompt')).startsWith('A: '), await data('prompt'));
  }
}

// ── A task at the hearth: menu, working, hastened ──
// Something in hand (resting), so what is queued waits its turn.
await qa(() => { window.qa.tutorialDone(); window.qa.game.setBelt('ladle'); window.qa.game.act('rest'); window.qa.world('cottage', 40, 0, 'left'); });
await page.waitForTimeout(600);
await press('KeyX', 500);
const menu = await data('menu');
check('A at the hearth opens its menu', menu.includes('COOK') && !menu.includes('WORK STRIPS'), menu);
await press('KeyE', 400);
check('R in the menu queues the task', (await qa(() => window.qa.game.save.data.queue.length)) === 1, String(await qa(() => window.qa.game.save.data.queue.length)));
await qa(() => window.qa.game.setQueue([]));
await qa(() => window.qa.patch((s) => { s.plan = null; }));
// Do the first task that is possible now.
await qa(() => window.qa.world('cottage', 300, 0));
await page.waitForTimeout(600);
await press('KeyX', 500);
await press('KeyX', 400);
check('choosing a task starts the work', (await data('working')) === 'busy', await data('working'));
await page.waitForTimeout(3000);
check('then its time passes and the result shows', (await data('working')) === 'done', await data('working'));
await press('KeyX', 400);

// ── START/SELECT: status pages; the debug combo does not also act ──
await press('Enter', 600);
check('START opens the status pages', (await data('page')).length > 0, await data('page'));
await press('KeyZ', 600);
const depth0 = await qa(() => window.qa.game.scenes.depth);
await page.keyboard.down('Backspace'); await page.keyboard.down('Enter'); await page.waitForTimeout(2300);
await page.keyboard.up('Enter'); await page.keyboard.up('Backspace'); await page.waitForTimeout(400);
const top = await qa(() => ({ depth: window.qa.game.scenes.depth, debug: 'list' in window.qa.game.scenes.top && 'events' in window.qa.game.scenes.top }));
check('SELECT+START held opens only the debug panel (no status pages, no title)', top.debug && top.depth === depth0 + 1, JSON.stringify({ depth0, top }));
await press('KeyZ', 400);

// ── L cycles the belt; settings persist across a reload; an old save loads ──
const beltBefore = await qa(() => window.qa.game.save.data.belt);
await qa(() => window.qa.world('green', 200, 100));
await press('KeyQ', 300);
const beltAfter = await qa(() => window.qa.game.save.data.belt);
check('L cycles the tool on the belt', beltBefore !== beltAfter, `${beltBefore} -> ${beltAfter}`);
await qa(() => window.qa.game.updateSettings({ textSpeed: 'fast' }));
await page.waitForTimeout(300);
await page.reload();
await page.waitForTimeout(1500);
check('settings persist across a reload', (await qa(() => window.qa.game.save.data.settings.textSpeed)) === 'fast');
check('the belt persists (schema 5)', (await qa(() => window.qa.game.save.data.belt)) === beltAfter);

await page.screenshot({ path: '/tmp/peasant-verify/end.png' });
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
