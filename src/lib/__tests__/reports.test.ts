import { describe, expect, it } from 'vitest';
import { buildReport, buildTrends, topCategories } from '../reports';
import type { DayDoc } from '../types';

const docs = new Map<string, DayDoc>([
  ['2026-09-20', { date: '2026-09-20', entries: [{ id: '1', start: 0, end: 480, categoryId: 'sleep' }] }],
  ['2026-09-21', { date: '2026-09-21', entries: [{ id: '2', start: 540, end: 1020, categoryId: 'work' }] }],
]);

describe('buildReport', () => {
  it('totals categories and untracked time only for elapsed time', () => {
    const now = new Date(2026, 8, 21, 12, 0); // 21 Sep, noon
    const r = buildReport(['2026-09-20', '2026-09-21', '2026-09-22'], docs, now);
    expect(r.byCategory.get('sleep')).toBe(480);
    expect(r.byCategory.get('work')).toBe(480);
    // Day 1: 1440 - 480. Day 2: 720 elapsed, 180 tracked by noon. Day 3: future.
    expect(r.untracked).toBe(960 + 540);
    expect(r.elapsedDays).toBe(2);
    expect(r.loggedDays).toBe(2);
  });
});

describe('buildTrends', () => {
  it('compares per-day averages', () => {
    const now = new Date(2026, 8, 30);
    const cur = buildReport(['2026-09-21'], docs, now);
    const prev = buildReport(['2026-09-20'], docs, now);
    const work = buildTrends(cur, prev).find((t) => t.categoryId === 'work')!;
    expect(work.deltaAvg).toBe(480);
  });
});

describe('topCategories', () => {
  it('does not fold a single leftover category', () => {
    const m = new Map([['a', 3], ['b', 2], ['c', 1]]);
    expect(topCategories(m, 2)).toEqual({ top: ['a', 'b', 'c'], rest: [] });
    m.set('d', 1);
    expect(topCategories(m, 2).rest).toEqual(['c', 'd']);
  });
});
