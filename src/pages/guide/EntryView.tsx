import { Link } from 'react-router-dom';
import { entryById, imageById, isEdible, type GuideEntry, type Lookalike } from '../../calc/guide';
import { monthName } from '../../lib/format';
import { Badge } from '../../components/ui';
import { UserPhotos } from '../../components/Photos';

const diagrams = import.meta.glob('../../../data/diagrams/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const diagramSvg = (name: string) => diagrams[`../../../data/diagrams/${name}.svg`];

export const EDIBILITY: Record<string, { label: string; tone: 'ok' | 'accent' | 'danger' | 'line' }> = {
  edible: { label: 'Edible when positively identified', tone: 'ok' },
  'edible-caution': { label: 'Edible with care — read prep', tone: 'accent' },
  medicinal: { label: 'Medicinal', tone: 'line' },
  toxic: { label: 'Toxic', tone: 'danger' },
  deadly: { label: 'DEADLY', tone: 'danger' },
};

export function PracticeBadge() {
  return <Badge tone="danger">Practice required</Badge>;
}

export function Figure({ id, compact }: { id: string; compact?: boolean }) {
  const img = imageById(id);
  if (!img) return null;
  return (
    <figure className="space-y-1">
      <img src={`${import.meta.env.BASE_URL}${img.file}`} alt={img.title} loading="lazy" className={`w-full rounded border-2 border-line object-cover ${compact ? 'aspect-square' : 'max-h-80'} print:max-h-48 print:w-auto`} />
      {!compact && (
        <figcaption className="text-xs text-muted">
          Photo: {img.author} ·{' '}
          <a className="underline" href={img.licenceUrl || img.sourceUrl} target="_blank" rel="noreferrer">
            {img.licence}
          </a>{' '}
          ·{' '}
          <a className="underline" href={img.sourceUrl} target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
        </figcaption>
      )}
    </figure>
  );
}

function LookalikeCard({ l }: { l: Lookalike }) {
  const target = l.id ? entryById(l.id) : undefined;
  const img = target?.images[0];
  const tone = l.danger === 'deadly' ? 'border-danger' : l.danger === 'toxic' ? 'border-accent' : 'border-line';
  return (
    <li className={`grid grid-cols-[5rem_1fr] gap-3 rounded-lg border-2 p-2 ${tone}`}>
      {img ? <Figure id={img} compact /> : <div className="aspect-square rounded border-2 border-dashed border-line" />}
      <div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-extrabold">{l.name}</span>
          <Badge tone={l.danger === 'harmless' ? 'line' : 'danger'}>{l.danger === 'deadly' ? 'DEADLY' : l.danger}</Badge>
        </div>
        <p className="text-sm">{l.howToTell}</p>
        {target && (
          <Link to={`/guide/e/${target.id}`} className="no-print text-sm font-bold text-accent">
            Full entry →
          </Link>
        )}
      </div>
    </li>
  );
}

export function EntryView({ e, print }: { e: GuideEntry; print?: boolean }) {
  const edible = isEdible(e);
  const ed = e.edibility ? EDIBILITY[e.edibility] : null;
  const look = [...(e.lookalikes ?? [])].sort((a, b) => ['deadly', 'toxic', 'harmless'].indexOf(a.danger) - ['deadly', 'toxic', 'harmless'].indexOf(b.danger));
  const svg = e.diagram ? diagramSvg(e.diagram) : undefined;
  return (
    <article className="space-y-4 print:break-inside-auto">
      <header>
        <h1 className="h1">{e.title}</h1>
        {e.latin && <p className="italic text-muted">{e.latin}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          {ed && <Badge tone={ed.tone}>{ed.label}</Badge>}
          {e.practiceRequired && <PracticeBadge />}
        </div>
      </header>

      {e.images.map((i) => (
        <Figure key={i} id={i} />
      ))}
      {(e.kind === 'plant' || e.kind === 'mushroom' || e.kind === 'hazard') && <p className="text-sm font-bold">Photos are for reference only. Identify with every feature below, never from a photo.</p>}

      {edible && look.length > 0 && (
        <section className="space-y-2 rounded-xl border-4 border-danger p-3">
          <h2 className="h2 text-danger">⚠ Dangerous lookalikes — check before eating</h2>
          <ul className="space-y-2">{look.map((l) => <LookalikeCard key={l.name} l={l} />)}</ul>
        </section>
      )}

      <p className="text-lg">{e.summary}</p>

      {e.idFeatures?.length ? (
        <section>
          <h2 className="h2">{e.kind === 'skill' || e.kind === 'reference' ? 'Signs' : 'Identification'}</h2>
          <ul className="list-disc space-y-1 pl-5">{e.idFeatures.map((f) => <li key={f}>{f}</li>)}</ul>
        </section>
      ) : null}

      {e.habitat && (
        <section>
          <h2 className="h2">Habitat</h2>
          <p>{e.habitat}</p>
        </section>
      )}

      {e.season?.length ? (
        <section>
          <h2 className="h2">Season</h2>
          <div className="flex flex-wrap gap-1" aria-label="Months">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <span key={m} className={`rounded border-2 px-1.5 text-sm font-bold ${e.season!.includes(m) ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}>
                {monthName(m)}
              </span>
            ))}
          </div>
          {e.seasonNote && <p className="mt-1 text-sm">{e.seasonNote}</p>}
        </section>
      ) : null}

      {e.prep && (
        <section>
          <h2 className="h2">Preparation</h2>
          <p>{e.prep}</p>
        </section>
      )}

      {e.steps?.length ? (
        <section>
          <h2 className="h2">{e.kind === 'reference' ? 'Key points' : 'How to'}</h2>
          <ol className="list-decimal space-y-2 pl-6">{e.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      ) : null}

      {e.table && (
        <section className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{e.table.columns.map((c) => <th key={c} className="border-2 border-line p-1 text-left">{c}</th>)}</tr>
            </thead>
            <tbody>
              {e.table.rows.map((r) => (
                <tr key={r.join()}>{r.map((c, i) => <td key={i} className="border-2 border-line p-1">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {svg && (
        <section>
          <h2 className="h2">Diagram</h2>
          <div className="rounded-lg border-2 border-line p-2 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`${e.title} diagram`} dangerouslySetInnerHTML={{ __html: svg }} />
        </section>
      )}

      {e.confusedWith?.length ? (
        <section>
          <h2 className="h2">Often mistaken for</h2>
          <p>{e.confusedWith.join(', ')}</p>
        </section>
      ) : null}

      {e.warnings?.length ? (
        <section className="rounded-lg border-2 border-danger p-3">
          <h2 className="h2 text-danger">Warnings</h2>
          <ul className="list-disc space-y-1 pl-5">{e.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      ) : null}

      {!edible && look.length > 0 && (
        <section>
          <h2 className="h2">Lookalikes</h2>
          <ul className="space-y-2">{look.map((l) => <LookalikeCard key={l.name} l={l} />)}</ul>
        </section>
      )}

      {e.related?.length ? (
        <section className="no-print">
          <h2 className="h2">Related</h2>
          <div className="flex flex-wrap gap-2">
            {e.related.map((r) => {
              const t = entryById(r);
              return t ? <Link key={r} to={`/guide/e/${r}`} className="btn">{t.title}</Link> : null;
            })}
          </div>
        </section>
      ) : null}

      {!print && <UserPhotos refKey={`guide:${e.id}`} />}
    </article>
  );
}
