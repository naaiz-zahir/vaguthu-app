import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
  addMonths,
  addWeeks,
} from 'date-fns';

export type Period = 'week' | 'month';
export type WeekStart = 0 | 1 | 6;

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const fromKey = (k: string) => parseISO(k);
export const shiftDay = (k: string, n: number) => toKey(addDays(fromKey(k), n));

export function periodRange(anchor: Date, period: Period, weekStartsOn: WeekStart) {
  const start = period === 'week' ? startOfWeek(anchor, { weekStartsOn }) : startOfMonth(anchor);
  const end = period === 'week' ? endOfWeek(anchor, { weekStartsOn }) : endOfMonth(anchor);
  return { start, end, days: eachDayOfInterval({ start, end }).map(toKey) };
}

export function shiftPeriod(anchor: Date, period: Period, n: number) {
  if (period === 'week') return n >= 0 ? addWeeks(anchor, n) : subWeeks(anchor, -n);
  return n >= 0 ? addMonths(anchor, n) : subMonths(anchor, -n);
}

export function periodLabel(anchor: Date, period: Period, weekStartsOn: WeekStart) {
  if (period === 'month') return format(anchor, 'MMMM yyyy');
  const { start, end } = periodRange(anchor, period, weekStartsOn);
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

/** Minutes of `dayKey` that have already happened as of `now` (0 for future days). */
export function elapsedMinutes(dayKey: string, now: Date): number {
  const today = toKey(now);
  if (dayKey < today) return 1440;
  if (dayKey > today) return 0;
  return now.getHours() * 60 + now.getMinutes();
}
