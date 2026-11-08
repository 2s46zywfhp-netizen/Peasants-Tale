import { useState } from 'react';
import { buildProfile, normalizePostal, townForPostal, type Climate, type ClimateField, type LocationProfile } from '../../calc/climate';
import { fetchEcccNormals, fetchOpenMeteo } from '../../lib/climateOnline';
import { stations, towns } from '../../lib/refData';
import { saveProfile, useProfile } from '../../lib/store';
import { useOnline } from '../../lib/useOnline';
import { fmtMmDd, fmtNum, snowMonthsText } from '../../lib/format';
import { BackLink, Field } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const FIELDS: { key: ClimateField; label: string; show: (c: Climate) => string; edit: 'text' | 'number' | 'mmdd' | 'months'; hint?: string }[] = [
  { key: 'zone', label: 'Plant hardiness zone (NRCan)', show: (c) => c.zone, edit: 'text', hint: 'e.g. 3b' },
  { key: 'lastFrost', label: 'Average last spring frost', show: (c) => fmtMmDd(c.lastFrost), edit: 'mmdd' },
  { key: 'firstFrost', label: 'Average first fall frost', show: (c) => fmtMmDd(c.firstFrost), edit: 'mmdd' },
  { key: 'frostFreeDays', label: 'Frost-free days', show: (c) => `${c.frostFreeDays} days`, edit: 'number' },
  { key: 'designLowC', label: 'Winter design low', show: (c) => `${c.designLowC} °C`, edit: 'number', hint: 'Cold that is reached or passed about 1 day in 40 in January' },
  { key: 'annualPrecipMm', label: 'Annual precipitation', show: (c) => `${fmtNum(c.annualPrecipMm)} mm`, edit: 'number' },
  { key: 'snowMonths', label: 'Snow cover', show: (c) => snowMonthsText(c.snowMonths), edit: 'months', hint: 'Month numbers, e.g. 11,12,1,2,3' },
  { key: 'hdd', label: 'Heating degree-days (18 °C)', show: (c) => fmtNum(c.hdd), edit: 'number', hint: 'Drives firewood and fuel estimates' },
  { key: 'janMeanC', label: 'January mean temperature', show: (c) => `${c.janMeanC} °C`, edit: 'number' },
];

export function LocationPage() {
  const { profile, climate } = useProfile();
  const online = useOnline();
  const [postal, setPostal] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<ClimateField | null>(null);
  const [draft, setDraft] = useState('');

  const apply = async (p: LocationProfile, text: string) => {
    if (profile) p.name = profile.name;
    await saveProfile(p);
    setMsg({ kind: 'ok', text });
  };

  const fromPostal = async () => {
    const hit = townForPostal(postal, towns);
    if (!normalizePostal(postal)) return setMsg({ kind: 'err', text: 'That is not a Canadian postal code (e.g. P3E 2C6).' });
    if (!hit) return setMsg({ kind: 'err', text: 'This postal area is not in the offline table. Use GPS, enter coordinates, or pick the nearest town.' });
    const p = buildProfile(hit.town.lat, hit.town.lon, { kind: 'postal', value: normalizePostal(postal)! }, stations, towns);
    if (!hit.exact) p.notes.unshift(`Postal code matched only by region (${hit.town.name}). Use GPS for accuracy.`);
    if (/^P0/.test(normalizePostal(postal)!)) p.notes.unshift('Rural postal areas cover hundreds of km. GPS gives a much better match.');
    await apply(p, `Matched ${hit.town.name}.`);
  };

  const fromLatLon = async (la: number, lo: number, kind: 'gps' | 'latlon') => {
    if (!(la >= 41 && la <= 57 && lo >= -96 && lo <= -74)) {
      setMsg({ kind: 'err', text: 'Those coordinates are outside Ontario; the offline data covers Ontario only. Results may be poor — try an online refresh.' });
    }
    const p = buildProfile(la, lo, { kind, value: `${la.toFixed(4)}, ${lo.toFixed(4)}` }, stations, towns);
    await apply(p, `Location set (${la.toFixed(3)}, ${lo.toFixed(3)}).`);
  };

  const gps = () => {
    if (!navigator.geolocation) return setMsg({ kind: 'err', text: 'GPS not available on this device.' });
    setBusy('gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy('');
        setLat(pos.coords.latitude.toFixed(5));
        setLon(pos.coords.longitude.toFixed(5));
        void fromLatLon(pos.coords.latitude, pos.coords.longitude, 'gps');
      },
      (err) => {
        setBusy('');
        setMsg({ kind: 'err', text: `GPS failed: ${err.message}. GPS works offline but may take a minute outdoors.` });
      },
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 600000 },
    );
  };

  const refresh = async (src: 'open-meteo' | 'eccc') => {
    if (!profile) return;
    setBusy(src);
    setMsg(null);
    try {
      const r = src === 'open-meteo' ? await fetchOpenMeteo(profile.lat, profile.lon) : await fetchEcccNormals(profile.lat, profile.lon);
      await saveProfile({ ...profile, derived: { ...profile.derived, ...r.values }, refreshed: { source: src, at: new Date().toISOString(), detail: r.detail } });
      setMsg({ kind: 'ok', text: `Updated from ${r.detail}` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Refresh failed: ${(e as Error).message}. Your offline values are unchanged.` });
    } finally {
      setBusy('');
    }
  };

  const saveOverride = async (key: ClimateField) => {
    if (!profile) return;
    let v: unknown = draft.trim();
    const f = FIELDS.find((x) => x.key === key)!;
    if (f.edit === 'number') v = Number(draft);
    if (f.edit === 'months') v = draft.split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= 12);
    if (f.edit === 'mmdd' && !/^\d{2}-\d{2}$/.test(String(v))) return setMsg({ kind: 'err', text: 'Use MM-DD, e.g. 05-24.' });
    if (f.edit === 'number' && !Number.isFinite(v as number)) return setMsg({ kind: 'err', text: 'Enter a number.' });
    await saveProfile({ ...profile, overrides: { ...profile.overrides, [key]: v } });
    setEditing(null);
  };

  const clearOverride = async (key: ClimateField) => {
    if (!profile) return;
    const o = { ...profile.overrides };
    delete o[key];
    await saveProfile({ ...profile, overrides: o });
  };

  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title="Location profile" />
      <h1 className="h1">Location</h1>

      <section className="card no-print space-y-3">
        <button type="button" className="btn-primary w-full" onClick={gps} disabled={busy === 'gps'}>
          {busy === 'gps' ? 'Getting GPS fix…' : 'Use GPS (works offline)'}
        </button>
        <Field label="Postal code">
          <div className="flex gap-2">
            <input className="field uppercase" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="P3E 2C6" autoComplete="postal-code" />
            <button type="button" className="btn" onClick={fromPostal}>
              Find
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude">
            <input className="field" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="46.49" />
          </Field>
          <Field label="Longitude">
            <input className="field" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-80.99" />
          </Field>
        </div>
        <button type="button" className="btn w-full" onClick={() => fromLatLon(Number(lat), Number(lon), 'latlon')} disabled={!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))}>
          Use coordinates
        </button>
        <Field label="Or pick the nearest town">
          <select
            className="field"
            value=""
            onChange={(e) => {
              const t = towns.find((x) => x.id === e.target.value);
              if (t) void apply(buildProfile(t.lat, t.lon, { kind: 'town', value: t.name }, stations, towns), `Using ${t.name}.`);
            }}
          >
            <option value="">Choose…</option>
            {towns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        {msg && (
          <p role="alert" className={`font-bold ${msg.kind === 'ok' ? 'text-ok' : 'text-danger'}`}>
            {msg.text}
          </p>
        )}
      </section>

      {profile && climate && (
        <>
          <section className="card space-y-2">
            <h2 className="h2">Your climate</h2>
            <p className="text-sm text-muted">
              {profile.input.kind === 'postal' ? `Postal ${profile.input.value}` : profile.input.kind === 'town' ? profile.input.value : `${profile.lat.toFixed(3)}, ${profile.lon.toFixed(3)}`} · Station: {profile.stationName} ({profile.stationKm} km) · Zone/design low from {profile.townName}
              {profile.townKm > 5 ? ` (${profile.townKm} km)` : ''}
            </p>
            <dl className="divide-y-2 divide-line">
              {FIELDS.map((f) => {
                const overridden = f.key in profile.overrides;
                return (
                  <div key={f.key} className="py-2">
                    <div className="flex items-center gap-2">
                      <dt className="flex-1">
                        {f.label}
                        {overridden && <span className="ml-2 text-xs font-extrabold text-accent">EDITED</span>}
                      </dt>
                      <dd className="text-right font-extrabold">{f.show(climate)}</dd>
                      <button
                        type="button"
                        className="btn no-print min-w-tap px-2 text-sm"
                        aria-label={`Edit ${f.label}`}
                        onClick={() => {
                          setEditing(f.key);
                          const v = climate[f.key];
                          setDraft(Array.isArray(v) ? v.join(',') : String(v));
                        }}
                      >
                        Edit
                      </button>
                    </div>
                    {editing === f.key && (
                      <div className="no-print mt-2 space-y-2">
                        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                        {f.hint && <p className="text-sm text-muted">{f.hint}</p>}
                        <div className="flex gap-2">
                          <button type="button" className="btn-primary flex-1" onClick={() => saveOverride(f.key)}>
                            Save
                          </button>
                          {overridden && (
                            <button type="button" className="btn flex-1" onClick={() => { void clearOverride(f.key); setEditing(null); }}>
                              Reset
                            </button>
                          )}
                          <button type="button" className="btn flex-1" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </dl>
            {profile.notes.map((n) => (
              <p key={n} className="text-sm text-accent">
                ⚠ {n}
              </p>
            ))}
            <p className="text-sm text-muted">
              Offline data: ECCC 1981–2010 climate normals. Zones and design lows are approximate (NRCan, NBC 2020) — edit if you know better.
              {profile.refreshed && ` Last refresh: ${profile.refreshed.detail} on ${profile.refreshed.at.slice(0, 10)}.`}
            </p>
          </section>

          <section className="card no-print space-y-2">
            <h2 className="h2">Online refresh (optional)</h2>
            <p className="text-sm text-muted">Replaces frost dates, precipitation, snow and degree-days with fresher data. Zone and your edits are kept.</p>
            <button type="button" className="btn w-full" disabled={!online || !!busy} onClick={() => refresh('open-meteo')}>
              {busy === 'open-meteo' ? 'Fetching…' : 'Last 10 years (Open-Meteo)'}
            </button>
            <button type="button" className="btn w-full" disabled={!online || !!busy} onClick={() => refresh('eccc')}>
              {busy === 'eccc' ? 'Fetching…' : 'Nearest ECCC climate normals'}
            </button>
            {!online && <p className="text-sm text-muted">You are offline. The bundled data works without this.</p>}
          </section>
          <PrintButton />
        </>
      )}
    </div>
  );
}
