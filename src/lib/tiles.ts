/** Map tile maths and offline tile download for NRCan base maps (Open Government Licence – Canada). */

export const NRCAN_BASE = 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/BaseMaps/CBMT_CBCT_GEOM_3857/MapServer/tile/{z}/{y}/{x}';
export const NRCAN_LABELS = 'https://maps-cartes.services.geo.ca/server2_serveur2/rest/services/BaseMaps/CBMT_TXT_3857/MapServer/tile/{z}/{y}/{x}';
export const TOPORAMA_WMS = 'https://maps.geogratis.gc.ca/wms/toporama_en';
export const TILE_CACHE = 'map-tiles';
export const MAX_TILES = 3000;

export const lon2x = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
export const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export interface Bounds { north: number; south: number; east: number; west: number }

export function tilesFor(b: Bounds, zMin: number, zMax: number): { z: number; x: number; y: number }[] {
  const out: { z: number; x: number; y: number }[] = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2x(b.west, z), x1 = lon2x(b.east, z);
    const y0 = lat2y(b.north, z), y1 = lat2y(b.south, z);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) out.push({ z, x, y });
  }
  return out;
}

export const tileUrl = (tpl: string, t: { z: number; x: number; y: number }) => tpl.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));

/** Downloads base + label tiles into Cache Storage, which the service worker serves offline. */
export async function downloadTiles(tiles: { z: number; x: number; y: number }[], onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<{ ok: number; failed: number }> {
  const cache = await caches.open(TILE_CACHE);
  const urls = tiles.flatMap((t) => [tileUrl(NRCAN_BASE, t), tileUrl(NRCAN_LABELS, t)]);
  let done = 0, ok = 0, failed = 0, i = 0;
  const worker = async () => {
    while (i < urls.length && !signal?.aborted) {
      const url = urls[i++];
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
          else throw new Error(String(res.status));
        }
        ok++;
      } catch {
        failed++;
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { ok, failed };
}

export async function cachedTileCount(): Promise<number> {
  if (!('caches' in window)) return 0;
  return (await (await caches.open(TILE_CACHE)).keys()).length;
}

export async function clearTiles() {
  await caches.delete(TILE_CACHE);
}

/** GPX 1.1 waypoints for use in other GPS apps. */
export function toGpx(points: { lat: number; lon: number; name: string; desc?: string; time?: string; type?: string }[]): string {
  const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
  const wpts = points
    .map((p) => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.time ? `<time>${esc(p.time)}</time>` : ''}<name>${esc(p.name)}</name>${p.desc ? `<desc>${esc(p.desc)}</desc>` : ''}${p.type ? `<type>${esc(p.type)}</type>` : ''}</wpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NorthPrep" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>\n`;
}
