import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PrintButton, PrintHeader } from '../components/PrintButton';
import { useMemo } from 'react';
import { buildTargets } from '../calc/targets';
import { alerts, toIso } from '../calc/inventory';
import { usePlan, useProfile } from '../lib/store';

const MODULES = [
  { to: '/prep', title: 'Prep lists', body: 'Food, water, seeds, supplies, hunting and defence — scaled to your household and region.', phase: 0 },
  { to: '/stock', title: 'Stock & rotation', body: 'What you have vs. your targets, expiry dates, use-this-month list.', phase: 0 },
  { to: '/guide', title: 'Field guide', body: 'Foraging, lookalikes, water, fire, shelter, cold injuries, ice safety.', phase: 5 },
  { to: '/journal', title: 'Journal & map', body: 'Dated logs, photos, GPS pins for water, patches and caches.', phase: 6 },
];

export function Home() {
  const counts = useLiveQuery(async () => ({
    inventory: await db.inventory.count(),
    journal: await db.journal.count(),
    photos: await db.attachments.count(),
  }));
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackupAt'));
  const { plan } = usePlan();
  const { profile, climate } = useProfile();
  const items = useLiveQuery(() => db.inventory.toArray(), []);
  const due = useMemo(() => (items ? alerts(items, buildTargets(plan, climate), toIso(Date.now()), 30) : []), [items, plan, climate]);
  const last = lastBackup?.value as string | undefined;
  const daysSince = last ? Math.floor((Date.now() - Date.parse(last)) / 86400000) : null;

  return (
    <div className="space-y-4">
      <PrintHeader title="NorthPrep — Overview" />
      <section className="card">
        <h1 className="h1">Northern Ontario · Canadian Shield</h1>
        <p className="mt-1 text-muted">Everything here works with no signal. Your data stays on this device.</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Stock items" value={counts?.inventory} />
          <Stat label="Journal" value={counts?.journal} />
          <Stat label="Photos" value={counts?.photos} />
        </dl>
      </section>

      {!profile && (
        <Link to="/prep/location" className="card block border-accent">
          <h2 className="h2">Start here</h2>
          <p>Set your location (GPS or postal code), then your household. Every list adapts to them.</p>
        </Link>
      )}
      {due.length > 0 && (
        <Link to="/stock" className={`card block ${due.some((a) => a.kind === 'expired') ? 'border-danger' : 'border-accent'}`}>
          <h2 className="h2">Use this month: {due.length}</h2>
          <p>{due.slice(0, 3).map((a) => `${a.item.name} (${a.text.toLowerCase()})`).join(', ')}{due.length > 3 ? '…' : ''}</p>
        </Link>
      )}

      <section className={`card ${daysSince === null || daysSince > 30 ? 'border-accent' : ''}`}>
        <h2 className="h2">Backup</h2>
        <p className="mt-1">
          {daysSince === null ? 'No backup yet. ' : `Last backup ${daysSince === 0 ? 'today' : `${daysSince} day${daysSince === 1 ? '' : 's'} ago`}. `}
          Keep a copy off this phone.
        </p>
        <Link to="/settings" className="btn-primary no-print mt-3 w-full">
          Back up now
        </Link>
      </section>

      {MODULES.map((m) => (
        <Link key={m.to} to={m.to} className="card block">
          <h2 className="h2">{m.title}</h2>
          <p className="mt-1 text-muted">{m.body}</p>
        </Link>
      ))}

      <PrintButton />
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border-2 border-line p-2">
      <dd className="text-2xl font-extrabold">{value ?? '–'}</dd>
      <dt className="text-sm text-muted">{label}</dt>
    </div>
  );
}
