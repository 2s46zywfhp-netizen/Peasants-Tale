import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { BackupError, backupFileName, createBackup, parseBackup, restoreBackup, type RestoreMode } from '../db/backup';
import { setSetting } from '../db/settings';
import { downloadText } from '../lib/files';
import { THEMES, useTheme } from '../lib/theme';
import { getStorageStatus, requestPersistence, type StorageStatus } from '../lib/storage';
import { datasets } from '../data/datasets';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

export function Settings() {
  const { theme, setTheme } = useTheme();
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<RestoreMode>('replace');
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshStorage = () => getStorageStatus().then(setStorage);
  useEffect(() => {
    void refreshStorage();
  }, []);

  async function onExport() {
    setBusy(true);
    setMsg(null);
    try {
      const now = new Date();
      const file = await createBackup(db, now);
      downloadText(backupFileName(now), JSON.stringify(file, null, 1));
      await setSetting('lastBackupAt', now.toISOString());
      setMsg({ kind: 'ok', text: 'Backup file saved. Copy it to a USB stick or another device.' });
    } catch (e) {
      setMsg({ kind: 'err', text: `Backup failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function onImport(file: File) {
    setMsg(null);
    let parsed: unknown;
    try {
      parsed = parseBackup(JSON.parse(await file.text()));
    } catch (e) {
      const text = e instanceof BackupError ? e.message : 'File is not valid JSON.';
      setMsg({ kind: 'err', text });
      return;
    }
    const warning =
      mode === 'replace'
        ? 'Replace ALL data on this device with this backup? This cannot be undone.'
        : 'Merge this backup into your data? Matching entries will be overwritten.';
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      const { counts } = await restoreBackup(db, parsed, mode);
      const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
      setMsg({ kind: 'ok', text: `Restored ${total} records.` });
      const t = (await db.settings.get('theme'))?.value;
      if (t === 'light' || t === 'dark' || t === 'red') setTheme(t);
      void refreshStorage();
    } catch (e) {
      setMsg({ kind: 'err', text: `Restore failed, nothing was changed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="h1">Settings</h1>
      <Link to="/help" className="btn-primary w-full">How to use NorthPrep</Link>

      <section className="card space-y-3">
        <h2 className="h2">Display</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Display mode">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className={theme === t.id ? 'btn-primary' : 'btn'}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-muted">{THEMES.find((t) => t.id === theme)?.hint}</p>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Backup &amp; restore</h2>
        <p>Saves everything — settings, stock, journal and photos — to one file you own.</p>
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={onExport}>
          Save backup file
        </button>

        <fieldset className="space-y-2">
          <legend className="font-bold">When restoring</legend>
          <label className="flex min-h-tap items-center gap-3">
            <input type="radio" name="mode" className="h-6 w-6" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            Replace everything on this device
          </label>
          <label className="flex min-h-tap items-center gap-3">
            <input type="radio" name="mode" className="h-6 w-6" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            Merge with what's here
          </label>
        </fieldset>
        <label className="btn w-full cursor-pointer">
          Restore from file…
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
            }}
          />
        </label>
        {msg && (
          <p role="alert" className={`font-bold ${msg.kind === 'ok' ? 'text-ok' : 'text-danger'}`}>
            {msg.text}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Storage on this device</h2>
        <p>
          {storage?.persisted
            ? 'Protected: the browser will not clear NorthPrep data to free space.'
            : 'Not protected yet: the browser may clear data if the phone runs low on space.'}
        </p>
        {storage?.usageMB != null && (
          <p className="text-muted">
            Using {storage.usageMB} MB of {storage.quotaMB} MB available.
          </p>
        )}
        {!storage?.persisted && (
          <button
            type="button"
            className="btn w-full"
            onClick={async () => {
              const ok = await requestPersistence();
              setMsg(ok ? { kind: 'ok', text: 'Storage protected.' } : { kind: 'err', text: 'Browser declined. Installing the app to your home screen usually helps.' });
              void refreshStorage();
            }}
          >
            Protect my data
          </button>
        )}
      </section>

      <section className="card space-y-1">
        <h2 className="h2">Bundled reference data</h2>
        <ul className="text-muted">
          {Object.values(datasets).map((d) => (
            <li key={d.dataset}>
              {d.dataset} v{d.version} · {d.records.length} records · updated {d.updated}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-sm text-muted">App v{__APP_VERSION__} · <Link to="/credits" className="underline">Credits &amp; sources</Link></p>
      </section>
    </div>
  );
}
