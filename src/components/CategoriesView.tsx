import { useState } from 'react';
import { newId } from '../lib/id';
import type { DataStore } from '../lib/store';
import type { Category, Settings } from '../lib/types';

interface Props {
  store: DataStore;
  settings: Settings;
  onChange: (s: Settings) => void;
}

export default function CategoriesView({ store, settings, onChange }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2a78d6');
  const [exporting, setExporting] = useState(false);

  const setCats = (categories: Category[]) => onChange({ ...settings, categories });
  const update = (id: string, patch: Partial<Category>) =>
    setCats(settings.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) => {
    const next = settings.categories.slice();
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setCats(next);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const days = await store.loadDays('0000-01-01', '9999-12-31');
      const blob = new Blob([JSON.stringify({ settings, days: [...days.values()] }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vaguthu-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="categories">
      <section className="card">
        <h3>Categories</h3>
        <p className="hint">Archived categories are hidden when logging but still appear in reports.</p>
        <ul className="cat-list">
          {settings.categories.map((c, i) => (
            <li key={c.id} className={c.archived ? 'archived' : ''}>
              <input type="color" value={c.color} onChange={(e) => update(c.id, { color: e.target.value })} aria-label={`Color for ${c.name}`} />
              <input
                type="text"
                defaultValue={c.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update(c.id, { name: e.target.value.trim() })}
                aria-label="Category name"
              />
              <button className="ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button className="ghost small" onClick={() => move(i, 1)} disabled={i === settings.categories.length - 1} aria-label="Move down">
                ↓
              </button>
              <button className="ghost small" onClick={() => update(c.id, { archived: !c.archived })}>
                {c.archived ? 'Restore' : 'Archive'}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="add-cat"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setCats([...settings.categories, { id: newId(), name: name.trim(), color }]);
            setName('');
          }}
        >
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="New category color" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
          <button className="primary" type="submit">
            Add
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Preferences</h3>
        <label className="inline">
          Week starts on
          <select value={settings.weekStartsOn} onChange={(e) => onChange({ ...settings, weekStartsOn: Number(e.target.value) as 0 | 1 | 6 })}>
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
            <option value={6}>Saturday</option>
          </select>
        </label>
        <div className="form-actions">
          <button className="ghost" onClick={exportData} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export all data (JSON)'}
          </button>
        </div>
      </section>
    </div>
  );
}
