import { useMemo } from 'react';
import { calcWater, type WaterLine } from '../../calc/water';
import { durationLabel } from '../../calc/plan';
import { usePlan, useProfile } from '../../lib/store';
import { fmtMonths, fmtNum, fmtYears } from '../../lib/format';
import { BackLink, DataList, NeedsSetup, Stat, Warnings, type Col } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

const cols: Col<WaterLine>[] = [
  { key: 'name', label: 'Item', primary: true, render: (l) => l.name },
  { key: 'qty', label: 'Quantity', render: (l) => `${fmtNum(l.qty, 1)} ${l.unit}` },
  { key: 'shelf', label: 'Shelf life', render: (l) => (l.shelfLifeYears ? fmtYears(l.shelfLifeYears) : '') },
  { key: 'rot', label: 'Rotate', render: (l) => (l.rotationMonths ? fmtMonths(l.rotationMonths) : '') },
  { key: 'notes', label: 'Notes', render: (l) => l.notes },
];

export function WaterPage() {
  const { plan } = usePlan();
  const { profile, climate } = useProfile();
  const r = useMemo(() => calcWater(plan, climate), [plan, climate]);
  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title={`Water — ${plan.people.length} people, ${durationLabel(plan)}`} />
      <h1 className="h1">Water</h1>
      {!profile && <NeedsSetup what="location" />}
      <section className="grid grid-cols-2 gap-2">
        <Stat label="L per day" value={fmtNum(r.totalLPerDay, 1)} sub={`people ${r.peopleLPerDay} · pets ${r.petsLPerDay}`} />
        <Stat label="Total need" value={`${fmtNum(r.totalL)} L`} sub={durationLabel(plan)} />
        <Stat label="Store" value={`${fmtNum(r.storedL)} L`} sub={`${r.containers} × 20 L jugs`} />
        <Stat label="Source & purify" value={`${fmtNum(r.purifyL)} L`} />
      </section>
      <p className="text-sm text-muted">Baseline 4 L per person per day: 2 L drinking, 2 L food prep and hygiene (Government of Canada).</p>
      <Warnings items={r.warnings} />
      <section className="card space-y-2">
        <h2 className="h2">Storage &amp; purification</h2>
        <DataList rows={r.lines} cols={cols} rowKey={(l) => l.id} />
      </section>
      <PrintButton />
    </div>
  );
}
