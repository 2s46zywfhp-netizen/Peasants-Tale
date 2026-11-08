import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../../db/db';
import { useProfile } from '../../lib/store';
import { useOnline } from '../../lib/useOnline';
import { cachedTileCount, clearTiles, downloadTiles, MAX_TILES, NRCAN_BASE, NRCAN_LABELS, tilesFor, TOPORAMA_WMS, toGpx } from '../../lib/tiles';
import { downloadText } from '../../lib/files';
import { BackLink } from '../../components/ui';
import { typeInfo } from './JournalPages';

const ATTR = '© Natural Resources Canada · Open Government Licence – Canada';

export function MapPage() {
  const div = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const online = useOnline();
  const { profile } = useProfile();
  const entries = useLiveQuery(() => db.journal.toArray(), []) ?? [];
  const [tiles, setTiles] = useState(0);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const pins = entries.filter((e) => e.lat != null && e.lon != null && !e.locked);
  const lockedCount = entries.filter((e) => e.locked).length;

  useEffect(() => {
    if (!div.current || map.current) return;
    const lat = Number(sp.get('lat')) || profile?.lat || 46.49;
    const lon = Number(sp.get('lon')) || profile?.lon || -80.99;
    const m = L.map(div.current, { zoomControl: true, attributionControl: true }).setView([lat, lon], sp.get('lat') ? 14 : 10);
    const base = L.layerGroup([
      L.tileLayer(NRCAN_BASE, { maxZoom: 18, maxNativeZoom: 17, attribution: ATTR, crossOrigin: true }),
      L.tileLayer(NRCAN_LABELS, { maxZoom: 18, maxNativeZoom: 17, crossOrigin: true }),
    ]).addTo(m);
    const topo = L.tileLayer.wms(TOPORAMA_WMS, { layers: 'WMS-Toporama', format: 'image/png', attribution: ATTR, maxZoom: 18 });
    L.control.layers({ 'Canada base map (offline-capable)': base, 'Toporama topo (online only)': topo }).addTo(m);
    L.control.scale({ metric: true, imperial: false }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('contextmenu', (ev: L.LeafletMouseEvent) => {
      if (window.confirm(`New journal entry at ${ev.latlng.lat.toFixed(5)}, ${ev.latlng.lng.toFixed(5)}?`)) nav(`/journal/new?lat=${ev.latlng.lat.toFixed(6)}&lon=${ev.latlng.lng.toFixed(6)}`);
    });
    map.current = m;
    void cachedTileCount().then(setTiles);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const e of pins) {
      const t = typeInfo(e.type);
      const icon = L.divIcon({ className: '', html: `<div style="font-size:24px;line-height:24px;filter:drop-shadow(0 0 2px #000)">${t.icon}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
      const mk = L.marker([e.lat!, e.lon!], { icon, title: e.title || t.label });
      const a = document.createElement('a');
      a.href = `#/journal/${e.id}`;
      a.textContent = `${e.title || t.label} (${e.date.slice(0, 10)})`;
      a.style.fontWeight = 'bold';
      mk.bindPopup(a);
      g.addLayer(mk);
    }
  }, [pins]);

  const here = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        map.current?.setView([p.coords.latitude, p.coords.longitude], 14);
        L.circleMarker([p.coords.latitude, p.coords.longitude], { radius: 8, color: '#e00' }).addTo(map.current!).bindPopup('You are here').openPopup();
      },
      (e) => setProgress(`GPS failed: ${e.message}`),
      { enableHighAccuracy: true, timeout: 60000 },
    );

  const download = async () => {
    const m = map.current!;
    const b = m.getBounds();
    const z = m.getZoom();
    let zMax = Math.min(z + 3, 16);
    let list = tilesFor({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }, Math.max(6, z - 2), zMax);
    while (list.length > MAX_TILES && zMax > z) {
      zMax--;
      list = tilesFor({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }, Math.max(6, z - 2), zMax);
    }
    if (list.length > MAX_TILES) return setProgress('Area too large: zoom in further, then download.');
    if (!window.confirm(`Download ${list.length * 2} map tiles (zoom ${Math.max(6, z - 2)}–${zMax}) for offline use? Roughly ${Math.round((list.length * 2 * 15) / 1024)} MB.`)) return;
    setBusy(true);
    const r = await downloadTiles(list, (d, t) => setProgress(`Downloading ${d} / ${t}…`));
    setBusy(false);
    setProgress(`Saved ${r.ok} tiles${r.failed ? `, ${r.failed} failed` : ''}. This area now works offline.`);
    setTiles(await cachedTileCount());
  };

  const gpx = () => downloadText('northprep-pins.gpx', toGpx(pins.map((e) => ({ lat: e.lat!, lon: e.lon!, name: e.title || typeInfo(e.type).label, desc: e.body.slice(0, 200), time: new Date(e.date).toISOString(), type: e.type }))), 'application/gpx+xml');

  return (
    <div className="space-y-3">
      <BackLink to="/journal" label="Journal" />
      <h1 className="h1">Map</h1>
      <div ref={div} className="relative z-0 h-[60vh] w-full rounded-lg border-2 border-line" style={{ background: '#d8d8d8' }} />
      <p className="text-sm text-muted">
        {pins.length} pins{lockedCount ? ` · ${lockedCount} locked caches hidden` : ''} · Long-press the map to add an entry there. {tiles ? `${tiles} map tiles saved for offline.` : 'No map area saved for offline yet.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={here}>📍 Where am I</button>
        <button type="button" className="btn" onClick={gpx} disabled={!pins.length}>Export GPX</button>
        <button type="button" className="btn-primary col-span-2" onClick={download} disabled={!online || busy}>
          {busy ? 'Downloading…' : 'Save this area for offline'}
        </button>
        {tiles > 0 && (
          <button type="button" className="btn col-span-2" onClick={async () => { if (window.confirm('Delete all saved map tiles?')) { await clearTiles(); setTiles(0); } }}>
            Delete saved map tiles
          </button>
        )}
      </div>
      {progress && <p role="status" className="font-bold">{progress}</p>}
      {!online && <p className="text-sm text-muted">Offline: only areas you saved earlier will show map detail. Pins and GPS always work.</p>}
    </div>
  );
}
