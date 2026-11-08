const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthName = (m: number) => MONTHS[(m - 1 + 12) % 12];

/** "05-17" -> "May 17" */
export function fmtMmDd(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  return `${monthName(m)} ${d}`;
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-CA', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtYears(y: number): string {
  if (y <= 0) return '—';
  if (y < 1) return `${Math.round(y * 12)} mo`;
  return `${fmtNum(y, 1)} yr`;
}

export function fmtMonths(m: number): string {
  if (!m) return 'none';
  return m % 12 === 0 ? `every ${m / 12} yr` : `every ${m} mo`;
}

export function fmtDate(d: Date): string {
  return `${monthName(d.getMonth() + 1)} ${d.getDate()}`;
}

export function snowMonthsText(ms: number[]): string {
  if (!ms.length) return 'none';
  // Show as a wrapped range starting in autumn, e.g. "Nov–Apr (6 months)".
  const order = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
  const sorted = order.filter((m) => ms.includes(m));
  return `${monthName(sorted[0])}–${monthName(sorted[sorted.length - 1])} (${ms.length} months)`;
}
