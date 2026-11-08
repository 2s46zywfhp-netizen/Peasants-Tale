import { guideImages } from '../calc/guide';
import { sources } from '../calc/ref';
import { BackLink } from '../components/ui';
import { PrintButton, PrintHeader } from '../components/PrintButton';

export function CreditsPage() {
  return (
    <div className="space-y-4">
      <BackLink to="/settings" label="Settings" />
      <PrintHeader title="Credits and sources" />
      <h1 className="h1">Credits &amp; sources</h1>
      <section className="card space-y-1">
        <h2 className="h2">Data sources</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {sources.map((s) => (
            <li key={s.id}>
              <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> — {s.publisher}
            </li>
          ))}
          <li>Maps: Canada Base Map – Transportation and Toporama, © Natural Resources Canada, Open Government Licence – Canada.</li>
          <li>Climate normals: Environment and Climate Change Canada, Open Government Licence – Canada.</li>
        </ul>
      </section>
      <section className="card space-y-2">
        <h2 className="h2">Field guide photos ({guideImages.length})</h2>
        <p className="text-sm text-muted">All from Wikimedia Commons under public-domain or Creative Commons licences.</p>
        <ul className="space-y-2 text-sm">
          {guideImages.map((i) => (
            <li key={i.id}>
              <b>{i.title}</b> — {i.author}. <a className="underline" href={i.licenceUrl || i.sourceUrl} target="_blank" rel="noreferrer">{i.licence}</a>.{' '}
              <a className="underline" href={i.sourceUrl} target="_blank" rel="noreferrer">Source</a>
            </li>
          ))}
        </ul>
      </section>
      <PrintButton />
    </div>
  );
}
