import { useEffect, useRef, useState } from 'react';
import { entriesToSlots, formatClock } from '../lib/entries';
import { SLOT_MINUTES, type Category, type Entry } from '../lib/types';

interface Props {
  entries: Entry[];
  categories: Map<string, Category>;
  brush: string | null; // category id, or null for eraser
  currentSlot: number | null;
  onPaint: (slots: number[], categoryId: string | null) => void;
}

const SLOTS_PER_ROW = 60 / SLOT_MINUTES;
const LONG_PRESS_MS = 300;

type Stroke = {
  anchor: number;
  current: number;
  categoryId: string | null;
  /** pending: touch waiting to see if it's a tap, scroll or long-press. */
  state: 'pending' | 'painting';
  pointerType: string;
  x: number;
  y: number;
  moved: boolean;
};

/**
 * 24 rows (one per hour) of 15-minute cells. Everything from the cell where a stroke
 * starts to the cell where it ends gets painted with the selected category.
 *
 * Mouse: click or drag. Touch: tap paints one cell, a normal swipe scrolls the page,
 * and long-press then drag paints a range. Starting on a cell that already has the
 * brush's category erases instead.
 */
export default function TimelineGrid({ entries, categories, brush, currentSlot, onPaint }: Props) {
  const slots = entriesToSlots(entries);
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);

  const update = (s: Stroke | null) => {
    strokeRef.current = s;
    setStroke(s);
  };

  // Once a long-press has started painting, stop the page from scrolling under the finger.
  // This has to be a non-passive native listener; React's touch listeners are passive.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (strokeRef.current?.state === 'painting' && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const slotAt = (x: number, y: number) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-slot]');
    return el ? Number(el.dataset.slot) : null;
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const i = slotAt(e.clientX, e.clientY);
    if (i === null) return;
    const categoryId = brush && slots[i] === brush ? null : brush;
    const touch = e.pointerType === 'touch';
    update({
      anchor: i,
      current: i,
      categoryId,
      state: touch ? 'pending' : 'painting',
      pointerType: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    });
    if (touch) {
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const s = strokeRef.current;
        if (s && s.state === 'pending' && !s.moved) {
          navigator.vibrate?.(10);
          update({ ...s, state: 'painting' });
        }
      }, LONG_PRESS_MS);
    } else {
      // Keep receiving moves and the release even if the mouse leaves the grid.
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  const move = (e: React.PointerEvent) => {
    const s = strokeRef.current;
    if (!s) return;
    if (s.state === 'pending') {
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
        clearTimeout(timer.current);
        update({ ...s, moved: true });
      }
      return;
    }
    const i = slotAt(e.clientX, e.clientY);
    if (i !== null && i !== s.current) update({ ...s, current: i });
  };

  const up = () => {
    clearTimeout(timer.current);
    const s = strokeRef.current;
    update(null);
    if (!s || (s.state === 'pending' && s.moved)) return;
    const [a, b] = s.anchor <= s.current ? [s.anchor, s.current] : [s.current, s.anchor];
    onPaint(
      Array.from({ length: b - a + 1 }, (_, k) => a + k),
      s.categoryId,
    );
  };

  const cancel = () => {
    clearTimeout(timer.current);
    update(null);
  };

  const inStroke = (i: number) => {
    if (!stroke || (stroke.state === 'pending' && stroke.moved)) return false;
    const [a, b] = stroke.anchor <= stroke.current ? [stroke.anchor, stroke.current] : [stroke.current, stroke.anchor];
    return i >= a && i <= b;
  };
  const shown = (i: number) => (inStroke(i) ? stroke!.categoryId : slots[i]);

  const rows = [];
  for (let h = 0; h < 24; h++) {
    const cells = [];
    for (let q = 0; q < SLOTS_PER_ROW; q++) {
      const i = h * SLOTS_PER_ROW + q;
      const catId = shown(i);
      const cat = catId ? categories.get(catId) : undefined;
      const label = cat && (q === 0 || shown(i - 1) !== catId) ? cat.name : '';
      const range = `${formatClock(i * SLOT_MINUTES)}–${formatClock((i + 1) * SLOT_MINUTES)}`;
      cells.push(
        <div
          key={i}
          data-slot={i}
          className={`cell${cat ? ' filled' : ''}${i === currentSlot ? ' now' : ''}${inStroke(i) ? ' stroke' : ''}`}
          style={cat ? { background: cat.color } : undefined}
          title={`${range} ${cat ? cat.name : 'Untracked'}`}
          aria-label={`${range} ${cat ? cat.name : 'Untracked'}`}
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
      ref={gridRef}
      className={`timeline${stroke?.state === 'painting' ? ' painting' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {rows}
    </div>
  );
}
