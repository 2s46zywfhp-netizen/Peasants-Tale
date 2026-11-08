import { Link } from 'react-router-dom';
import { durationLabel } from '../../calc/plan';
import { usePlan, useProfile } from '../../lib/store';
import { fmtMmDd } from '../../lib/format';

export function PrepHub() {
  const { profile, climate } = useProfile();
  const { plan } = usePlan();
  const modules = [
    { to: '/prep/food', title: 'Food', body: 'Calories, macros, pails and shelf life' },
    { to: '/prep/water', title: 'Water', body: 'Storage, filters, tablets, boiling fuel' },
    { to: '/prep/seeds', title: 'Seeds & garden', body: 'What grows in your frost-free season' },
    { to: '/prep/supplies', title: 'Supplies', body: 'Firewood, clothing, shelter, first aid, tools' },
    ...(plan.huntingEnabled ? [{ to: '/prep/hunting', title: 'Hunting, fishing & defence', body: plan.collapseMode ? 'COLLAPSE MODE: ranked by survival use' : 'Ranked, with legal labels' }] : []),
  ];
  return (
    <div className="space-y-4">
      <h1 className="h1">Prep lists</h1>
      <Link to="/prep/location" className={`card block ${profile ? '' : 'border-accent'}`}>
        <h2 className="h2">Location</h2>
        {profile && climate ? (
          <p>
            Zone {climate.zone} · frost-free {climate.frostFreeDays} days ({fmtMmDd(climate.lastFrost)} – {fmtMmDd(climate.firstFrost)}) · low {climate.designLowC} °C
            <span className="block text-sm text-muted">Near {profile.townName}</span>
          </p>
        ) : (
          <p className="font-bold text-accent">Not set — tap to set with GPS or postal code</p>
        )}
      </Link>
      <Link to="/prep/household" className="card block">
        <h2 className="h2">Household &amp; plan</h2>
        <p>
          {plan.people.length} people{plan.pets.length ? `, ${plan.pets.length} pets` : ''} · {durationLabel(plan)} · {plan.budget}
        </p>
      </Link>
      <div className="grid gap-3">
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className="card block">
            <h2 className="h2">{m.title}</h2>
            <p className="text-muted">{m.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
