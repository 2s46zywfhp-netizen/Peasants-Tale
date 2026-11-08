import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Warning } from '../calc/plan';

export function Warnings({ items }: { items: Warning[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2" aria-label="Warnings">
      {items.map((w, i) => (
        <li
          key={i}
          className={`rounded-lg border-2 p-3 ${w.level === 'danger' ? 'border-danger font-bold text-danger' : w.level === 'warn' ? 'border-accent' : 'border-line'}`}
        >
          <span className="mr-1 font-extrabold">{w.level === 'danger' ? '⚠ DANGER:' : w.level === 'warn' ? '⚠' : 'ℹ'}</span>
          {w.text}
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-line p-2 text-center">
      <div className="text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-sm text-muted">{label}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'line' }: { children: ReactNode; tone?: 'line' | 'accent' | 'danger' | 'ok' }) {
  const cls = { line: 'border-line', accent: 'border-accent text-accent', danger: 'border-danger text-danger', ok: 'border-ok text-ok' }[tone];
  return <span className={`inline-block whitespace-nowrap rounded border-2 px-1.5 text-xs font-extrabold uppercase ${cls}`}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <select className="field" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'btn-primary' : 'btn'} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-tap cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" className="mt-1 h-7 w-7" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function NumberInput({ value, onChange, min, max, step, label, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label: string; suffix?: string }) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        className="field"
        aria-label={label}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
        }}
      />
      {suffix && <span className="whitespace-nowrap text-muted">{suffix}</span>}
    </span>
  );
}

export function BackLink({ to = '/prep', label = 'Prep' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="no-print inline-flex min-h-tap items-center font-bold text-accent">
      ← {label}
    </Link>
  );
}

export function NeedsSetup({ what }: { what: 'location' | 'household' }) {
  return (
    <div className="card border-accent">
      <p className="font-bold">{what === 'location' ? 'Set your location first so lists match your climate.' : 'Set up your household first.'}</p>
      <Link className="btn-primary mt-3 w-full" to={what === 'location' ? '/prep/location' : '/prep/household'}>
        {what === 'location' ? 'Set location' : 'Set household'}
      </Link>
    </div>
  );
}

/** Screen: stacked cards. Paper: compact table with the same columns. */
export interface Col<T> { key: string; label: string; render: (row: T) => ReactNode; primary?: boolean; printOnly?: boolean }
export function DataList<T>({ rows, cols, rowKey, empty }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; empty?: string }) {
  if (!rows.length) return <p className="text-muted">{empty ?? 'Nothing here.'}</p>;
  const primary = cols.find((c) => c.primary) ?? cols[0];
  const rest = cols.filter((c) => c !== primary && !c.printOnly);
  return (
    <>
      <ul className="space-y-2 print:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border-2 border-line p-3">
            <div className="font-bold">{primary.render(r)}</div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              {rest.map((c) => {
                const v = c.render(r);
                if (v === null || v === undefined || v === '') return null;
                return (
                  <div key={c.key} className="contents">
                    <dt className="text-muted">{c.label}</dt>
                    <dd>{v}</dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>
      <table className="hidden text-sm print:table">
        <thead>
          <tr>
            <th className="w-6">✓</th>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              <td>☐</td>
              {cols.map((c) => (
                <td key={c.key}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
