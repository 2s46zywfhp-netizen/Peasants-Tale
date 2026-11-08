// End-to-end check of Phase 1 against the production build.
// Run: npm run build && npx vite preview --port 4173 &  then  node scripts/smoke-offline.mjs [outDir]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const URL_ = process.env.URL ?? 'http://localhost:4173/';
const out = process.argv[2] ?? '.';
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const ok = (m) => console.log('ok  -', m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(URL_);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
await page.reload(); // second load is served by the service worker
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) fail('service worker not controlling page');
ok('service worker installed and controlling');

// Seed a record so backup has something in it.
await page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('northprep');
  r.onsuccess = () => {
    const tx = r.result.transaction('inventory', 'readwrite');
    tx.objectStore('inventory').put({ name: 'Rolled oats', category: 'grains', quantity: 20, unit: 'kg', createdAt: '', updatedAt: '' });
    tx.oncomplete = res; tx.onerror = rej;
  };
}));

await ctx.setOffline(true);
await page.reload();
await page.getByText('OFFLINE', { exact: true }).waitFor();
ok('reloads with network cut; offline badge shown');
for (const tab of ['Prep', 'Stock', 'Guide', 'Journal', 'Home']) {
  await page.getByRole('link', { name: tab, exact: true }).click();
}
ok('all tabs navigate offline');
await page.getByText('Stock items').waitFor();
await page.waitForFunction(() => document.querySelector('dd')?.textContent === '1', null, { timeout: 5000 }).catch(() => fail('home count wrong'));
await page.screenshot({ path: `${out}/home-dark.png` });

await page.getByRole('link', { name: 'Settings and backup' }).click();
await page.getByRole('radio', { name: 'Night' }).click();
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (bg !== 'rgb(0, 0, 0)') fail('night mode background ' + bg);
await page.screenshot({ path: `${out}/settings-night.png` });
await page.getByRole('radio', { name: 'Sun' }).click();
await page.screenshot({ path: `${out}/settings-sun.png` });
ok('theme switching (Sun / Night)');

const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save backup file' }).click()]);
const path = `${out}/backup.json`;
await dl.saveAs(path);
const backup = JSON.parse(readFileSync(path, 'utf8'));
if (backup.app !== 'northprep' || backup.tables.inventory.length !== 1) fail('backup content');
ok('backup downloads offline: ' + dl.suggestedFilename());

// Wipe stock, then restore from the file.
await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('northprep'); r.onsuccess = () => { const tx = r.result.transaction('inventory', 'readwrite'); tx.objectStore('inventory').clear(); tx.oncomplete = res; }; }));
backup.tables.settings = backup.tables.settings.map((s) => (s.key === 'theme' ? { ...s, value: 'red' } : s));
writeFileSync(path, JSON.stringify(backup));
page.once('dialog', (d) => d.accept());
await page.locator('input[type=file]').setInputFiles(path);
await page.getByText('Restored').waitFor();
if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'red') fail('theme not restored');
await page.getByRole('link', { name: 'Home', exact: true }).click();
await page.getByText('Stock items').waitFor();
await page.waitForFunction(() => document.querySelector('dd')?.textContent === '1', null, { timeout: 5000 }).catch(() => fail('restore count wrong'));
ok('restore from file brings data and theme back');

page.once('dialog', (d) => d.accept());
writeFileSync(`${out}/bad.json`, '{"hello":1}');
await page.getByRole('link', { name: 'Settings and backup' }).click();
await page.locator('input[type=file]').setInputFiles(`${out}/bad.json`);
await page.getByText('not a NorthPrep backup').waitFor();
ok('bad file rejected with a clear message');

// Phases 2-4, still offline.
await page.goto(URL_ + '#/prep/location');
await page.locator('select').last().selectOption({ label: 'Timmins' });
await page.getByText('Your climate').waitFor();
await page.getByText('3a', { exact: true }).waitFor();
ok('location from town picker, offline');
await page.goto(URL_ + '#/prep/food');
await page.getByText('kcal/day target').waitFor();
if (!(await page.getByText('Fats are the rotation weak point').count())) fail('fat warning missing');
ok('food list');
await page.goto(URL_ + '#/prep/water');
await page.getByText('Storage & purification').waitFor();
await page.goto(URL_ + '#/prep/seeds');
await page.getByText('Skip (', { exact: false }).click();
await page.getByText(/Skip these in zone 3a/).waitFor();
await page.goto(URL_ + '#/prep/supplies');
await page.getByText('Cords per winter', { exact: true }).waitFor();
await page.goto(URL_ + '#/prep/hunting');
await page.getByText('Collapse Mode').first().click();
await page.getByText('Harvest sustainability').waitFor();
ok('water, seeds, supplies, hunting + collapse mode');
await page.goto(URL_ + '#/stock');
await page.getByRole('button', { name: '+ Add to stock' }).click();
await page.locator('select').first().selectOption({ index: 1 });
await page.getByLabel('Quantity').fill('5');
await page.locator('input[type=date]').nth(1).fill('2020-01-01');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText(/Use this month \(1\)/).waitFor();
await page.getByText('Expired', { exact: true }).waitFor();
ok('stock: add lot, expired alert');
await page.getByRole('link', { name: 'Home', exact: true }).click();
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: `${out}/home-print.pdf`, format: 'Letter' }).catch(() => {});
await page.screenshot({ path: `${out}/home-print.png`, fullPage: true });
ok('print layout rendered');
await browser.close();
console.log('ALL PASSED');
