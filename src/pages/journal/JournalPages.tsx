import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { JournalEntry, JournalType } from '../../db/types';
import { gardenSummary } from '../../calc/garden';
import { seal, unseal } from '../../lib/pin';
import { useOnline } from '../../lib/useOnline';
import { fmtNum } from '../../lib/format';
import { BackLink, Badge, Chips, Field, Select } from '../../components/ui';
import { UserPhotos } from '../../components/Photos';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

export const TYPES: { value: JournalType; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '✎' },
  { value: 'foraging', label: 'Foraging find', icon: '🌿' },
  { value: 'harvest', label: 'Harvest', icon: '🧺' },
  { value: 'hunt-fish', label: 'Hunt / fish', icon: '🎣' },
  { value: 'water', label: 'Water source', icon: '💧' },
  { value: 'cache', label: 'Cache location', icon: '📦' },
  { value: 'garden', label: 'Garden', icon: '🌱' },
];
export const typeInfo = (t: JournalType) => TYPES.find((x) => x.value === t)!;
const CONDITIONS = ['', 'Clear', 'Partly cloudy', 'Overcast', 'Rain', 'Snow', 'Freezing rain', 'Fog', 'Windy', 'Storm'];
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
interface Secret { title: string; body: string; tags: string[]; lat?: number; lon?: number }

export function JournalList() {
  const entries = useLiveQuery(() => db.journal.orderBy('date').reverse().toArray(), []) ?? [];
  const [type, setType] = useState<JournalType | 'all'>('all');
  const [q, setQ] = useState('');
  const shown = entries.filter((e) => (type === 'all' || e.type === type) && (!q || `${e.title} ${e.body} ${e.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-4">
      <PrintHeader title="Journal" />
      <h1 className="h1">Journal</h1>
      <div className="no-print grid grid-cols-3 gap-2">
        <Link to="/journal/new" className="btn-primary col-span-3">+ New entry</Link>
        <Link to="/journal/map" className="btn">🗺 Map</Link>
        <Link to="/journal/garden" className="btn">🌱 Garden</Link>
        <PrintButton label="Print" />
      </div>
      <input className="field no-print" type="search" placeholder="Search journal" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search journal" />
      <div className="no-print">
        <Select label="Filter" value={type} onChange={(v) => setType(v as JournalType | 'all')} options={[{ value: 'all', label: `All types (${entries.length})` }, ...TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label} (${entries.filter((e) => e.type === t.value).length})` }))]} />
      </div>
      <ul className="space-y-2">
        {shown.map((e) => (
          <li key={e.id}>
            <Link to={`/journal/${e.id}`} className="block rounded-lg border-2 border-line p-3">
              <div className="flex items-center gap-2">
                <span aria-hidden>{e.locked ? '🔒' : typeInfo(e.type).icon}</span>
                <span className="flex-1 font-bold">{e.locked ? 'Locked cache' : e.title || typeInfo(e.type).label}</span>
                <span className="text-sm text-muted">{e.date.slice(0, 10)}</span>
              </div>
              {!e.locked && e.body && <p className="mt-1 line-clamp-2 text-sm text-muted print:line-clamp-none">{e.body}</p>}
              {!e.locked && (e.lat != null || e.tags.length > 0) && (
                <p className="mt-1 text-xs text-muted">
                  {e.lat != null && `📍 ${e.lat.toFixed(4)}, ${e.lon!.toFixed(4)} `}
                  {e.tags.map((t) => `#${t}`).join(' ')}
                </p>
              )}
            </Link>
          </li>
        ))}
        {!shown.length && <li className="text-muted">No entries yet.</li>}
      </ul>
    </div>
  );
}

function PinPrompt({ label, onPin, confirm }: { label: string; onPin: (pin: string) => void; confirm?: boolean }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  return (
    <form
      className="space-y-2 rounded-lg border-2 border-accent p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (a.length < 4) return setErr('Use at least 4 characters (6+ is much safer).');
        if (confirm && a !== b) return setErr('PINs do not match.');
        onPin(a);
      }}
    >
      <Field label={label}>
        <input className="field" type="password" inputMode="numeric" autoComplete="off" value={a} onChange={(e) => setA(e.target.value)} />
      </Field>
      {confirm && (
        <Field label="Repeat PIN">
          <input className="field" type="password" inputMode="numeric" autoComplete="off" value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
      )}
      {err && <p className="font-bold text-danger">{err}</p>}
      <button className="btn-primary w-full" type="submit">{confirm ? 'Lock' : 'Unlock'}</button>
      {confirm && <p className="text-sm text-muted">If you forget the PIN, the location cannot be recovered. Short PINs stop casual snooping, not a determined attacker with your phone or backup file. Photos are not encrypted.</p>}
    </form>
  );
}

export function JournalEntryPage() {
  const { id = 'new' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const online = useOnline();
  const isNew = id === 'new';
  const stored = useLiveQuery(() => (isNew ? undefined : db.journal.get(Number(id))), [id]);
  const [draft, setDraft] = useState<JournalEntry | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [pin, setPin] = useState<string | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [locking, setLocking] = useState(false);
  const [msg, setMsg] = useState('');
  const blank: JournalEntry = useMemo(() => {
    const t = (sp.get('type') as JournalType) || 'general';
    const lat = sp.get('lat') ? Number(sp.get('lat')) : undefined;
    const lon = sp.get('lon') ? Number(sp.get('lon')) : undefined;
    const ev = sp.get('event') as NonNullable<JournalEntry['garden']>['event'] | null;
    return { date: localNow(), type: t, title: '', body: '', tags: [], lat, lon, attachmentIds: [], garden: t === 'garden' ? { event: ev ?? 'planting', crop: '' } : undefined, createdAt: '', updatedAt: '' };
  }, [sp]);
  const base = stored ?? (isNew ? blank : null);
  if (!base) return <p>Loading…</p>;
  // When unlocked, show/edit the decrypted fields.
  const e: JournalEntry = draft ?? (secret ? { ...base, ...secret } : base);
  const set = (p: Partial<JournalEntry>) => setDraft({ ...e, ...p });
  const lockedClosed = !!base.locked && !secret;

  const gps = () => {
    setMsg('Getting GPS fix…');
    navigator.geolocation?.getCurrentPosition(
      (p) => { set({ lat: Number(p.coords.latitude.toFixed(6)), lon: Number(p.coords.longitude.toFixed(6)) }); setMsg(`Location set (±${Math.round(p.coords.accuracy)} m).`); },
      (er) => setMsg(`GPS failed: ${er.message}`),
      { enableHighAccuracy: true, timeout: 60000 },
    );
  };
  const weather = async () => {
    if (e.lat == null) return setMsg('Set a location first.');
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${e.lat}&longitude=${e.lon}&current=temperature_2m,weather_code,wind_speed_10m`);
      const j = await r.json();
      const code = j.current.weather_code as number;
      const cond = code === 0 ? 'Clear' : code <= 3 ? 'Partly cloudy' : code <= 48 ? 'Fog' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Rain' : code <= 86 ? 'Snow' : 'Storm';
      set({ weather: { tempC: Math.round(j.current.temperature_2m), conditions: cond, wind: `${Math.round(j.current.wind_speed_10m)} km/h` } });
      setMsg('Weather filled in.');
    } catch {
      setMsg('Weather lookup failed; enter it by hand.');
    }
  };

  const save = async (lockPin?: string) => {
    const now = new Date().toISOString();
    let row: JournalEntry = { ...e, tags: e.tags.map((t) => t.trim()).filter(Boolean), updatedAt: now, createdAt: e.createdAt || now };
    const p = lockPin ?? pin;
    if (p && (row.locked || lockPin)) {
      const s: Secret = { title: row.title, body: row.body, tags: row.tags, lat: row.lat, lon: row.lon };
      row = { ...row, title: '', body: '', tags: [], lat: undefined, lon: undefined, locked: await seal(s, p) };
    }
    const newId = await db.journal.put(row);
    setDraft(null);
    setEditing(false);
    setLocking(false);
    if (lockPin) { setPin(null); setSecret(null); }
    else if (row.locked && p) setSecret({ title: e.title, body: e.body, tags: row.tags.length ? row.tags : e.tags, lat: e.lat, lon: e.lon });
    if (isNew) nav(`/journal/${newId}`, { replace: true });
  };

  if (lockedClosed) {
    return (
      <div className="space-y-4">
        <BackLink to="/journal" label="Journal" />
        <h1 className="h1">🔒 Locked cache</h1>
        <p className="text-muted">{base.date.replace('T', ' ')}</p>
        <PinPrompt
          label="PIN"
          onPin={async (p) => {
            try { setSecret(await unseal<Secret>(base.locked!, p)); setPin(p); setMsg(''); }
            catch { setMsg('Wrong PIN.'); }
          }}
        />
        {msg && <p role="alert" className="font-bold text-danger">{msg}</p>}
      </div>
    );
  }

  if (!editing) {
    const t = typeInfo(e.type);
    return (
      <div className="space-y-4">
        <BackLink to="/journal" label="Journal" />
        <PrintHeader title="Journal entry" />
        <h1 className="h1">{t.icon} {e.title || t.label}</h1>
        <p className="text-muted">{e.date.replace('T', ' ')} · {t.label}{base.locked ? ' · 🔒 locked' : ''}</p>
        {e.garden && <p className="font-bold">Garden: {e.garden.event}{e.garden.crop ? ` — ${e.garden.crop}` : ''}{e.garden.qty ? ` · ${e.garden.qty} ${e.garden.unit ?? ''}` : ''}</p>}
        {e.body && <p className="whitespace-pre-line">{e.body}</p>}
        {e.lat != null && (
          <p>
            📍 {e.lat.toFixed(5)}, {e.lon!.toFixed(5)}{' '}
            <Link className="no-print font-bold text-accent" to={`/journal/map?lat=${e.lat}&lon=${e.lon}`}>Show on map</Link>
          </p>
        )}
        {e.weather && (e.weather.tempC != null || e.weather.conditions) && <p>🌡 {e.weather.tempC != null ? `${e.weather.tempC} °C` : ''} {e.weather.conditions} {e.weather.wind}</p>}
        {e.tags.length > 0 && <div className="flex flex-wrap gap-1">{e.tags.map((x) => <Badge key={x}>#{x}</Badge>)}</div>}
        {!isNew && <UserPhotos refKey={`journal:${id}`} />}
        <div className="no-print grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" onClick={() => setEditing(true)}>Edit</button>
          <PrintButton />
        </div>
        {e.type === 'cache' && !base.locked && !locking && <button type="button" className="btn w-full" onClick={() => setLocking(true)}>🔒 Lock with PIN</button>}
        {locking && <PinPrompt label="New PIN" confirm onPin={(p) => save(p)} />}
        {base.locked && (
          <button type="button" className="btn w-full" onClick={async () => { await db.journal.put({ ...base, ...secret!, locked: undefined }); setPin(null); setSecret(null); }}>
            Remove lock
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <BackLink to="/journal" label="Journal" />
      <h1 className="h1">{isNew ? 'New entry' : 'Edit entry'}</h1>
      <Field label="Type"><Select label="Type" value={e.type} onChange={(v) => set({ type: v, garden: v === 'garden' ? e.garden ?? { event: 'planting', crop: '' } : e.garden })} options={TYPES.map((t) => ({ value: t.value, label: `${t.icon} ${t.label}` }))} /></Field>
      <Field label="Date and time"><input className="field" type="datetime-local" value={e.date} onChange={(ev) => set({ date: ev.target.value })} /></Field>
      <Field label="Title"><input className="field" value={e.title} onChange={(ev) => set({ title: ev.target.value })} /></Field>
      {e.type === 'garden' && e.garden && (
        <div className="card space-y-2">
          <Chips label="Garden event" value={e.garden.event} onChange={(v) => set({ garden: { ...e.garden!, event: v } })} options={[{ value: 'planting', label: 'Planting' }, { value: 'harvest', label: 'Harvest' }, { value: 'frost', label: 'Frost' }, { value: 'seed-saved', label: 'Seed saved' }]} />
          {e.garden.event !== 'frost' && <Field label="Crop"><input className="field" value={e.garden.crop} onChange={(ev) => set({ garden: { ...e.garden!, crop: ev.target.value } })} placeholder="e.g. Potato" /></Field>}
          {e.garden.event === 'harvest' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount"><input className="field" inputMode="decimal" value={e.garden.qty ?? ''} onChange={(ev) => set({ garden: { ...e.garden!, qty: ev.target.value ? Number(ev.target.value) : undefined } })} /></Field>
              <Field label="Unit"><input className="field" value={e.garden.unit ?? 'kg'} onChange={(ev) => set({ garden: { ...e.garden!, unit: ev.target.value } })} /></Field>
            </div>
          )}
        </div>
      )}
      <Field label="Notes"><textarea className="field min-h-[8rem] py-2" value={e.body} onChange={(ev) => set({ body: ev.target.value })} /></Field>
      <Field label="Tags" hint="Comma-separated"><input className="field" value={e.tags.join(', ')} onChange={(ev) => set({ tags: ev.target.value.split(',') })} /></Field>
      <div className="card space-y-2">
        <h2 className="h2">Location</h2>
        <button type="button" className="btn w-full" onClick={gps}>📍 Use GPS (works offline)</button>
        <div className="grid grid-cols-2 gap-2">
          <input className="field" inputMode="decimal" aria-label="Latitude" placeholder="Latitude" value={e.lat ?? ''} onChange={(ev) => set({ lat: ev.target.value ? Number(ev.target.value) : undefined })} />
          <input className="field" inputMode="decimal" aria-label="Longitude" placeholder="Longitude" value={e.lon ?? ''} onChange={(ev) => set({ lon: ev.target.value ? Number(ev.target.value) : undefined })} />
        </div>
      </div>
      <div className="card space-y-2">
        <h2 className="h2">Weather</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="field" inputMode="decimal" aria-label="Temperature °C" placeholder="°C" value={e.weather?.tempC ?? ''} onChange={(ev) => set({ weather: { ...e.weather, tempC: ev.target.value === '' ? undefined : Number(ev.target.value) } })} />
          <select className="field col-span-2" aria-label="Conditions" value={e.weather?.conditions ?? ''} onChange={(ev) => set({ weather: { ...e.weather, conditions: ev.target.value } })}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c || 'Conditions…'}</option>)}
          </select>
        </div>
        <input className="field" aria-label="Wind" placeholder="Wind (e.g. NW 20 km/h)" value={e.weather?.wind ?? ''} onChange={(ev) => set({ weather: { ...e.weather, wind: ev.target.value } })} />
        {online && <button type="button" className="btn w-full" onClick={weather}>Fill current weather (online)</button>}
      </div>
      {msg && <p role="status" className="font-bold">{msg}</p>}
      {isNew && <p className="text-sm text-muted">Save first, then add photos.</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={() => save()}>Save</button>
        <button type="button" className="btn" onClick={() => (isNew ? nav('/journal') : (setDraft(null), setEditing(false)))}>Cancel</button>
      </div>
      {!isNew && (
        <button type="button" className="btn-danger w-full" onClick={async () => {
          if (!window.confirm('Delete this entry and its photos?')) return;
          await db.attachments.where('ref').equals(`journal:${id}`).delete();
          await db.journal.delete(Number(id));
          nav('/journal');
        }}>
          Delete entry
        </button>
      )}
    </div>
  );
}

export function GardenPage() {
  const entries = useLiveQuery(() => db.journal.where('type').equals('garden').toArray(), []) ?? [];
  const s = useMemo(() => gardenSummary(entries), [entries]);
  const crops = [...new Set(s.crops.map((c) => c.crop.toLowerCase()))];
  return (
    <div className="space-y-4">
      <BackLink to="/journal" label="Journal" />
      <PrintHeader title="Garden log — year over year" />
      <h1 className="h1">Garden log</h1>
      <div className="no-print grid grid-cols-2 gap-2">
        <Link className="btn-primary" to="/journal/new?type=garden&event=planting">+ Planting</Link>
        <Link className="btn-primary" to="/journal/new?type=garden&event=harvest">+ Harvest</Link>
        <Link className="btn" to="/journal/new?type=garden&event=frost">+ Frost</Link>
        <Link className="btn" to="/journal/new?type=garden&event=seed-saved">+ Seed saved</Link>
      </div>
      {!s.years.length && <p className="text-muted">Log plantings, harvests, frosts and seed saving here. Each year appears as a column so you can compare.</p>}
      {s.frosts.length > 0 && (
        <section className="card">
          <h2 className="h2">Frosts observed</h2>
          <table className="mt-2 w-full text-sm">
            <thead><tr><th className="text-left">Year</th><th className="text-left">Last spring</th><th className="text-left">First fall</th></tr></thead>
            <tbody>{s.frosts.map((f) => <tr key={f.year}><td>{f.year}</td><td>{f.lastSpring?.slice(5) ?? '—'}</td><td>{f.firstFall?.slice(5) ?? '—'}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      {crops.map((name) => {
        const rows = s.crops.filter((c) => c.crop.toLowerCase() === name);
        return (
          <section key={name} className="card">
            <h2 className="h2">{rows[0].crop}</h2>
            <table className="mt-2 w-full text-sm">
              <thead><tr><th className="text-left">Year</th><th className="text-left">Planted</th><th className="text-left">Harvest</th><th className="text-left">Seed</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.year}>
                    <td>{c.year}</td>
                    <td>{c.firstPlanted?.slice(5) ?? '—'}</td>
                    <td>{c.harvests ? `${fmtNum(c.harvestQty, 1)} ${c.harvestUnit}` : '—'}</td>
                    <td>{c.seedSaved ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <PrintButton />
    </div>
  );
}
