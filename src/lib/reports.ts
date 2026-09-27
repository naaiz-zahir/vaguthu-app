import { minutesByCategory, trackedMinutes } from './entries';
import { elapsedMinutes } from './dates';
import type { DayDoc } from './types';

export interface DayStat {
  date: string;
  byCategory: Map<string, number>;
  tracked: number;
  untracked: number;
}

export interface Report {
  days: DayStat[];
  byCategory: Map<string, number>;
  tracked: number;
  untracked: number;
  /** Days in the period that have started (past days + today). */
  elapsedDays: number;
  /** Days with at least one entry. */
  loggedDays: number;
}

export function buildReport(dayKeys: string[], docs: Map<string, DayDoc>, now: Date): Report {
  const byCategory = new Map<string, number>();
  let tracked = 0;
  let untracked = 0;
  let elapsedDays = 0;
  let loggedDays = 0;

  const days = dayKeys.map((date) => {
    const entries = docs.get(date)?.entries ?? [];
    const elapsed = elapsedMinutes(date, now);
    const cats = minutesByCategory(entries);
    const t = trackedMinutes(entries);
    const u = Math.max(0, elapsed - trackedMinutes(entries, elapsed));
    for (const [id, m] of cats) byCategory.set(id, (byCategory.get(id) ?? 0) + m);
    tracked += t;
    untracked += u;
    if (elapsed > 0) elapsedDays++;
    if (entries.length) loggedDays++;
    return { date, byCategory: cats, tracked: t, untracked: u };
  });

  return { days, byCategory, tracked, untracked, elapsedDays, loggedDays };
}

export interface TrendRow {
  categoryId: string;
  current: number;
  previous: number;
  currentAvg: number;
  previousAvg: number;
  /** Change in average minutes per day. */
  deltaAvg: number;
}

/**
 * Compare per-day averages so a half-finished week/month is fair against a full one.
 */
export function buildTrends(current: Report, previous: Report): TrendRow[] {
  const ids = new Set([...current.byCategory.keys(), ...previous.byCategory.keys()]);
  const cd = Math.max(1, current.elapsedDays);
  const pd = Math.max(1, previous.elapsedDays);
  return [...ids]
    .map((categoryId) => {
      const c = current.byCategory.get(categoryId) ?? 0;
      const p = previous.byCategory.get(categoryId) ?? 0;
      return {
        categoryId,
        current: c,
        previous: p,
        currentAvg: c / cd,
        previousAvg: p / pd,
        deltaAvg: c / cd - p / pd,
      };
    })
    .sort((a, b) => b.current - a.current || b.previous - a.previous);
}

/** Keep the top N categories by time and fold the rest into "other". */
export function topCategories(byCategory: Map<string, number>, n: number): { top: string[]; rest: string[] } {
  const sorted = [...byCategory.entries()].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  if (sorted.length <= n + 1) return { top: sorted, rest: [] };
  return { top: sorted.slice(0, n), rest: sorted.slice(n) };
}
