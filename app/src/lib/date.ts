export const pad2 = (n: number) => String(n).padStart(2, '0');

export function dateToStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const todayStr = () => dateToStr(new Date());

export function addDaysStr(str: string, delta: number) {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dateToStr(dt);
}

export function formatDateLabel(str: string) {
  const today = todayStr();
  if (str === today) return 'Today';
  if (str === addDaysStr(today, 1)) return 'Tomorrow';
  if (str === addDaysStr(today, -1)) return 'Yesterday';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** 'YYYY-MM-DD' -> 'Mon 1 Sep' */
export function formatDayShort(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** 'HH:MM' -> minutes since midnight, NaN when malformed. */
export function minutesOf(hhmm: string) {
  if (typeof hhmm !== 'string') return NaN;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** 'HH:MM' for right now. */
export function nowTimeStr() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Adds minutes to an 'HH:MM', wrapping around midnight. */
export function addMinutesStr(hhmm: string, delta: number) {
  const m = minutesOf(hhmm);
  if (!Number.isFinite(m)) return hhmm;
  const next = (((m + delta) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(next / 60))}:${pad2(next % 60)}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * A block's end measured from the midnight its own day began at. An end at or
 * before the start means the block runs past midnight (11pm-7am sleep), so it
 * counts as 1860 rather than 420 and every duration, gap and progress figure
 * comes out right without a special case at each call site.
 */
export function endMinutesOf(block: { start: string; end: string }) {
  const s = minutesOf(block.start);
  const e = minutesOf(block.end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return NaN;
  return e <= s ? e + 1440 : e;
}

/** True when a block's end time lands on the day after it started. */
export function isOvernight(block: { start: string; end: string }) {
  const s = minutesOf(block.start);
  const e = minutesOf(block.end);
  return Number.isFinite(s) && Number.isFinite(e) && e <= s;
}

export function formatTime12(hhmm: string) {
  const mins = minutesOf(hhmm);
  if (!Number.isFinite(mins)) return hhmm || '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(m)} ${suffix}`;
}

/** 95 -> '1h 35m' */
export function formatDuration(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
