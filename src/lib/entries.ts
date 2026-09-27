import { newId } from './id';
import { MINUTES_PER_DAY, SLOT_MINUTES, SLOTS_PER_DAY, type Entry } from './types';

/**
 * Place a block of time on a day, overwriting whatever overlapped it.
 * Pass categoryId = null to erase the range instead.
 * Adjacent blocks with the same category and note are merged.
 */
export function applyRange(
  entries: Entry[],
  start: number,
  end: number,
  categoryId: string | null,
  note?: string,
): Entry[] {
  start = clamp(start);
  end = clamp(end);
  if (end <= start) return normalize(entries);

  const out: Entry[] = [];
  for (const e of entries) {
    if (e.end <= start || e.start >= end) {
      out.push(e);
      continue;
    }
    if (e.start < start) out.push({ ...e, end: start });
    if (e.end > end) out.push({ ...e, id: e.start < start ? newId() : e.id, start: end });
  }
  if (categoryId) out.push({ id: newId(), start, end, categoryId, ...(note ? { note } : {}) });
  return normalize(out);
}

export function removeEntry(entries: Entry[], id: string): Entry[] {
  return entries.filter((e) => e.id !== id);
}

/** Sort and merge touching blocks that share category and note. */
export function normalize(entries: Entry[]): Entry[] {
  const sorted = entries
    .filter((e) => e.end > e.start)
    .slice()
    .sort((a, b) => a.start - b.start);
  const out: Entry[] = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (last && last.end === e.start && last.categoryId === e.categoryId && (last.note ?? '') === (e.note ?? '')) {
      out[out.length - 1] = { ...last, end: e.end };
    } else {
      out.push({ ...e });
    }
  }
  return out;
}

/** For each 15-minute slot, the category covering most of it (or null). */
export function entriesToSlots(entries: Entry[]): (string | null)[] {
  const slots: (string | null)[] = [];
  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const s = i * SLOT_MINUTES;
    const t = s + SLOT_MINUTES;
    const cover = new Map<string, number>();
    for (const e of entries) {
      const overlap = Math.min(t, e.end) - Math.max(s, e.start);
      if (overlap > 0) cover.set(e.categoryId, (cover.get(e.categoryId) ?? 0) + overlap);
    }
    let best: string | null = null;
    let bestMin = 0;
    for (const [id, m] of cover) if (m > bestMin) [best, bestMin] = [id, m];
    slots.push(best);
  }
  return slots;
}

export function minutesByCategory(entries: Entry[], limit = MINUTES_PER_DAY): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const mins = Math.min(e.end, limit) - e.start;
    if (mins > 0) m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + mins);
  }
  return m;
}

export function trackedMinutes(entries: Entry[], limit = MINUTES_PER_DAY): number {
  let total = 0;
  for (const e of entries) total += Math.max(0, Math.min(e.end, limit) - e.start);
  return total;
}

/** Untracked stretches within [0, limit). */
export function gaps(entries: Entry[], limit = MINUTES_PER_DAY): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const e of normalize(entries)) {
    if (e.start >= limit) break;
    if (e.start > cursor) out.push({ start: cursor, end: e.start });
    cursor = Math.max(cursor, e.end);
  }
  if (cursor < limit) out.push({ start: cursor, end: limit });
  return out;
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseClock(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function clamp(v: number) {
  return Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(v)));
}
