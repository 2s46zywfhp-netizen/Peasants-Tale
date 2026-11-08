import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { UserGuideEntry } from '../../db/types';
import { sections } from '../../calc/guide';
import { splitIntoEntries, type DraftEntry, type PdfLine } from '../../calc/pdfImport';
import { downloadText } from '../../lib/files';
import { BackLink, Badge, Field, Select, Toggle } from '../../components/ui';
import { UserPhotos } from '../../components/Photos';
import { PrintButton, PrintHeader } from '../../components/PrintButton';
import { EDIBILITY, PracticeBadge } from './EntryView';

const now = () => new Date().toISOString();
const isEdibleVal = (v?: string) => v === 'edible' || v === 'edible-caution';
const sectionOpts = sections.map((s) => ({ value: s.id, label: s.label }));

/** Extracts positioned text lines from a PDF entirely on the device (pdf.js), no upload. */
async function readPdf(file: File, onProgress: (p: string) => void): Promise<PdfLine[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: PdfLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress(`Reading page ${p} of ${doc.numPages}…`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string; size: number }[]>();
    for (const it of tc.items as { str: string; transform: number[]; height: number }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const size = Math.abs(it.transform[3]) || it.height;
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) ?? []), { x: it.transform[4], s: it.str, size }]);
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, parts]) => {
        parts.sort((a, b) => a.x - b.x);
        lines.push({ text: parts.map((x) => x.s).join(' '), size: Math.max(...parts.map((x) => x.size)), page: p });
      });
  }
  return lines;
}

export function ImportPage() {
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const nav = useNavigate();
  const onFile = async (f: File) => {
    setBusy(true);
    setName(f.name);
    try {
      const lines = await readPdf(f, setMsg);
      const d = splitIntoEntries(lines);
      setDrafts(d);
      setMsg(d.length ? `Found ${d.length} sections. Review, then save.` : 'No headings found. If this is a scanned PDF (images only), text cannot be extracted; add entries by hand.');
    } catch (e) {
      setMsg(`Could not read PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const chosen = drafts.filter((d) => d.include);
    await db.guideEntries.bulkAdd(chosen.map((d) => ({ section: d.section, title: d.title, body: d.body, edibility: '', source: `${name}, p. ${d.page}`, createdAt: now(), updatedAt: now() })));
    nav('/guide/mine');
  };
  const set = (i: number, p: Partial<DraftEntry>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...p } : d)));
  return (
    <div className="space-y-4">
      <BackLink to="/guide" label="Field guide" />
      <h1 className="h1">Import from PDF</h1>
      <p>Reads your PDF on this phone (nothing is uploaded), splits it at headings into entries, and guesses a section for each. Review before saving. Imported entries are never marked edible automatically: set edibility and lookalikes yourself.</p>
      <label className="btn-primary w-full cursor-pointer">
        {busy ? 'Reading…' : 'Choose PDF'}
        <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {msg && <p role="status" className="font-bold">{msg}</p>}
      {drafts.length > 0 && (
        <>
          <ul className="space-y-3">
            {drafts.map((d, i) => (
              <li key={i} className={`card space-y-2 ${d.include ? '' : 'opacity-50'}`}>
                <Toggle checked={d.include} onChange={(v) => set(i, { include: v })} label={`Include (page ${d.page})`} />
                <input className="field font-bold" value={d.title} onChange={(e) => set(i, { title: e.target.value })} aria-label="Title" />
                <Select label="Section" value={d.section} onChange={(v) => set(i, { section: v })} options={sectionOpts} />
                <p className="max-h-32 overflow-y-auto whitespace-pre-line text-sm text-muted">{d.body}</p>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary w-full" onClick={save}>
            Save {drafts.filter((d) => d.include).length} entries
          </button>
        </>
      )}
    </div>
  );
}

export function MyEntries() {
  const list = useLiveQuery(() => db.guideEntries.orderBy('title').toArray(), []) ?? [];
  const exportJson = () => {
    const records = list.map((u) => ({ id: `user-${u.id}`, section: u.section, kind: 'reference', title: u.title, latin: u.latin, edibility: u.edibility || undefined, summary: u.body.split('\n')[0].slice(0, 200), steps: u.body.split('\n').slice(1).filter(Boolean), images: [], practiceRequired: u.practiceRequired, source: u.source }));
    downloadText('field-guide-user.json', JSON.stringify({ dataset: 'field-guide-user', version: '1.0.0', updated: new Date().toISOString().slice(0, 10), records }, null, 1));
  };
  return (
    <div className="space-y-4">
      <BackLink to="/guide" label="Field guide" />
      <h1 className="h1">My entries</h1>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/guide/mine/new" className="btn-primary">+ New entry</Link>
        <Link to="/guide/import" className="btn">Import PDF</Link>
      </div>
      <ul className="space-y-2">
        {list.map((u) => (
          <li key={u.id}>
            <Link to={`/guide/mine/${u.id}`} className="block rounded-lg border-2 border-line p-3">
              <span className="font-bold">{u.title}</span>
              <span className="block text-sm text-muted">{sections.find((s) => s.id === u.section)?.label}{u.source ? ` · ${u.source}` : ''}</span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="text-muted">None yet. Add your own notes or import your field guide PDF.</li>}
      </ul>
      {list.length > 0 && (
        <button type="button" className="btn w-full" onClick={exportJson}>
          Export as JSON (to merge into data files)
        </button>
      )}
    </div>
  );
}

export function UserEntryPage() {
  const { id = 'new' } = useParams();
  const nav = useNavigate();
  const existing = useLiveQuery(() => (id === 'new' ? undefined : db.guideEntries.get(Number(id))), [id]);
  const [editing, setEditing] = useState(id === 'new');
  const [d, setD] = useState<UserGuideEntry | null>(null);
  const [err, setErr] = useState('');
  const cur = d ?? existing ?? (id === 'new' ? { section: 'foraging', title: '', body: '', edibility: '', createdAt: now(), updatedAt: now() } : null);
  if (!cur) return <p>Loading…</p>;
  const set = (p: Partial<UserGuideEntry>) => setD({ ...cur, ...p });
  const save = async () => {
    if (!cur.title.trim()) return setErr('Enter a title.');
    if (isEdibleVal(cur.edibility) && !cur.lookalikesText?.trim()) return setErr('Safety rule: an edible entry must list its dangerous lookalikes and how to tell them apart.');
    const row = { ...cur, updatedAt: now() };
    const newId = await db.guideEntries.put(row);
    setD(null);
    setEditing(false);
    if (id === 'new') nav(`/guide/mine/${newId}`, { replace: true });
  };
  if (editing) {
    return (
      <div className="space-y-4">
        <BackLink to="/guide/mine" label="My entries" />
        <h1 className="h1">{id === 'new' ? 'New entry' : 'Edit entry'}</h1>
        <Field label="Title"><input className="field" value={cur.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Latin name (optional)"><input className="field" value={cur.latin ?? ''} onChange={(e) => set({ latin: e.target.value })} /></Field>
        <Field label="Section"><Select label="Section" value={cur.section} onChange={(v) => set({ section: v })} options={sectionOpts} /></Field>
        <Field label="Edibility">
          <Select label="Edibility" value={(cur.edibility ?? '') as string} onChange={(v) => set({ edibility: v as UserGuideEntry['edibility'] })} options={[{ value: '', label: 'Not applicable' }, ...Object.entries(EDIBILITY).map(([value, x]) => ({ value, label: x.label }))]} />
        </Field>
        {isEdibleVal(cur.edibility) && (
          <Field label="Dangerous lookalikes (required)" hint="Name each lookalike and exactly how to tell it apart.">
            <textarea className="field min-h-[6rem] py-2" value={cur.lookalikesText ?? ''} onChange={(e) => set({ lookalikesText: e.target.value })} />
          </Field>
        )}
        <Field label="Text" hint="One step or paragraph per line."><textarea className="field min-h-[12rem] py-2" value={cur.body} onChange={(e) => set({ body: e.target.value })} /></Field>
        <Toggle checked={!!cur.practiceRequired} onChange={(v) => set({ practiceRequired: v })} label="Practice required" hint="Hands-on skill (tourniquet, splinting, fire by friction, firearm handling…)" />
        {err && <p role="alert" className="font-bold text-danger">{err}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" onClick={save}>Save</button>
          <button type="button" className="btn" onClick={() => (id === 'new' ? nav('/guide/mine') : (setD(null), setEditing(false)))}>Cancel</button>
        </div>
        {id !== 'new' && (
          <button type="button" className="btn-danger w-full" onClick={async () => { if (window.confirm('Delete this entry?')) { await db.guideEntries.delete(Number(id)); nav('/guide/mine'); } }}>
            Delete
          </button>
        )}
      </div>
    );
  }
  const ed = cur.edibility ? EDIBILITY[cur.edibility] : null;
  return (
    <div className="space-y-4">
      <BackLink to="/guide/mine" label="My entries" />
      <PrintHeader title="Field guide — my entry" />
      <h1 className="h1">{cur.title}</h1>
      {cur.latin && <p className="italic text-muted">{cur.latin}</p>}
      <div className="flex flex-wrap gap-1">{ed && <Badge tone={ed.tone}>{ed.label}</Badge>}{cur.practiceRequired && <PracticeBadge />}</div>
      {isEdibleVal(cur.edibility) && (
        <section className="rounded-xl border-4 border-danger p-3">
          <h2 className="h2 text-danger">⚠ Dangerous lookalikes — check before eating</h2>
          <p className="whitespace-pre-line">{cur.lookalikesText}</p>
        </section>
      )}
      <div className="space-y-2">{cur.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
      {cur.source && <p className="text-sm text-muted">Source: {cur.source}</p>}
      <UserPhotos refKey={`guide-user:${id}`} />
      <button type="button" className="btn no-print w-full" onClick={() => setEditing(true)}>Edit</button>
      <PrintButton />
    </div>
  );
}
