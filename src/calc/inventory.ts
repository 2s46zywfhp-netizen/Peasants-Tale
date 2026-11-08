/** Inventory maths: progress vs targets, expiry, FIFO and rotation alerts. Pure: "today" is passed in. */
import type { InventoryItem } from '../db/types';
import { GROUPS, type Target, type TargetGroup } from './targets';

const DAY = 86400000;
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY);

export function addMonths(iso: string, months: number): string {
  const d = new Date(parse(iso));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return toIso(d.getTime());
}

/** Printed date wins; otherwise acquired date + shelf life. */
export function effectiveExpiry(item: InventoryItem, target?: Target): { date: string; estimated: boolean } | null {
  if (item.expiresOn) return { date: item.expiresOn, estimated: false };
  if (item.acquiredOn && target && target.shelfLifeYears > 0) return { date: addMonths(item.acquiredOn, Math.round(target.shelfLifeYears * 12)), estimated: true };
  return null;
}

export function rotationDue(item: InventoryItem, target?: Target): string | null {
  if (!item.acquiredOn || !target || !target.rotationMonths) return null;
  return addMonths(item.acquiredOn, target.rotationMonths);
}

export interface TargetProgress { target: Target; onHand: number; pct: number; lots: InventoryItem[] }
export interface GroupProgress { group: TargetGroup; pct: number; complete: number; total: number; targets: TargetProgress[] }

export function progress(targets: Target[], items: InventoryItem[]): GroupProgress[] {
  const byTarget = new Map<string, InventoryItem[]>();
  for (const it of items) if (it.targetId) byTarget.set(it.targetId, [...(byTarget.get(it.targetId) ?? []), it]);
  return GROUPS.map((group) => {
    const tps = targets.filter((t) => t.group === group).map((t) => {
      const lots = byTarget.get(t.id) ?? [];
      const onHand = lots.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
      return { target: t, onHand, pct: t.qty > 0 ? Math.min(1, onHand / t.qty) : 1, lots };
    });
    const pct = tps.length ? tps.reduce((s, t) => s + t.pct, 0) / tps.length : 0;
    return { group, pct, complete: tps.filter((t) => t.pct >= 1).length, total: tps.length, targets: tps };
  }).filter((g) => g.total > 0);
}

export type AlertKind = 'expired' | 'expiring' | 'rotate';
export interface Alert { item: InventoryItem; kind: AlertKind; date: string; daysLeft: number; estimated: boolean; text: string }

/** Expired lots, lots expiring within `windowDays`, and lots due for rotation. Sorted soonest first. */
export function alerts(items: InventoryItem[], targets: Target[], today: string, windowDays = 30): Alert[] {
  const tmap = new Map(targets.map((t) => [t.id, t]));
  const out: Alert[] = [];
  for (const it of items) {
    if (!(Number(it.quantity) > 0)) continue;
    const t = it.targetId ? tmap.get(it.targetId) : undefined;
    const exp = effectiveExpiry(it, t);
    if (exp) {
      const left = daysBetween(today, exp.date);
      if (left < 0) out.push({ item: it, kind: 'expired', date: exp.date, daysLeft: left, estimated: exp.estimated, text: `Expired ${-left} days ago` });
      else if (left <= windowDays) out.push({ item: it, kind: 'expiring', date: exp.date, daysLeft: left, estimated: exp.estimated, text: left === 0 ? 'Expires today' : `Expires in ${left} days` });
      if (left <= windowDays) continue;
    }
    const rot = rotationDue(it, t);
    if (rot) {
      const left = daysBetween(today, rot);
      if (left <= windowDays) out.push({ item: it, kind: 'rotate', date: rot, daysLeft: left, estimated: true, text: left < 0 ? `Rotation overdue by ${-left} days` : `Rotate within ${left} days` });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** "Use this month": everything expiring or due for rotation in the next 30 days, plus expired lots. */
export function useThisMonth(items: InventoryItem[], targets: Target[], today: string): Alert[] {
  return alerts(items, targets, today, 30);
}

export interface FifoGroup { key: string; name: string; lots: { item: InventoryItem; expiry: string | null }[] }

/** For anything stocked in 2+ lots: order lots oldest-expiry first so the first one gets used first. */
export function fifoGroups(items: InventoryItem[], targets: Target[]): FifoGroup[] {
  const tmap = new Map(targets.map((t) => [t.id, t]));
  const groups = new Map<string, InventoryItem[]>();
  for (const it of items) {
    if (!(Number(it.quantity) > 0)) continue;
    const key = it.targetId ?? `name:${it.name.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const out: FifoGroup[] = [];
  for (const [key, lots] of groups) {
    if (lots.length < 2) continue;
    const t = tmap.get(key);
    const withExp = lots.map((item) => ({ item, expiry: effectiveExpiry(item, t)?.date ?? null }));
    withExp.sort((a, b) => (a.expiry ?? '9999') .localeCompare(b.expiry ?? '9999') || (a.item.acquiredOn ?? '').localeCompare(b.item.acquiredOn ?? ''));
    out.push({ key, name: t?.name ?? lots[0].name, lots: withExp });
  }
  return out;
}
