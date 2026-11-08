import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { InventoryItem } from '../db/types';
import { buildTargets, GROUPS, type Target } from '../calc/targets';
import { alerts, effectiveExpiry, fifoGroups, progress, toIso, type Alert } from '../calc/inventory';
import { usePlan, useProfile } from '../lib/store';
import { useOnline } from '../lib/useOnline';
import { fmtNum } from '../lib/format';
import { Badge, Field } from '../components/ui';
import { PrintButton, PrintHeader } from '../components/PrintButton';
import { BarcodeScanner, barcodeSupported, lookupBarcode } from '../components/BarcodeScanner';

const todayIso = () => toIso(Date.now() - new Date().getTimezoneOffset() * 60000);

function Bar({ pct, label }: { pct: number; label: string }) {
  const p = Math.round(pct * 100);
  return (
    <div>
      <div className="flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{p} %</span>
      </div>
      <div className="h-4 overflow-hidden rounded border-2 border-line" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${p >= 100 ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

interface Draft { id?: number; targetId: string; name: string; category: string; quantity: string; unit: string; acquiredOn: string; expiresOn: string; location: string; barcode: string; notes: string }
const emptyDraft = (): Draft => ({ targetId: '', name: '', category: 'Other', quantity: '1', unit: 'units', acquiredOn: todayIso(), expiresOn: '', location: '', barcode: '', notes: '' });

function ItemForm({ targets, initial, onDone }: { targets: Target[]; initial: Draft; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState('');
  const online = useOnline();
  const target = targets.find((t) => t.id === d.targetId);
  const est = target ? effectiveExpiry({ name: '', category: '', quantity: 1, unit: '', acquiredOn: d.acquiredOn, createdAt: '', updatedAt: '' }, target) : null;

  const pickTarget = (id: string) => {
    const t = targets.find((x) => x.id === id);
    setD({ ...d, targetId: id, name: t ? t.name : d.name, category: t ? t.group : 'Other', unit: t ? t.unit : d.unit });
  };
  const onCode = useCallback(async (code: string) => {
    setScan(false);
    setD((x) => ({ ...x, barcode: code }));
    setMsg(`Scanned ${code}. Looking up…`);
    const hit = await lookupBarcode(code);
    if (hit) {
      setD((x) => ({ ...x, name: x.targetId ? x.name : hit.name, notes: [x.notes, `${hit.name}${hit.detail ? ` (${hit.detail})` : ''}`].filter(Boolean).join(' — ') }));
      setMsg(`Found: ${hit.name}`);
    } else setMsg(`Scanned ${code}. Product not found; enter details by hand.`);
  }, []);

  const save = async () => {
    const qty = Number(d.quantity);
    if (!d.name.trim()) return setMsg('Enter a name.');
    if (!Number.isFinite(qty) || qty < 0) return setMsg('Enter a quantity.');
    const now = new Date().toISOString();
    const row: InventoryItem = {
      name: d.name.trim(), category: d.category, quantity: qty, unit: d.unit.trim() || 'units', targetId: d.targetId || undefined,
      acquiredOn: d.acquiredOn || undefined, expiresOn: d.expiresOn || undefined, location: d.location.trim() || undefined,
      barcode: d.barcode || undefined, notes: d.notes.trim() || undefined, createdAt: now, updatedAt: now,
    };
    if (d.id) {
      const old = await db.inventory.get(d.id);
      await db.inventory.put({ ...row, id: d.id, createdAt: old?.createdAt ?? now });
    } else await db.inventory.add(row);
    onDone();
  };

  return (
    <section className="card no-print space-y-3 border-accent">
      <h2 className="h2">{d.id ? 'Edit item' : 'Add to stock'}</h2>
      {barcodeSupported() && online && !scan && (
        <button type="button" className="btn w-full" onClick={() => setScan(true)}>
          Scan barcode (online)
        </button>
      )}
      {scan && <BarcodeScanner onCode={onCode} onClose={() => setScan(false)} />}
      <Field label="Counts toward" hint="Link to a list target to track progress. Choose 'Not on my lists' for anything else.">
        <select className="field" value={d.targetId} onChange={(e) => pickTarget(e.target.value)}>
          <option value="">Not on my lists</option>
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {targets.filter((t) => t.group === g).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({fmtNum(t.qty, 1)} {t.unit})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input className="field" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Quantity">
          <input className="field" inputMode="decimal" value={d.quantity} onChange={(e) => setD({ ...d, quantity: e.target.value })} />
        </Field>
        <Field label="Unit">
          <input className="field" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} disabled={!!target} />
        </Field>
        <Field label="Acquired">
          <input type="date" className="field" value={d.acquiredOn} onChange={(e) => setD({ ...d, acquiredOn: e.target.value })} />
        </Field>
        <Field label="Best before">
          <input type="date" className="field" value={d.expiresOn} onChange={(e) => setD({ ...d, expiresOn: e.target.value })} />
        </Field>
      </div>
      {!d.expiresOn && est && <p className="text-sm text-muted">No date entered: estimated {est.date} from typical shelf life.</p>}
      <Field label="Location">
        <input className="field" placeholder="e.g. basement shelf B" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
      </Field>
      <Field label="Notes">
        <input className="field" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
      {msg && <p role="status" className="font-bold">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={save}>
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
      {d.id && (
        <button
          type="button"
          className="btn-danger w-full"
          onClick={async () => {
            if (window.confirm(`Delete ${d.name}?`)) {
              await db.inventory.delete(d.id!);
              onDone();
            }
          }}
        >
          Delete
        </button>
      )}
    </section>
  );
}

function toDraft(i: InventoryItem): Draft {
  return { id: i.id, targetId: i.targetId ?? '', name: i.name, category: i.category, quantity: String(i.quantity), unit: i.unit, acquiredOn: i.acquiredOn ?? '', expiresOn: i.expiresOn ?? '', location: i.location ?? '', barcode: i.barcode ?? '', notes: i.notes ?? '' };
}

function AlertRow({ a, onEdit }: { a: Alert; onEdit: () => void }) {
  return (
    <li>
      <button type="button" className="flex min-h-tap w-full items-center gap-2 rounded-lg border-2 border-line p-2 text-left" onClick={onEdit}>
        <span className="flex-1">
          <span className="font-bold">{a.item.name}</span> · {fmtNum(a.item.quantity, 1)} {a.item.unit}
          {a.item.location && <span className="text-muted"> · {a.item.location}</span>}
          <span className="block text-sm">
            {a.text} ({a.date}
            {a.estimated ? ', estimated' : ''})
          </span>
        </span>
        {a.kind === 'expired' ? <Badge tone="danger">Expired</Badge> : a.kind === 'rotate' ? <Badge>Rotate</Badge> : <Badge tone="accent">Use</Badge>}
      </button>
    </li>
  );
}

export function StockPage() {
  const { plan } = usePlan();
  const { climate } = useProfile();
  const items = useLiveQuery(() => db.inventory.toArray(), []) ?? [];
  const targets = useMemo(() => buildTargets(plan, climate), [plan, climate]);
  const [form, setForm] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const prog = useMemo(() => progress(targets, items), [targets, items]);
  const month = useMemo(() => alerts(items, targets, today, 30), [items, targets, today]);
  const fifo = useMemo(() => fifoGroups(items, targets), [items, targets]);
  const targetIds = new Set(targets.map((t) => t.id));
  const other = items.filter((i) => !i.targetId || !targetIds.has(i.targetId));

  const edit = (i: InventoryItem) => {
    setForm(toDraft(i));
    window.scrollTo(0, 0);
  };

  return (
    <div className="space-y-4">
      <PrintHeader title="Stock on hand" />
      <h1 className="h1">Stock &amp; rotation</h1>
      {form ? (
        <ItemForm targets={targets} initial={form} onDone={() => setForm(null)} />
      ) : (
        <button type="button" className="btn-primary no-print w-full" onClick={() => setForm(emptyDraft())}>
          + Add to stock
        </button>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Progress vs your lists</h2>
        {prog.map((g) => (
          <Bar key={g.group} pct={g.pct} label={`${g.group} — ${g.complete}/${g.total} fully stocked`} />
        ))}
      </section>

      <section className={`card space-y-2 ${month.some((a) => a.kind === 'expired') ? 'border-danger' : ''}`}>
        <h2 className="h2">Use this month ({month.length})</h2>
        {month.length ? (
          <ul className="space-y-2">{month.map((a) => <AlertRow key={`${a.item.id}-${a.kind}`} a={a} onEdit={() => edit(a.item)} />)}</ul>
        ) : (
          <p className="text-muted">Nothing expires or needs rotating in the next 30 days.</p>
        )}
      </section>

      {fifo.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">First in, first out</h2>
          <ul className="space-y-2">
            {fifo.map((g) => (
              <li key={g.key}>
                <div className="font-bold">{g.name}</div>
                <ol className="list-decimal pl-6 text-sm">
                  {g.lots.map((l, i) => (
                    <li key={l.item.id}>
                      {i === 0 && <Badge tone="accent">Use first</Badge>} {fmtNum(l.item.quantity, 1)} {l.item.unit}
                      {l.item.location ? ` @ ${l.item.location}` : ''} — {l.expiry ? `expires ${l.expiry}` : 'no date'}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prog.map((g) => (
        <section key={g.group} className="card space-y-2">
          <button type="button" className="no-print flex min-h-tap w-full items-center justify-between text-left" onClick={() => setOpen(open === g.group ? null : g.group)} aria-expanded={open === g.group}>
            <h2 className="h2">{g.group}</h2>
            <span className="font-bold">{open === g.group ? '▲' : '▼'}</span>
          </button>
          <h2 className="h2 hidden print:block">{g.group}</h2>
          <ul className={`space-y-2 ${open === g.group ? '' : 'hidden print:block'}`}>
            {g.targets.map((t) => (
              <li key={t.target.id} className="rounded-lg border-2 border-line p-2">
                <Bar pct={t.pct} label={t.target.name} />
                <div className="text-sm text-muted">
                  {fmtNum(t.onHand, 1)} of {fmtNum(t.target.qty, 1)} {t.target.unit}
                </div>
                {t.lots.map((l) => (
                  <button key={l.id} type="button" className="mt-1 block w-full rounded border border-line px-2 py-1 text-left text-sm" onClick={() => edit(l)}>
                    {fmtNum(l.quantity, 1)} {l.unit}
                    {l.location ? ` @ ${l.location}` : ''}
                    {l.expiresOn ? ` · exp ${l.expiresOn}` : ''} ✎
                  </button>
                ))}
                <button
                  type="button"
                  className="no-print mt-1 text-sm font-bold text-accent"
                  onClick={() => {
                    setForm({ ...emptyDraft(), targetId: t.target.id, name: t.target.name, category: t.target.group, unit: t.target.unit, quantity: '' });
                    window.scrollTo(0, 0);
                  }}
                >
                  + add lot
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {other.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2">Other items ({other.length})</h2>
          <ul className="space-y-1">
            {other.map((i) => (
              <li key={i.id}>
                <button type="button" className="min-h-tap w-full rounded border-2 border-line p-2 text-left" onClick={() => edit(i)}>
                  <b>{i.name}</b> · {fmtNum(i.quantity, 1)} {i.unit}
                  {i.expiresOn ? ` · exp ${i.expiresOn}` : ''}
                  {i.targetId && !targetIds.has(i.targetId) && <span className="block text-sm text-muted">Was linked to a list item that your current plan no longer includes.</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <PrintButton />
    </div>
  );
}
