// Dates are stored as local ISO day strings (YYYY-MM-DD) so comparisons are plain string compares.

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const parseDay = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const isoDay = (d: Date): string =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const todayISO = (): string => isoDay(new Date());

export const addDays = (s: string, n: number): string => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

export const addMonths = (s: string, n: number): string => {
  const d = parseDay(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return isoDay(d);
};

/** Whole days from b to a (a − b). */
export const dayDiff = (a: string, b: string): number => Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 864e5);

/** "25 Sep" */
export const shortDate = (s: string): string => {
  const d = parseDay(s);
  return d.getDate() + ' ' + MON[d.getMonth()];
};

/** "Fri 25 Sep" */
export const weekdayDate = (s: string): string => {
  const d = parseDay(s);
  return WDL[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
};

/** "Friday, 25 September" */
export const longDate = (s: string): string => {
  const d = parseDay(s);
  return WDL[d.getDay()] + ', ' + d.getDate() + ' ' + MONL[d.getMonth()];
};

/** Label used on quest cards: "Due today", "Tomorrow", a weekday within a week, else "3 Oct". */
export const dueLabel = (due: string, today: string): string => {
  const n = dayDiff(due, today);
  if (n < 0) return n === -1 ? 'Overdue · yesterday' : 'Overdue · ' + -n + ' days';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return WDL[parseDay(due).getDay()];
  return shortDate(due);
};

/** Next occurrence (on or after today) of a yearly MM-DD date. */
export const nextAnnual = (mmdd: string, today: string): string => {
  const y = Number(today.slice(0, 4));
  const thisYear = y + '-' + mmdd;
  return thisYear < today ? y + 1 + '-' + mmdd : thisYear;
};
