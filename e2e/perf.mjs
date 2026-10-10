// Uses the container's global Playwright (not a project dependency).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = process.argv[2] ?? 'http://localhost:5173/';
const mode = process.argv[3] ?? 'alloc';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter'); // title -> name grid (fresh save)
await page.waitForTimeout(400);
if ((await page.evaluate(() => document.body.dataset.scene)) === 'naming') {
  // Keep the suggested names, skip the intro, and pass the tutorial hints (B) so the plain world is measured.
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(600);
}
await page.waitForTimeout(800);
// Walk out to the green: weather, NPCs, livestock, sky all active.
// STAY=1 measures the side-view cottage instead.
if (!process.env.STAY) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(3500); await page.keyboard.up('ArrowRight'); }
await page.waitForTimeout(Number(process.env.WARM ?? 10000)); // let the JIT optimise the hot paths
const cdp = await ctx.newCDPSession(page);
if (mode === 'alloc') {
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const walk = process.argv[4] === 'walk';
  if (walk) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowLeft'); }
  else await page.waitForTimeout(3000);
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  // Sum allocations whose stack passes through the rAF frame callback.
  const totals = new Map();
  let inFrame = 0;
  const walkTree = (n, stack) => {
    const name = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
    const st = [...stack, name];
    const viaFrame = st.some((x) => /^frame (main\.ts|index-)/.test(x));
    if (n.selfSize > 0 && viaFrame) {
      inFrame += n.selfSize;
      const key = st.slice(-4).join(' < ');
      totals.set(key, (totals.get(key) ?? 0) + n.selfSize);
    }
    for (const c of n.children) walkTree(c, st);
  };
  walkTree(profile.head, []);
  console.log('bytes allocated inside the frame loop:', inFrame);
  console.log([...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v}\t${k}`).join('\n'));
} else {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.argv[4] ?? 4) });
  await page.waitForTimeout(500);
  await cdp.send('Performance.enable');
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const r = await page.evaluate(() => new Promise((res) => {
    const ts = [];
    const f = (t) => { ts.push(t); if (ts.length < 301) requestAnimationFrame(f); else res(ts); };
    requestAnimationFrame(f);
  }));
  const d = r.slice(1).map((t, i) => t - r[i]).sort((a, b) => a - b);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const n = d.length;
  console.log(`per frame: script ${(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / n).toFixed(2)}ms, all main-thread tasks ${(((m1.TaskDuration - m0.TaskDuration) * 1000) / n).toFixed(2)}ms (budget 16.7ms; times include the ${process.argv[4] ?? 4}x throttle)`);
  console.log(`frames ${d.length} avg ${avg.toFixed(2)}ms (${(1000 / avg).toFixed(1)} fps) p50 ${d[d.length >> 1].toFixed(2)} p95 ${d[Math.floor(d.length * 0.95)].toFixed(2)} max ${d[d.length - 1].toFixed(2)}`);
  // Also time the work per frame (draw cost) with long tasks
  const work = await page.evaluate(() => (window).__frameWork ?? null);
  if (work) console.log('work', work);
}
console.log('errors', errors);
await browser.close();
