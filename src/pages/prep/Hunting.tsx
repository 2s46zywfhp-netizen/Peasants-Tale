import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { calcAmmo, CATEGORIES, filterByRole, rankItems, ROLES, STATUS_LABEL } from '../../calc/hunting';
import { ammoRoles, harvestNotes, huntingItems, sources, type HuntingItem, type LegalStatus } from '../../calc/ref';
import { durationLabel } from '../../calc/plan';
import { savePlan, usePlan } from '../../lib/store';
import { fmtNum } from '../../lib/format';
import { BackLink, Badge, Select, Toggle } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';
import { PracticeBadge } from './Supplies';

type LegalOverride = Partial<HuntingItem['legal']>;
const STATUS_TONE: Record<LegalStatus, 'ok' | 'line' | 'accent' | 'danger'> = { legal: 'ok', 'licence-to-use': 'line', pal: 'line', rpal: 'accent', prohibited: 'danger' };
const PRACTICE_CATS = ['firearm', 'airgun', 'archery', 'trapping'];
const Dots = ({ n, max = 5 }: { n?: number; max?: number }) => (n ? <span aria-label={`${n} of ${max}`}>{'●'.repeat(n)}{'○'.repeat(max - n)}</span> : null);

function LegalEditor({ item, onDone }: { item: HuntingItem; onDone: () => void }) {
  const [d, setD] = useState(item.legal);
  const save = async (patch: LegalOverride) => {
    const cur = ((await db.settings.get('legalOverrides'))?.value ?? {}) as Record<string, LegalOverride>;
    await db.settings.put({ key: 'legalOverrides', value: { ...cur, [item.id]: { ...d, ...patch } } });
    onDone();
  };
  const reset = async () => {
    const cur = { ...(((await db.settings.get('legalOverrides'))?.value ?? {}) as Record<string, LegalOverride>) };
    delete cur[item.id];
    await db.settings.put({ key: 'legalOverrides', value: cur });
    onDone();
  };
  return (
    <div className="no-print space-y-2 rounded-lg border-2 border-accent p-3">
      <Select label="Legal status" value={d.status} onChange={(v) => setD({ ...d, status: v })} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value: value as LegalStatus, label }))} />
      <Toggle checked={d.acquirableNow} onChange={(v) => setD({ ...d, acquirableNow: v })} label="Can be legally acquired now" />
      <textarea className="field min-h-[6rem] py-2" aria-label="Consequence" value={d.consequence} onChange={(e) => setD({ ...d, consequence: e.target.value })} />
      <textarea className="field py-2" aria-label="Note" placeholder="Note" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" onClick={() => save({ lastVerified: new Date().toISOString().slice(0, 10) })}>
          Save + verified today
        </button>
        <button type="button" className="btn" onClick={() => save({})}>
          Save
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset to bundled
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ItemCard({ item, rank, collapse }: { item: HuntingItem; rank: number; collapse: boolean }) {
  const [editing, setEditing] = useState(false);
  const L = item.legal;
  return (
    <li className="card space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xl font-extrabold text-muted">#{rank}</span>
        <div className="flex-1">
          <div className="font-extrabold">{item.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={STATUS_TONE[L.status]}>{STATUS_LABEL[L.status]}</Badge>
            {L.useLicence && <Badge>{L.useLicence} licence to use</Badge>}
            {!L.acquirableNow && <Badge tone="danger">Can't acquire now</Badge>}
            {PRACTICE_CATS.includes(item.category) && <PracticeBadge />}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold">{item.utility}</div>
          <div className="text-xs text-muted">utility</div>
        </div>
      </div>
      <p className="text-sm">{item.description}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt className="text-muted">Roles</dt>
        <dd>{item.roles.map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(', ')}</dd>
        {item.cartridge && (<><dt className="text-muted">Cartridge</dt><dd>{item.cartridge}</dd></>)}
        {item.effectiveRangeM && (<><dt className="text-muted">Effective range</dt><dd>~{item.effectiveRangeM} m</dd></>)}
        {item.ammoAvailability && (<><dt className="text-muted">Ammo in N. Ontario</dt><dd><Dots n={item.ammoAvailability} /></dd></>)}
        {item.weightKg && (<><dt className="text-muted">Weight</dt><dd>{item.weightKg} kg</dd></>)}
        {item.coldReliability && (<><dt className="text-muted">Cold (−30 °C)</dt><dd><Dots n={item.coldReliability} /> {item.coldNote}</dd></>)}
        {item.maintenance && (<><dt className="text-muted">Maintenance</dt><dd>{item.maintenance}</dd></>)}
      </dl>
      <div className="rounded border-2 border-line p-2 text-sm">
        <div className="font-bold">Legal: {STATUS_LABEL[L.status]}</div>
        <p>{L.consequence}</p>
        {L.note && <p className="mt-1">{L.note}</p>}
        <p className="mt-1 text-muted">
          {L.sources.map((id) => sources.find((s) => s.id === id)).filter(Boolean).map((s) => (
            <a key={s!.id} href={s!.url} target="_blank" rel="noreferrer" className="mr-2 underline">
              {s!.publisher}
            </a>
          ))}
          · {L.lastVerified ? `Verified ${L.lastVerified}` : <b className="text-accent">Not verified — check before acting</b>}
        </p>
        {!editing && (
          <button type="button" className="btn no-print mt-2 text-sm" onClick={() => setEditing(true)}>
            Edit legal label
          </button>
        )}
      </div>
      {editing && <LegalEditor item={item} onDone={() => setEditing(false)} />}
      {collapse && item.sustainability && (
        <p className="rounded border-2 border-accent p-2 text-sm">
          <b>Sustainability:</b> {item.sustainability}
        </p>
      )}
    </li>
  );
}

export function HuntingPage() {
  const { plan } = usePlan();
  const overrides = useLiveQuery(() => db.settings.get('legalOverrides'), [])?.value as Record<string, LegalOverride> | undefined;
  const [role, setRole] = useState<string | null>(null);
  const [cat, setCat] = useState<string>('firearm');
  const items = useMemo(() => huntingItems.map((i) => (overrides?.[i.id] ? { ...i, legal: { ...i.legal, ...overrides[i.id] } } : i)), [overrides]);
  const ranked = useMemo(() => rankItems(filterByRole(items, role), plan.collapseMode), [items, role, plan.collapseMode]);
  const ammo = calcAmmo(plan);
  const shown = ranked.filter((i) => i.category === cat);

  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title={`Hunting, fishing & defence${plan.collapseMode ? ' — COLLAPSE MODE' : ''}`} />
      <h1 className="h1">Hunting, fishing &amp; defence</h1>

      <section className={`card ${plan.collapseMode ? 'border-danger' : ''}`}>
        <Toggle
          checked={plan.collapseMode}
          onChange={(v) => void savePlan({ ...plan, collapseMode: v })}
          label={plan.collapseMode ? 'COLLAPSE MODE ON' : 'Collapse Mode'}
          hint={
            plan.collapseMode
              ? 'Ranked by survival use only. Legal class, seasons and bag limits are ignored for ranking, never hidden. Sustainability notes are shown.'
              : 'Off: items you can legally acquire now rank first. Everything else is still listed, with its legal label.'
          }
        />
      </section>

      <p className="rounded-lg border-2 border-accent p-3 text-sm">
        Legal labels were compiled for this app and are <b>not verified</b>. Canadian firearm classes change by Order in Council, and Ontario rules change every year. Check the RCMP Firearms Reference Table and current Ontario regulations, then mark each item verified.
      </p>

      <div className="no-print space-y-2">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'btn-primary' : 'btn'} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <Select label="Filter by role" value={role ?? ''} onChange={(v) => setRole(v || null)} options={[{ value: '', label: 'All roles' }, ...ROLES.map((r) => ({ value: r.id, label: r.label }))]} />
      </div>

      <ul className="space-y-3 print:hidden">
        {shown.map((i) => (
          <ItemCard key={i.id} item={i} rank={ranked.indexOf(i) + 1} collapse={plan.collapseMode} />
        ))}
        {!shown.length && <li className="text-muted">Nothing in this category for that role.</li>}
      </ul>
      <div className="hidden print:block">
        {CATEGORIES.map((c) => (
          <section key={c.id}>
            <h2 className="h2 mt-4">{c.label}</h2>
            <table className="text-sm">
              <thead>
                <tr><th>#</th><th>Item</th><th>Utility</th><th>Legal</th><th>Details</th></tr>
              </thead>
              <tbody>
                {ranked.filter((i) => i.category === c.id).map((i) => (
                  <tr key={i.id}>
                    <td>{ranked.indexOf(i) + 1}</td>
                    <td>{i.name}</td>
                    <td>{i.utility}</td>
                    <td>{STATUS_LABEL[i.legal.status]}{i.legal.lastVerified ? ` (verified ${i.legal.lastVerified})` : ' (unverified)'}</td>
                    <td>{[i.cartridge, i.effectiveRangeM && `${i.effectiveRangeM} m`, plan.collapseMode && i.sustainability].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <section className="card space-y-2">
        <h2 className="h2">Ammunition plan ({durationLabel(plan)})</h2>
        <div className="no-print">
          {ammoRoles.map((r) => (
            <Toggle
              key={r.id}
              checked={plan.huntingRoles.includes(r.id)}
              onChange={(v) => void savePlan({ ...plan, huntingRoles: v ? [...plan.huntingRoles, r.id] : plan.huntingRoles.filter((x) => x !== r.id) })}
              label={r.label}
              hint={r.cartridge}
            />
          ))}
        </div>
        <ul className="space-y-2">
          {ammo.map((a) => (
            <li key={a.role} className="rounded-lg border-2 border-line p-3">
              <div className="font-bold">{a.label}</div>
              <div>
                {fmtNum(a.rounds)} rounds of {a.cartridge} ({a.packs} × {a.packSize})
              </div>
              <div className="text-sm text-muted">Shelf life {a.shelfLifeYears}+ years in sealed ammo cans with desiccant, cool and dry.</div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Canadian law: store firearms unloaded and locked, ammunition separate or locked. Magazine limits: 5 rounds for most centrefire semi-auto long guns, 10 for handguns.</p>
      </section>

      {plan.collapseMode && (
        <section className="card space-y-2 border-accent">
          <h2 className="h2">Harvest sustainability</h2>
          <p className="text-sm">Overharvest in year one starves you in year two.</p>
          <ul className="space-y-2">
            {harvestNotes.map((h) => (
              <li key={h.id}>
                <b>{h.species}:</b> {h.note}
              </li>
            ))}
          </ul>
        </section>
      )}
      <PrintButton />
    </div>
  );
}
