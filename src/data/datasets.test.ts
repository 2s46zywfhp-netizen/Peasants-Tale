import { describe, expect, it } from 'vitest';
import { datasets, getDataset, validateDataset } from './datasets';

describe('bundled reference data', () => {
  it('loads at least the sources dataset', () => {
    expect(getDataset('sources').records.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(datasets))('%s.json is valid', (name, d) => {
    expect(validateDataset(name, d)).toEqual([]);
  });

  it('catches common mistakes', () => {
    const errs = validateDataset('x', { dataset: 'y', version: '1', updated: 'today', records: [{ id: 'a' }, { id: 'a' }, {}] });
    expect(errs.join('\n')).toMatch(/should be "x"/);
    expect(errs.join('\n')).toMatch(/version/);
    expect(errs.join('\n')).toMatch(/updated/);
    expect(errs.join('\n')).toMatch(/duplicate id "a"/);
    expect(errs.join('\n')).toMatch(/record 2 has no string "id"/);
  });
});
