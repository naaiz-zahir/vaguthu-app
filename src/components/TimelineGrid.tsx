import { useRef, useState } from 'react';
import { entriesToSlots, formatClock } from '../lib/entries';
import { SLOT_MINUTES, SLOTS_PER_DAY, type Category, type Entry } from '../lib/types';

interface Props {
  entries: Entry[];
  categories: Map<string, Category>;
  brush: string | null; // category id, or null for eraser
  currentSlot: number | null;
  onPaint: (slots: number[], categoryId: string | null) => void;
}

const SLOTS_PER_ROW = 60 / SLOT_MINUTES;

/**
 * 24 rows (one per hour) of 15-minute cells. Click or drag across cells to paint them
 * with the selected category. Starting a drag on a cell that already has the brush's
 * category erases instead.
 */
export default function TimelineGrid({ entries, categories, brush, currentSlot, onPaint }: Props) {
  const slots = entriesToSlots(entries);
  const [draft, setDraft] = useState<{ slots: Set<number>; categoryId: string | null } | null>(null);
  const dragging = useRef(false);

  const slotAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const v = el?.dataset.slot;
    return v === undefined ? null : Number(v);
  };

  const start = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return;
    const categoryId = brush && slots[i] === brush ? null : brush;
    dragging.current = true;
    setDraft({ slots: new Set([i]), categoryId });
    if (e.pointerType === 'mouse') e.preventDefault();
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const i = slotAt(e.clientX, e.clientY);
    if (i === null) return;
    setDraft((d) => (d && !d.slots.has(i) ? { ...d, slots: new Set(d.slots).add(i) } : d));
  };

  const end = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (draft) onPaint([...draft.slots].sort((a, b) => a - b), draft.categoryId);
    setDraft(null);
  };

  const cancel = () => {
    // Touch scroll took over: drop the stroke rather than painting by accident.
    dragging.current = false;
    setDraft(null);
  };

  const rows = [];
  for (let h = 0; h < 24; h++) {
    const cells = [];
    for (let q = 0; q < SLOTS_PER_ROW; q++) {
      const i = h * SLOTS_PER_ROW + q;
      const catId = draft?.slots.has(i) ? draft.categoryId : slots[i];
      const cat = catId ? categories.get(catId) : undefined;
      const prev = i > 0 ? (draft?.slots.has(i - 1) ? draft.categoryId : slots[i - 1]) : null;
      const label = cat && (q === 0 || prev !== catId) ? cat.name : '';
      const range = `${formatClock(i * SLOT_MINUTES)}–${formatClock((i + 1) * SLOT_MINUTES)}`;
      cells.push(
        <div
          key={i}
          data-slot={i}
          className={`cell${cat ? ' filled' : ''}${i === currentSlot ? ' now' : ''}`}
          style={cat ? { background: cat.color } : undefined}
          title={`${range} ${cat ? cat.name : 'Untracked'}`}
          aria-label={`${range} ${cat ? cat.name : 'Untracked'}`}
          onPointerDown={(e) => start(e, i)}
        >
          {label && <span className="cell-label">{label}</span>}
        </div>,
      );
    }
    rows.push(
      <div className="grid-row" key={h}>
        <span className="hour">{formatClock(h * 60)}</span>
        <div className="cells">{cells}</div>
      </div>,
    );
  }

  return (
    <div
      className="timeline"
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={cancel}
      data-slots={SLOTS_PER_DAY}
    >
      {rows}
    </div>
  );
}
