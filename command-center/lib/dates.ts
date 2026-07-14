// All date math is local-time. Dates from Postgres arrive as 'YYYY-MM-DD'.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(dateStr: string): number {
  const now = parseLocal(todayStr());
  return Math.round((parseLocal(dateStr).getTime() - now.getTime()) / 86400000);
}

export function daysSince(dateStr: string): number {
  return -daysUntil(dateStr);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtShort(dateStr: string): string {
  const d = parseLocal(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtHeading(dateStr: string): string {
  const d = parseLocal(dateStr);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}
