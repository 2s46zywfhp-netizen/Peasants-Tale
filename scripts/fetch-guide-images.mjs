// Downloads a freely licensed photo for every field-guide entry that has a "wiki" title and no image yet.
// Uses the Wikipedia article's lead image, then checks its licence on Wikimedia Commons.
// Only public domain / CC0 / CC BY / CC BY-SA images are kept; author, licence and source are recorded.
// Run (needs internet): node scripts/fetch-guide-images.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const UA = { 'User-Agent': 'NorthPrep-build/1.0 (offline field guide; https://northprep.netlify.app)' };
const guidePath = new URL('../data/field-guide.json', import.meta.url);
const imgPath = new URL('../data/guide-images.json', import.meta.url);
const outDir = new URL('../public/guide-images/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const guide = JSON.parse(readFileSync(guidePath, 'utf8'));
const images = existsSync(imgPath)
  ? JSON.parse(readFileSync(imgPath, 'utf8'))
  : { dataset: 'guide-images', version: '1.0.0', updated: '', description: 'Bundled field-guide photos with attribution. Only public-domain and Creative Commons images from Wikimedia Commons. User photos are stored on the device, not here.', records: [] };
const FREE = /^(public domain|pd|cc0|cc[- ]by(-sa)?[- ]\d|cc[- ]by(-sa)?$|attribution|cc-by-sa-\d)/i;
const strip = (h) => (h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

let added = 0;
for (const entry of guide.records) {
  if (!entry.wiki || entry.images?.length) continue;
  try {
    const p = await json(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(entry.wiki)}`);
    const page = Object.values(p.query.pages)[0];
    const file = page.pageimage;
    if (!file) { console.log(`- ${entry.id}: no lead image`); continue; }
    const c = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&titles=File:${encodeURIComponent(file)}`);
    const info = Object.values(c.query.pages)[0]?.imageinfo?.[0];
    if (!info) { console.log(`- ${entry.id}: ${file} not on Commons (likely non-free), skipped`); continue; }
    const m = info.extmetadata ?? {};
    const lic = strip(m.LicenseShortName?.value);
    if (!FREE.test(lic)) { console.log(`- ${entry.id}: licence "${lic}" not allowed`); continue; }
    if (!/^image\/(jpeg|png|webp)/.test(info.mime)) { console.log(`- ${entry.id}: ${info.mime} skipped`); continue; }
    const ext = info.thumburl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
    const id = entry.id;
    const name = `${id}.${ext}`;
    const res = await fetch(info.thumburl, { headers: UA });
    if (!res.ok) throw new Error(`download ${res.status}`);
    writeFileSync(new URL(name, outDir), Buffer.from(await res.arrayBuffer()));
    images.records = images.records.filter((r) => r.id !== id);
    images.records.push({
      id,
      file: `guide-images/${name}`,
      title: strip(m.ObjectName?.value) || file.replace(/_/g, ' '),
      author: strip(m.Artist?.value) || 'Unknown',
      licence: lic,
      licenceUrl: m.LicenseUrl?.value ?? '',
      sourceUrl: info.descriptionurl,
    });
    entry.images = [id];
    added++;
    console.log(`+ ${id}: ${file} (${lic})`);
    await sleep(300);
  } catch (e) {
    console.log(`! ${entry.id}: ${e.message}`);
  }
}
images.updated = new Date().toISOString().slice(0, 10);
writeFileSync(imgPath, JSON.stringify(images, null, 1) + '\n');
writeFileSync(guidePath, JSON.stringify(guide, null, 1) + '\n');
console.log(`added ${added}, total ${images.records.length}`);
