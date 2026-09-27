import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { applyRange, formatClock, formatDuration, gaps, minutesByCategory, removeEntry, trackedMinutes } from '../lib/entries';
import { elapsedMinutes, fromKey, shiftDay, toKey } from '../lib/dates';
import type { DataStore } from '../lib/store';
import { SLOT_MINUTES, type Category, type DayDoc, type Entry, type Settings } from '../lib/types';
import TimelineGrid from './TimelineGrid';
import EntryForm, { type EntryInput } from './EntryForm';

interface Props {
  store: DataStore;
  settings: Settings;
  onError: (msg: string) => void;
}

export default function DayView({ store, settings, onError }: Props) {
  const [date, setDate] = useState(() => toKey(new Date()));
  const [day, setDay] = useState<DayDoc | null>(null);
  const [brush, setBrush] = useState<string | null>(() => settings.categories.find((c) => !c.archived)?.id ?? null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let live = true;
    setDay(null);
    setEditing(null);
    store.loadDays(date, date).then(
      (m) => live && setDay(m.get(date) ?? { date, entries: [] }),
      (e) => onError(`Couldn't load ${date}: ${e.message ?? e}`),
    );
    return () => {
      live = false;
    };
  }, [date, store, onError]);

  const catMap = useMemo(() => new Map(settings.categories.map((c) => [c.id, c])), [settings.categories]);
  const active = settings.categories.filter((c) => !c.archived);

  const save = (next: DayDoc) => {
    setDay(next);
    store.saveDay(next).catch((e) => onError(`Couldn't save: ${e.message ?? e}`));
  };

  const isToday = date === toKey(now);
  const elapsed = elapsedMinutes(date, now);
  const currentSlot = isToday ? Math.floor(elapsed / SLOT_MINUTES) : null;

  if (!day) return <div className="center muted">Loading…</div>;

  const entries = day.entries;

  const paint = (slots: number[], categoryId: string | null) => {
    let next = entries;
    // Apply contiguous runs as single ranges.
    let runStart = slots[0];
    for (let k = 1; k <= slots.length; k++) {
      if (k === slots.length || slots[k] !== slots[k - 1] + 1) {
        next = applyRange(next, runStart * SLOT_MINUTES, (slots[k - 1] + 1) * SLOT_MINUTES, categoryId);
        runStart = slots[k];
      }
    }
    save({ ...day, entries: next });
  };

  const submit = async (v: EntryInput) => {
    const base = editing ? removeEntry(entries, editing.id) : entries;
    if (v.end > v.start) {
      save({ ...day, entries: applyRange(base, v.start, v.end, v.categoryId, v.note) });
    } else {
      // Crosses midnight: split across today and tomorrow.
      save({ ...day, entries: applyRange(base, v.start, 1440, v.categoryId, v.note) });
      const nextKey = shiftDay(date, 1);
      try {
        const m = await store.loadDays(nextKey, nextKey);
        const nextDay = m.get(nextKey) ?? { date: nextKey, entries: [] };
        await store.saveDay({ ...nextDay, entries: applyRange(nextDay.entries, 0, v.end, v.categoryId, v.note) });
      } catch (e) {
        onError(`Couldn't save the part after midnight: ${(e as Error).message ?? e}`);
      }
    }
    setEditing(null);
  };

  const remove = (id: string) => {
    save({ ...day, entries: removeEntry(entries, id) });
    if (editing?.id === id) setEditing(null);
  };

  const lastEnd = entries.length ? entries[entries.length - 1].end : 0;
  const defaultEnd = isToday ? Math.max(Math.round(elapsed / SLOT_MINUTES) * SLOT_MINUTES, lastEnd + SLOT_MINUTES) : lastEnd + 60;
  const tracked = trackedMinutes(entries);
  const dayGaps = gaps(entries, elapsed).filter((g) => g.end - g.start >= SLOT_MINUTES);
  const untracked = dayGaps.reduce((s, g) => s + g.end - g.start, 0);
  const byCat = [...minutesByCategory(entries).entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="day-view">
      <div className="day-nav">
        <button className="ghost" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="day-title">
          <strong>{format(fromKey(date), 'EEEE')}</strong>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <button className="ghost" onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day">
          ›
        </button>
        {!isToday && (
          <button className="ghost small" onClick={() => setDate(toKey(new Date()))}>
            Today
          </button>
        )}
      </div>

      <div className="day-layout">
        <section className="card grid-card">
          <div className="brushes" role="radiogroup" aria-label="Paint with category">
            {active.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={brush === c.id}
                className={`chip${brush === c.id ? ' selected' : ''}`}
                onClick={() => setBrush(c.id)}
              >
                <span className="swatch" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
            <button role="radio" aria-checked={brush === null} className={`chip${brush === null ? ' selected' : ''}`} onClick={() => setBrush(null)}>
              <span className="swatch eraser" />
              Eraser
            </button>
          </div>
          <p className="hint">Tap or drag across 15-minute cells to paint. Tapping a cell that already has the selected category clears it.</p>
          <TimelineGrid entries={entries} categories={catMap} brush={brush} currentSlot={currentSlot} onPaint={paint} />
        </section>

        <aside className="side">
          <section className="card summary">
            <div className="stats">
              <div>
                <span className="stat-value">{formatDuration(tracked)}</span>
                <span className="stat-label">tracked</span>
              </div>
              <div>
                <span className="stat-value">{formatDuration(untracked)}</span>
                <span className="stat-label">untracked{isToday ? ' so far' : ''}</span>
              </div>
            </div>
            {byCat.length > 0 && (
              <ul className="cat-bars">
                {byCat.map(([id, m]) => (
                  <li key={id}>
                    <span className="swatch" style={{ background: catMap.get(id)?.color ?? '#999' }} />
                    <span className="name">{catMap.get(id)?.name ?? 'Deleted category'}</span>
                    <span className="value">{formatDuration(m)}</span>
                  </li>
                ))}
              </ul>
            )}
            {dayGaps.length > 0 && (
              <details className="gaps">
                <summary>
                  {dayGaps.length} untracked gap{dayGaps.length > 1 ? 's' : ''}
                </summary>
                <ul>
                  {dayGaps.map((g) => (
                    <li key={g.start}>
                      {formatClock(g.start)}–{formatClock(g.end)} <span className="muted">({formatDuration(g.end - g.start)})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <EntryForm
            categories={active.concat(editing && catMap.get(editing.categoryId)?.archived ? [catMap.get(editing.categoryId)!] : [])}
            editing={editing}
            defaultStart={Math.min(lastEnd, 1440 - SLOT_MINUTES)}
            defaultEnd={Math.min(defaultEnd, 1440)}
            defaultCategory={brush}
            onSubmit={submit}
            onCancelEdit={() => setEditing(null)}
          />

          <section className="card">
            <h3>Entries</h3>
            {entries.length === 0 ? (
              <p className="muted">Nothing logged yet.</p>
            ) : (
              <ul className="entry-list">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} cat={catMap.get(e.categoryId)} onEdit={() => setEditing(e)} onDelete={() => remove(e.id)} />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function EntryRow({ entry, cat, onEdit, onDelete }: { entry: Entry; cat?: Category; onEdit: () => void; onDelete: () => void }) {
  return (
    <li>
      <span className="swatch" style={{ background: cat?.color ?? '#999' }} />
      <span className="time">
        {formatClock(entry.start)}–{formatClock(entry.end)}
      </span>
      <span className="name">
        {cat?.name ?? 'Deleted category'}
        {entry.note && <span className="note">{entry.note}</span>}
      </span>
      <span className="dur muted">{formatDuration(entry.end - entry.start)}</span>
      <button className="ghost small" onClick={onEdit} aria-label="Edit entry">
        Edit
      </button>
      <button className="ghost small danger" onClick={onDelete} aria-label="Delete entry">
        ✕
      </button>
    </li>
  );
}
