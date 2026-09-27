import { describe, expect, it } from 'vitest';
import { applyRange, entriesToSlots, gaps, normalize } from '../entries';
import type { Entry } from '../types';

const strip = (es: Entry[]) => es.map(({ start, end, categoryId }) => ({ start, end, categoryId }));

describe('applyRange', () => {
  it('adds a block to an empty day', () => {
    expect(strip(applyRange([], 60, 120, 'work'))).toEqual([{ start: 60, end: 120, categoryId: 'work' }]);
  });

  it('splits an existing block it lands inside', () => {
    const day = applyRange([], 0, 480, 'sleep');
    expect(strip(applyRange(day, 120, 150, 'work'))).toEqual([
      { start: 0, end: 120, categoryId: 'sleep' },
      { start: 120, end: 150, categoryId: 'work' },
      { start: 150, end: 480, categoryId: 'sleep' },
    ]);
  });

  it('merges adjacent blocks of the same category', () => {
    let day = applyRange([], 0, 15, 'work');
    day = applyRange(day, 15, 30, 'work');
    day = applyRange(day, 30, 45, 'work');
    expect(strip(day)).toEqual([{ start: 0, end: 45, categoryId: 'work' }]);
  });

  it('does not merge blocks with different notes', () => {
    let day = applyRange([], 0, 15, 'work', 'email');
    day = applyRange(day, 15, 30, 'work', 'meeting');
    expect(day).toHaveLength(2);
  });

  it('erases with a null category', () => {
    const day = applyRange([], 0, 60, 'work');
    expect(strip(applyRange(day, 15, 30, null))).toEqual([
      { start: 0, end: 15, categoryId: 'work' },
      { start: 30, end: 60, categoryId: 'work' },
    ]);
  });

  it('gives split halves distinct ids', () => {
    const day = applyRange(applyRange([], 0, 60, 'work'), 15, 30, null);
    expect(day[0].id).not.toEqual(day[1].id);
  });
});

describe('entriesToSlots', () => {
  it('picks the majority category per slot', () => {
    const day = normalize([
      { id: 'a', start: 0, end: 10, categoryId: 'work' },
      { id: 'b', start: 10, end: 15, categoryId: 'meals' },
    ]);
    const slots = entriesToSlots(day);
    expect(slots[0]).toBe('work');
    expect(slots[1]).toBeNull();
    expect(slots).toHaveLength(96);
  });
});

describe('gaps', () => {
  it('finds untracked stretches up to a limit', () => {
    const day = applyRange([], 60, 120, 'work');
    expect(gaps(day, 180)).toEqual([
      { start: 0, end: 60 },
      { start: 120, end: 180 },
    ]);
  });
});
