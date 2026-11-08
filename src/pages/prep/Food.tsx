import { useMemo } from 'react';
import { calcFood, type FoodLine } from '../../calc/food';
import { durationLabel } from '../../calc/plan';
import { usePlan, useProfile } from '../../lib/store';
import { fmtMonths, fmtNum, fmtYears } from '../../lib/format';
import { BackLink, Badge, DataList, NeedsSetup, Stat, Warnings, type Col } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

const cols: Col<FoodLine>[] = [
  { key: 'name', label: 'Item', primary: true, render: (l) => l.name },
  { key: 'qty', label: 'Buy', render: (l) => (l.unitLabel === 'kg' ? `${fmtNum(l.kg, 1)} kg` : `${l.units} × ${l.unitLabel}${l.kg ? ` (${fmtNum(l.kg, 1)} kg)` : ''}`) },
  { key: 'pails', label: '20 L pails', render: (l) => (l.pails ? l.pails : '') },
  { key: 'kcal', label: 'kcal', render: (l) => (l.kcal ? fmtNum(l.kcal) : '') },
  { key: 'shelf', label: 'Shelf life', render: (l) => fmtYears(l.shelfLifeYears) },
  { key: 'rot', label: 'Rotate', render: (l) => fmtMonths(l.rotationMonths) },
  {
    key: 'flags',
    label: 'Flags',
    render: (l) => {
      const f = [
        l.flags.includes('fat') && <Badge key="f" tone="accent">Rotate fat</Badge>,
        l.flags.includes('canned') && <Badge key="c" tone="danger">No freeze</Badge>,
        l.needsRotation && !l.flags.includes('fat') && <Badge key="r">Rotate</Badge>,
      ].filter(Boolean);
      return f.length ? <span className="flex flex-wrap gap-1">{f}</span> : '';
    },
  },
  { key: 'notes', label: 'Notes', render: (l) => l.notes },
];

export function FoodPage() {
  const { plan } = usePlan();
  const { profile, climate } = useProfile();
  const r = useMemo(() => calcFood(plan, climate), [plan, climate]);

  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title={`Food storage — ${plan.people.length} people, ${durationLabel(plan)}`} />
      <h1 className="h1">Food</h1>
      {!profile && <NeedsSetup what="location" />}
      <p className="text-muted">
        {plan.people.length} people · {durationLabel(plan)} · {plan.budget} budget{plan.coldLabour ? ' · +25 % cold labour' : ''}
      </p>

      <section className="grid grid-cols-2 gap-2">
        <Stat label="kcal/day target" value={fmtNum(r.targetKcalPerDay)} />
        <Stat label="kcal/day stored" value={fmtNum(r.achievedKcalPerDay)} sub={`${fmtNum(r.achievedKcalPerPersonDay)} per person`} />
        <Stat label="20 L pails" value={r.totalPails} sub={`${fmtNum(r.totalKg)} kg total`} />
        <Stat label="Floor space" value={`${r.floorM2} m²`} sub={`you have ${plan.storageFloorM2} m²`} />
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Macro split</h2>
        <div className="flex h-8 overflow-hidden rounded border-2 border-line text-sm font-bold" aria-label={`Protein ${r.macros.proteinPct}%, fat ${r.macros.fatPct}%, carbohydrate ${r.macros.carbPct}%`}>
          <div className="flex items-center justify-center bg-accent text-accent-ink" style={{ width: `${r.macros.proteinPct}%` }}>P</div>
          <div className="flex items-center justify-center bg-ink text-bg" style={{ width: `${r.macros.fatPct}%` }}>F</div>
          <div className="flex items-center justify-center" style={{ width: `${r.macros.carbPct}%` }}>C</div>
        </div>
        <p>
          Protein {r.macros.proteinPct} % · Fat {r.macros.fatPct} % · Carbohydrate {r.macros.carbPct} %
        </p>
      </section>

      <Warnings items={r.warnings} />

      {r.categories.map((c) => (
        <section key={c.id} className="card space-y-2">
          <h2 className="h2">
            {c.label}
            {c.kcalShare > 0 && <span className="ml-2 text-base font-normal text-muted">{Math.round(c.kcalShare * 100)} % of calories</span>}
          </h2>
          <DataList rows={c.lines} cols={cols} rowKey={(l) => l.id} />
        </section>
      ))}

      <p className="text-sm text-muted">Quantities come from data/food-items.json and data/assumptions.json. Edit those files to change the mix.</p>
      <PrintButton />
    </div>
  );
}
