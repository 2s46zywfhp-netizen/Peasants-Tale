import { useMemo, useState } from 'react';
import { calcSeeds, type AnnualResult, type PerennialResult, type SeedStatus } from '../../calc/seeds';
import { useProfile } from '../../lib/store';
import { fmtMmDd, fmtNum } from '../../lib/format';
import { BackLink, Badge, Chips, NeedsSetup } from '../../components/ui';
import { PrintButton, PrintHeader } from '../../components/PrintButton';

const statusBadge = (s: SeedStatus) => (s === 'good' ? <Badge tone="ok">Good</Badge> : s === 'marginal' ? <Badge tone="accent">Marginal</Badge> : <Badge tone="danger">Skip</Badge>);
const sowLabel: Record<AnnualResult['sowing'], string> = { direct: 'Direct sow', indoors: 'Start indoors', tuber: 'Plant tubers', set: 'Plant sets', fall: 'Fall plant' };

function Annual({ r }: { r: AnnualResult }) {
  return (
    <li className="card space-y-1">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="font-extrabold">{r.seed.crop}</div>
          <div className="text-muted">'{r.seed.variety}'</div>
        </div>
        {statusBadge(r.status)}
      </div>
      <p className="text-sm">{r.reason}</p>
      <dl className="grid grid-cols-2 gap-x-3 text-sm">
        <dt className="text-muted">Method</dt>
        <dd className="font-bold">{sowLabel[r.sowing]}</dd>
        {r.indoorStart && (
          <>
            <dt className="text-muted">Start indoors</dt>
            <dd className="font-bold">{fmtMmDd(r.indoorStart)}</dd>
          </>
        )}
        <dt className="text-muted">{r.sowing === 'indoors' ? 'Transplant' : r.sowing === 'fall' ? 'Plant' : 'Sow / plant'}</dt>
        <dd className="font-bold">{fmtMmDd(r.plantOut)}</dd>
        <dt className="text-muted">Harvest from</dt>
        <dd>{fmtMmDd(r.harvest)}</dd>
        <dt className="text-muted">Days to maturity</dt>
        <dd>{r.seed.daysToMaturity}</dd>
        <dt className="text-muted">Yield / 10 m²</dt>
        <dd>
          {r.seed.yieldKgPer10m2} kg · {fmtNum(r.kcalPer10m2)} kcal
        </dd>
        <dt className="text-muted">Seed viability</dt>
        <dd>{r.seed.viabilityYears ? `${r.seed.viabilityYears} yr` : 'tubers/cloves'}</dd>
      </dl>
      <div className="flex flex-wrap gap-1">
        {r.seed.openPollinated && <Badge>Open-pollinated</Badge>}
        {r.seed.calorieCrop && <Badge tone="accent">Calorie crop</Badge>}
        {r.needsCover && <Badge tone="accent">Row cover</Badge>}
        <Badge>{r.seed.frostTolerance}</Badge>
      </div>
      {r.seed.notes && <p className="text-sm">{r.seed.notes}</p>}
      <p className="text-sm text-muted">
        <span className="font-bold">Seed saving:</span> {r.seed.seedSaving}
      </p>
    </li>
  );
}

function Perennial({ r }: { r: PerennialResult }) {
  const p = r.plant;
  return (
    <li className="card space-y-1">
      <div className="flex items-start gap-2">
        <div className="flex-1 font-extrabold">{p.name}</div>
        {statusBadge(r.status)}
      </div>
      <p className="text-sm">{r.reason}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt className="text-muted">Type</dt>
        <dd>{p.type}</dd>
        <dt className="text-muted">Hardy to</dt>
        <dd className="font-bold">Zone {p.minZone}</dd>
        <dt className="text-muted">Pollination</dt>
        <dd>
          {p.pollination}
          {p.pollinatorPartner && ` — ${p.pollinatorPartner}`}
        </dd>
        {p.rootstock && (
          <>
            <dt className="text-muted">Rootstock</dt>
            <dd>{p.rootstock}</dd>
          </>
        )}
        <dt className="text-muted">First crop</dt>
        <dd>year {p.yearsToBearing}</dd>
        <dt className="text-muted">Yield</dt>
        <dd>~{p.yieldKgPerPlant} kg per plant</dd>
      </dl>
      <p className="text-sm">{p.notes}</p>
    </li>
  );
}

type Tab = 'annual' | 'perennial' | 'skip' | 'cover';

export function SeedsPage() {
  const { profile, climate } = useProfile();
  const [tab, setTab] = useState<Tab>('annual');
  const plan = useMemo(() => (climate ? calcSeeds(climate) : null), [climate]);
  if (!profile || !climate || !plan) return (<div className="space-y-4"><BackLink /><h1 className="h1">Seeds &amp; garden</h1><NeedsSetup what="location" /></div>);
  const calories = plan.annuals.filter((r) => r.seed.calorieCrop && r.status === 'good');
  return (
    <div className="space-y-4">
      <BackLink />
      <PrintHeader title={`Seeds & garden — zone ${climate.zone}, ${climate.frostFreeDays} frost-free days`} />
      <h1 className="h1">Seeds &amp; garden</h1>
      <p>
        Zone <b>{climate.zone}</b> · last frost <b>{fmtMmDd(climate.lastFrost)}</b> · first frost <b>{fmtMmDd(climate.firstFrost)}</b> · <b>{climate.frostFreeDays}</b> frost-free days. Open-pollinated only, so you can save seed. Crops need 14 days of slack to count as good.
      </p>
      <div className="no-print">
        <Chips
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'annual', label: `Vegetables (${plan.annuals.length})` },
            { value: 'perennial', label: `Perennials (${plan.perennials.filter((p) => p.status !== 'skip').length})` },
            { value: 'skip', label: `Skip (${plan.skip.length})` },
            { value: 'cover', label: 'Frost protection' },
          ]}
        />
      </div>
      {(tab === 'annual') && calories.length > 0 && (
        <p className="card text-sm">
          <b>Best calorie crops for you:</b> {calories.map((r) => r.seed.crop).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.
        </p>
      )}
      <div className={tab === 'annual' ? '' : 'hidden print:block'}>
        <h2 className="h2 mb-2 hidden print:block">Vegetables and grains</h2>
        <ul className="space-y-3">{plan.annuals.map((r) => <Annual key={r.seed.id} r={r} />)}</ul>
      </div>
      <div className={tab === 'perennial' ? '' : 'hidden print:block'}>
        <h2 className="h2 mb-2 hidden print:block">Perennials, fruit and nuts</h2>
        <ul className="space-y-3">{plan.perennials.filter((p) => p.status !== 'skip').map((r) => <Perennial key={r.plant.id} r={r} />)}</ul>
      </div>
      <div className={tab === 'skip' ? '' : 'hidden print:block'}>
        <h2 className="h2 mb-2">Skip these in zone {climate.zone}</h2>
        <ul className="space-y-2">
          {plan.skip.map((s) => (
            <li key={s.name} className="rounded-lg border-2 border-line p-3">
              <div className="font-bold">{s.name}</div>
              <div className="text-sm text-muted">{s.reason}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className={tab === 'cover' ? '' : 'hidden print:block'}>
        <h2 className="h2 mb-2">Row cover &amp; frost protection</h2>
        <ul className="list-disc space-y-2 pl-5">{plan.coverRecommendations.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <PrintButton />
    </div>
  );
}
