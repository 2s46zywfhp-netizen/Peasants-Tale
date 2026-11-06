// Renders public/icons/icon.svg to the PNG sizes the PWA manifest needs.
// Run: node scripts/make-icons.mjs   (uses the pre-installed Playwright Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, pad, name] of [[192, 0, 'icon-192'], [512, 0, 'icon-512'], [512, 0.12, 'icon-512-maskable']]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<body style="margin:0;background:#0b0b0b;display:grid;place-items:center;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}.png`, import.meta.url).pathname });
}
await browser.close();
