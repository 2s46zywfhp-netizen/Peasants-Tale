import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { buildCalendar, entryById, guide, inMonth, isEdible, searchGuide, sections, type GuideEntry } from '../../calc/guide';
import { useProfile } from '../../lib/store';
import { monthName } from '../../lib/format';
import { BackLink, Badge } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';
import { EDIBILITY, EntryView, Figure, PracticeBadge } from './EntryView';

function EntryRow({ e }: { e: GuideEntry }) {
  const ed = e.edibility ? EDIBILITY[e.edibility] : null;
  return (
    <li>
      <Link to={`/guide/e/${e.id}`} className="grid min-h-tap grid-cols-[4rem_1fr] items-center gap-3 rounded-lg border-2 border-line p-2">
        {e.images[0] ? <Figure id={e.images[0]} compact /> : <div className="aspect-square rounded border-2 border-dashed border-line" />}
        <div>
          <div className="font-extrabold">{e.title}</div>
          <div className="text-sm text-muted">{e.summary.slice(0, 90)}{e.summary.length > 90 ? '…' : ''}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {ed && <Badge tone={ed.tone}>{e.edibility === 'deadly' ? 'DEADLY' : e.edibility === 'toxic' ? 'Toxic' : isEdible(e) ? 'Edible' : ed.label}</Badge>}
            {e.practiceRequired && <PracticeBadge />}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function GuideHome() {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchGuide(q), [q]);
  const mine = useLiveQuery(() => db.guideEntries.count(), []) ?? 0;
  return (
    <div className="space-y-4">
      <h1 className="h1">Field guide</h1>
      <p className="rounded-lg border-2 border-danger p-3 text-sm font-bold">
        Never eat a wild plant or mushroom based on a photo or this app alone. Every edible entry shows its dangerous lookalikes. When in doubt, don't.
      </p>
      <input className="field" type="search" placeholder="Search: cattail, frostbite, quinzhee…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the field guide" />
      {q && (
        <ul className="space-y-2">
          {results.map((e) => <EntryRow key={e.id} e={e} />)}
          {!results.length && <li className="text-muted">No matches.</li>}
        </ul>
      )}
      {!q && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/guide/calendar" className="btn-primary">Seasonal calendar</Link>
            <Link to="/guide/mine" className="btn">My entries ({mine})</Link>
            <Link to="/guide/import" className="btn">Import PDF</Link>
            <Link to="/guide/print/all" className="btn">Print whole guide</Link>
          </div>
          <ul className="grid gap-2">
            {sections.map((s) => {
              const n = guide.filter((e) => e.section === s.id).length;
              return (
                <li key={s.id}>
                  <Link to={`/guide/s/${s.id}`} className="card flex min-h-tap items-center justify-between">
                    <span className="h2">{s.label}</span>
                    <span className="text-muted">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function SectionPage() {
  const { id = '' } = useParams();
  const s = sections.find((x) => x.id === id);
  const entries = guide.filter((e) => e.section === id);
  const user = useLiveQuery(() => db.guideEntries.where('section').equals(id).toArray(), [id]) ?? [];
  if (!s) return <p>Unknown section.</p>;
  return (
    <div className="space-y-4">
      <BackLink to="/guide" label="Field guide" />
      <h1 className="h1">{s.label}</h1>
      <Link to={`/guide/print/${id}`} className="btn w-full">🖨 Print this section</Link>
      <ul className="space-y-2">{entries.map((e) => <EntryRow key={e.id} e={e} />)}</ul>
      {user.length > 0 && (
        <>
          <h2 className="h2">My entries</h2>
          <ul className="space-y-2">
            {user.map((u) => (
              <li key={u.id}>
                <Link to={`/guide/mine/${u.id}`} className="block rounded-lg border-2 border-line p-3 font-bold">{u.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function EntryPage() {
  const { id = '' } = useParams();
  const e = entryById(id);
  if (!e) return <p>Entry not found.</p>;
  const s = sections.find((x) => x.id === e.section)!;
  return (
    <div className="space-y-4">
      <BackLink to={`/guide/s/${s.id}`} label={s.label} />
      <PrintHeader title={`Field guide — ${s.label}`} />
      <EntryView e={e} />
      <PrintButton label="Print this entry" />
    </div>
  );
}

export function PrintGuide() {
  const { id = 'all' } = useParams();
  const list = id === 'all' ? guide : guide.filter((e) => e.section === id);
  const label = id === 'all' ? 'Complete field guide' : sections.find((s) => s.id === id)?.label ?? id;
  return (
    <div className="space-y-6">
      <BackLink to={id === 'all' ? '/guide' : `/guide/s/${id}`} label="Back" />
      <div className="no-print card space-y-2">
        <p>
          {list.length} entries ready to print ({label}). Choose "Save as PDF" in the print dialog for a paper backup. Each entry starts on a new page.
        </p>
        <PrintButton label="Print / save PDF" />
      </div>
      <PrintHeader title={`NorthPrep field guide — ${label}`} />
      {id === 'all' && (
        <section className="print-only">
          <h2 className="h2">Contents</h2>
          <ol className="list-decimal pl-6">
            {sections.map((s) => (
              <li key={s.id}>{s.label}: {guide.filter((e) => e.section === s.id).map((e) => e.title).join(', ')}</li>
            ))}
          </ol>
        </section>
      )}
      {list.map((e, i) => (
        <div key={e.id} className={i ? 'border-t-4 border-line pt-6' : ''} style={i ? { breakBefore: 'page' } : undefined}>
          <EntryView e={e} print />
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { forage: 'Foraging', mushroom: 'Mushrooms', hunt: 'Hunting & trapping', fish: 'Fishing', garden: 'Garden', task: 'Tasks', hazard: 'Hazards' };

export function CalendarPage() {
  const { climate } = useProfile();
  const rows = useMemo(() => buildCalendar(undefined, undefined, climate ? { last: climate.lastFrost, first: climate.firstFrost } : undefined), [climate]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const now = inMonth(rows, month);
  const kinds = Object.keys(KIND_LABEL).filter((k) => now.some((r) => r.kind === k));
  return (
    <div className="space-y-4">
      <BackLink to="/guide" label="Field guide" />
      <PrintHeader title="Seasonal calendar — Northern Ontario" />
      <h1 className="h1">Seasonal calendar</h1>
      <div className="no-print grid grid-cols-6 gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button key={m} type="button" className={m === month ? 'btn-primary px-1' : 'btn px-1'} onClick={() => setMonth(m)}>
            {monthName(m)}
          </button>
        ))}
      </div>
      <section className="no-print space-y-3">
        {kinds.map((k) => (
          <div key={k} className="card">
            <h2 className="h2">{KIND_LABEL[k]}</h2>
            <ul className="mt-1 space-y-1">
              {now.filter((r) => r.kind === k).map((r) => (
                <li key={r.label}>{r.link ? <Link className="font-bold underline" to={`/guide/e/${r.link}`}>{r.label}</Link> : r.label}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="overflow-x-auto">
        <h2 className="h2 mb-2">Whole year</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-line p-1 text-left">What</th>
              {Array.from({ length: 12 }, (_, i) => <th key={i} className="border border-line p-0.5">{monthName(i + 1)[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="border border-line p-1">{r.label}</td>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i} className={`border border-line ${r.months.includes(i + 1) ? (r.kind === 'hazard' ? 'bg-danger' : 'bg-accent') : ''}`}>
                    {r.months.includes(i + 1) ? <span className="hidden print:inline">●</span> : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-muted">Hunting and fishing seasons vary by management unit and change yearly. Check current Ontario regulations.</p>
      <PrintButton />
    </div>
  );
}
