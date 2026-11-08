import { useMemo } from 'react';
import { calcSupplies, type SupplyLine } from '../../calc/supplies';
import { durationLabel } from '../../calc/plan';
import { usePlan, useProfile } from '../../lib/store';
import { fmtMonths, fmtNum, fmtYears } from '../../lib/format';
import { BackLink, Badge, DataList, NeedsSetup, Stat, Warnings, type Col } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

export const PracticeBadge = () => <Badge tone="danger">Practice required</Badge>;

const cols: Col<SupplyLine>[] = [
  {
    key: 'name', label: 'Item', primary: true,
    render: (l) => (
      <span>
        {l.name}{' '}
        <span className="inline-flex flex-wrap gap-1 align-middle">
          {l.priority === 1 && <Badge tone="accent">Essential</Badge>}
          {l.practiceRequired && <PracticeBadge />}
        </span>
      </span>
    ),
  },
  { key: 'qty', label: 'Quantity', render: (l) => `${fmtNum(l.qty, 1)} ${l.unit}` },
  { key: 'shelf', label: 'Shelf life', render: (l) => (l.shelfLifeYears ? fmtYears(l.shelfLifeYears) : '') },
  { key: 'rot', label: 'Rotate', render: (l) => (l.rotationMonths ? fmtMonths(l.rotationMonths) : '') },
  { key: 'notes', label: 'Notes', render: (l) => l.notes },
];

const LABELS: Record<string, string> = { heating: 'Heating & firewood', clothing: 'Cold-weather clothing', shelter: 'Shelter & sleep', fire: 'Fire', lighting: 'Lighting & power', 'first aid': 'First aid / TCCC', comms: 'Comms & navigation', tools: 'Tools', hygiene: 'Hygiene', sanitation: 'Sanitation' };

export function SuppliesPage() {
  const { plan } = usePlan();
  const { profile, climate } = useProfile();
  const r = useMemo(() => calcSupplies(plan, climate), [plan, climate]);
  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title={`Supplies — ${plan.people.length} people, ${durationLabel(plan)}`} />
      <h1 className="h1">Supplies</h1>
      {!profile && <NeedsSetup what="location" />}
      {r.heating && (
        <section className="grid grid-cols-2 gap-2">
          <Stat label={`${r.heating.unit === 'cord' ? 'Cords' : r.heating.unit} per winter`} value={fmtNum(r.heating.perWinter, 1)} sub={r.heating.fuelName} />
          <Stat label={`For ${durationLabel(plan)}`} value={fmtNum(r.heating.forPlan, 1)} sub={r.heating.unit === 'cord' ? 'cords' : r.heating.unit} />
        </section>
      )}
      <Warnings items={r.warnings} />
      {r.categories.map((g) => (
        <section key={g.id} className="card space-y-2">
          <h2 className="h2">{LABELS[g.id] ?? g.id}</h2>
          <DataList rows={g.lines} cols={cols} rowKey={(l) => l.id} />
        </section>
      ))}
      <PrintButton />
    </div>
  );
}
