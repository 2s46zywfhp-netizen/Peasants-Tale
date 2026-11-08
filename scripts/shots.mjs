// Screenshots of given hash routes on a phone viewport. Usage: node scripts/shots.mjs outDir route[:name] ...
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [out, ...routes] = process.argv.slice(2);
const base = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1, geolocation: { latitude: 46.49, longitude: -80.99 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
if (process.env.SETUP) await page.evaluate(process.env.SETUP);
for (const r of routes) {
  const [route, name, action] = r.split('|');
  await page.goto(base + '#' + route);
  await page.waitForTimeout(400);
  if (action) { await page.getByRole('button', { name: action }).first().click(); await page.waitForTimeout(800); }
  await page.screenshot({ path: `${out}/${name ?? route.replace(/\W/g, '_')}.png`, fullPage: true });
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
