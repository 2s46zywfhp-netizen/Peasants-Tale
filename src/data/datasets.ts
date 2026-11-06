/** Loads every bundled JSON file in /data at build time, so all of it is available offline. */

export interface Dataset<R extends { id: string } = { id: string }> {
  dataset: string;
  version: string;
  updated: string;
  description?: string;
  records: R[];
}

const files = import.meta.glob<Dataset>('../../data/*.json', { eager: true, import: 'default' });

export const datasets: Record<string, Dataset> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [path.split('/').pop()!.replace(/\.json$/, ''), data]),
);

export function getDataset<R extends { id: string }>(name: string): Dataset<R> {
  const d = datasets[name];
  if (!d) throw new Error(`Missing bundled dataset "${name}"`);
  return d as unknown as Dataset<R>;
}

/** Returns a list of problems with a dataset file; empty means valid. */
export function validateDataset(fileName: string, d: unknown): string[] {
  const errs: string[] = [];
  if (!d || typeof d !== 'object') return [`${fileName}: not an object`];
  const o = d as Record<string, unknown>;
  if (o.dataset !== fileName) errs.push(`${fileName}: "dataset" should be "${fileName}"`);
  if (typeof o.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(o.version)) errs.push(`${fileName}: "version" must look like 1.0.0`);
  if (typeof o.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.updated)) errs.push(`${fileName}: "updated" must be YYYY-MM-DD`);
  if (!Array.isArray(o.records)) return [...errs, `${fileName}: "records" must be a list`];
  const seen = new Set<string>();
  o.records.forEach((r, i) => {
    const id = (r as { id?: unknown })?.id;
    if (typeof id !== 'string' || !id) errs.push(`${fileName}: record ${i} has no string "id"`);
    else if (seen.has(id)) errs.push(`${fileName}: duplicate id "${id}"`);
    else seen.add(id);
  });
  return errs;
}
