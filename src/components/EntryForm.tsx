import { useEffect, useState } from 'react';
import { formatClock, parseClock } from '../lib/entries';
import type { Category, Entry } from '../lib/types';

export interface EntryInput {
  start: number;
  /** May be <= start, meaning the block runs past midnight into the next day. */
  end: number;
  categoryId: string;
  note: string;
}

interface Props {
  categories: Category[];
  editing: Entry | null;
  defaultStart: number;
  defaultEnd: number;
  defaultCategory: string | null;
  onSubmit: (v: EntryInput) => void;
  onCancelEdit: () => void;
}

export default function EntryForm({ categories, editing, defaultStart, defaultEnd, defaultCategory, onSubmit, onCancelEdit }: Props) {
  const [start, setStart] = useState(formatClock(defaultStart));
  const [end, setEnd] = useState(formatClock(defaultEnd % 1440));
  const [categoryId, setCategoryId] = useState(defaultCategory ?? categories[0]?.id ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (editing) {
      setStart(formatClock(editing.start));
      setEnd(formatClock(editing.end % 1440));
      setCategoryId(editing.categoryId);
      setNote(editing.note ?? '');
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      setStart(formatClock(defaultStart));
      setEnd(formatClock(defaultEnd % 1440));
    }
  }, [defaultStart, defaultEnd, editing]);

  useEffect(() => {
    if (!editing && defaultCategory) setCategoryId(defaultCategory);
  }, [defaultCategory, editing]);

  const s = parseClock(start);
  const e = parseClock(end);
  const crossesMidnight = e !== 0 && e <= s;

  return (
    <form
      className="entry-form card"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!categoryId || s === e) return;
        onSubmit({ start: s, end: e === 0 ? 1440 : e, categoryId, note: note.trim() });
        setNote('');
      }}
    >
      <h3>{editing ? 'Edit entry' : 'Add entry'}</h3>
      <div className="form-row">
        <label>
          From
          <input type="time" step={60} value={start} onChange={(ev) => setStart(ev.target.value)} required />
        </label>
        <label>
          To
          <input type="time" step={60} value={end} onChange={(ev) => setEnd(ev.target.value)} required />
        </label>
      </div>
      <label>
        Category
        <select value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note <span className="muted">(optional)</span>
        <input type="text" value={note} maxLength={200} placeholder="What were you doing?" onChange={(ev) => setNote(ev.target.value)} />
      </label>
      {crossesMidnight && <p className="hint">Runs past midnight: the rest goes on the next day.</p>}
      {s === e && <p className="hint">Start and end are the same.</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={s === e}>
          {editing ? 'Save' : 'Add'}
        </button>
        {editing && (
          <button type="button" className="ghost" onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>
      <p className="hint">Anything this overlaps is replaced.</p>
    </form>
  );
}
