import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '../lib/entries';
import { fromKey, periodLabel, periodRange, shiftPeriod, type Period } from '../lib/dates';
import { buildReport, buildTrends, topCategories, type Report } from '../lib/reports';
import type { DataStore } from '../lib/store';
import type { Settings } from '../lib/types';
import { chartTheme, useDark } from './useDark';

interface Props {
  store: DataStore;
  settings: Settings;
  onError: (msg: string) => void;
}

const TOP_N = 7;
const OTHER = '__other';
const UNTRACKED = '__untracked';

export default function Reports({ store, settings, onError }: Props) {
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState<{ current: Report; previous: Report } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const dark = useDark();
  const theme = chartTheme(dark);
  const ws = settings.weekStartsOn;

  useEffect(() => {
    let live = true;
    setData(null);
    const cur = periodRange(anchor, period, ws);
    const prev = periodRange(shiftPeriod(anchor, period, -1), period, ws);
    store.loadDays(prev.days[0], cur.days[cur.days.length - 1]).then(
      (docs) => {
        if (!live) return;
        const now = new Date();
        setData({ current: buildReport(cur.days, docs, now), previous: buildReport(prev.days, docs, now) });
      },
      (e) => onError(`Couldn't load report: ${e.message ?? e}`),
    );
    return () => {
      live = false;
    };
  }, [anchor, period, ws, store, onError]);

  const catMap = useMemo(() => new Map(settings.categories.map((c) => [c.id, c])), [settings.categories]);
  const nameOf = (id: string) => (id === OTHER ? 'Other' : id === UNTRACKED ? 'Untracked' : (catMap.get(id)?.name ?? 'Deleted category'));
  const colorOf = (id: string) => (id === OTHER ? theme.other : id === UNTRACKED ? theme.untracked : (catMap.get(id)?.color ?? theme.other));

  const isCurrent = periodRange(new Date(), period, ws).days[0] === periodRange(anchor, period, ws).days[0];

  return (
    <div className="reports">
      <div className="report-controls">
        <div className="segmented" role="tablist">
          {(['week', 'month'] as Period[]).map((p) => (
            <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
              {p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <div className="period-nav">
          <button className="ghost" onClick={() => setAnchor(shiftPeriod(anchor, period, -1))} aria-label="Previous period">
            ‹
          </button>
          <strong>{periodLabel(anchor, period, ws)}</strong>
          <button className="ghost" onClick={() => setAnchor(shiftPeriod(anchor, period, 1))} aria-label="Next period">
            ›
          </button>
          {!isCurrent && (
            <button className="ghost small" onClick={() => setAnchor(new Date())}>
              This {period}
            </button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="center muted">Loading…</div>
      ) : data.current.tracked === 0 ? (
        <div className="card empty">
          <p>No time logged in this {period}.</p>
        </div>
      ) : (
        <ReportBody
          data={data}
          period={period}
          showTable={showTable}
          setShowTable={setShowTable}
          nameOf={nameOf}
          colorOf={colorOf}
          theme={theme}
        />
      )}
    </div>
  );
}

interface BodyProps {
  data: { current: Report; previous: Report };
  period: Period;
  showTable: boolean;
  setShowTable: (v: boolean) => void;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  theme: ReturnType<typeof chartTheme>;
}

function ReportBody({ data, period, showTable, setShowTable, nameOf, colorOf, theme }: BodyProps) {
  const { current, previous } = data;
  const { top, rest } = topCategories(current.byCategory, TOP_N);
  const fold = (id: string) => (rest.includes(id) ? OTHER : id);
  const series = [...top, ...(rest.length ? [OTHER] : [])];

  // Donut: tracked categories only.
  const pie = series.map((id) => ({
    id,
    value: id === OTHER ? rest.reduce((s, r) => s + (current.byCategory.get(r) ?? 0), 0) : (current.byCategory.get(id) ?? 0),
  }));
  const total = current.tracked;
  const topCat = pie[0];

  // Stacked bars per day, in hours, with untracked on top.
  const bars = current.days.map((d) => {
    const row: Record<string, number | string> = {
      label: format(fromKey(d.date), period === 'week' ? 'EEE d' : 'd'),
      date: d.date,
    };
    for (const [id, m] of d.byCategory) {
      const k = fold(id);
      row[k] = ((row[k] as number) ?? 0) + m / 60;
    }
    row[UNTRACKED] = d.untracked / 60;
    return row;
  });
  const barSeries = [...series, UNTRACKED];

  const trends = buildTrends(current, previous);
  const avgTracked = current.tracked / Math.max(1, current.elapsedDays);
  const prevAvgTracked = previous.tracked / Math.max(1, previous.elapsedDays);

  return (
    <>
      <section className="tiles">
        <Tile label="Tracked" value={formatDuration(total)} sub={`${formatDuration(avgTracked)} / day`} />
        <Tile
          label="Untracked"
          value={formatDuration(current.untracked)}
          sub={`${Math.round((current.untracked / Math.max(1, current.elapsedDays * 1440)) * 100)}% of elapsed time`}
        />
        <Tile label="Most time" value={nameOf(topCat.id)} sub={`${formatDuration(topCat.value)} · ${pct(topCat.value, total)}`} />
        <Tile
          label="Days logged"
          value={`${current.loggedDays} / ${current.elapsedDays}`}
          sub={prevAvgTracked ? `vs ${formatDuration(prevAvgTracked)} / day last ${period}` : `no data last ${period}`}
        />
      </section>

      <div className="charts">
        <section className="card chart-card">
          <h3>Where your time went</h3>
          <div className="donut-wrap">
            <div className="donut">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pie}
                    dataKey="value"
                    nameKey="id"
                    innerRadius="62%"
                    outerRadius="95%"
                    paddingAngle={0}
                    stroke={theme.surface}
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {pie.map((p) => (
                      <Cell key={p.id} fill={colorOf(p.id)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const p = active && payload?.[0]?.payload;
                      if (!p) return null;
                      return (
                        <div className="tooltip">
                          <span className="swatch" style={{ background: colorOf(p.id) }} />
                          <strong>{nameOf(p.id)}</strong> {formatDuration(p.value)} · {pct(p.value, total)}
                          {p.id === OTHER && <div className="muted">{rest.map(nameOf).join(', ')}</div>}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="stat-value">{formatDuration(total)}</span>
                <span className="stat-label">tracked</span>
              </div>
            </div>
            <ul className="legend-list">
              {pie.map((p) => (
                <li key={p.id} title={p.id === OTHER ? rest.map(nameOf).join(', ') : undefined}>
                  <span className="swatch" style={{ background: colorOf(p.id) }} />
                  <span className="name">{nameOf(p.id)}</span>
                  <span className="value">{formatDuration(p.value)}</span>
                  <span className="pct muted">{pct(p.value, total)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card chart-card wide">
          <div className="card-head">
            <h3>Each day</h3>
            <button className="ghost small" onClick={() => setShowTable(!showTable)}>
              {showTable ? 'Show chart' : 'Show table'}
            </button>
          </div>
          {showTable ? (
            <DayTable data={current} series={series} fold={fold} nameOf={nameOf} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap={period === 'week' ? '25%' : '15%'}>
                  <CartesianGrid vertical={false} stroke={theme.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: theme.axis }} tick={{ fill: theme.muted, fontSize: 12 }} interval={period === 'week' ? 0 : 'preserveStartEnd'} />
                  <YAxis
                    domain={[0, 24]}
                    ticks={[0, 6, 12, 18, 24]}
                    tickFormatter={(v) => `${v}h`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: theme.muted, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: theme.grid, opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Record<string, number | string>;
                      return (
                        <div className="tooltip">
                          <strong>{format(fromKey(row.date as string), 'EEE d MMM')}</strong>
                          <ul>
                            {barSeries
                              .filter((id) => (row[id] as number) > 0)
                              .map((id) => (
                                <li key={id}>
                                  <span className="swatch" style={{ background: colorOf(id) }} />
                                  {nameOf(id)} <span className="value">{formatDuration((row[id] as number) * 60)}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      );
                    }}
                  />
                  {barSeries.map((id) => (
                    <Bar key={id} dataKey={id} stackId="day" fill={colorOf(id)} stroke={theme.surface} strokeWidth={1} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <ul className="legend-inline">
                {barSeries.map((id) => (
                  <li key={id}>
                    <span className="swatch" style={{ background: colorOf(id) }} />
                    {nameOf(id)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h3>Compared with last {period}</h3>
        <p className="hint">Averages per day, so a {period} still in progress compares fairly with a full one.</p>
        <div className="table-scroll">
          <table className="trends">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num hide-sm">This {period}</th>
                <th className="num">Avg / day</th>
                <th className="num hide-sm">Last {period} avg</th>
                <th className="num">Change / day</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.categoryId}>
                  <td>
                    <span className="swatch" style={{ background: colorOf(t.categoryId) }} />
                    {nameOf(t.categoryId)}
                  </td>
                  <td className="num hide-sm">{t.current ? formatDuration(t.current) : '–'}</td>
                  <td className="num">{t.current ? formatDuration(t.currentAvg) : '–'}</td>
                  <td className="num muted hide-sm">{t.previous ? formatDuration(t.previousAvg) : '–'}</td>
                  <td className="num">
                    <Delta minutes={t.deltaAvg} />
                  </td>
                </tr>
              ))}
              <tr className="untracked-row">
                <td>
                  <span className="swatch" style={{ background: theme.untracked }} />
                  Untracked
                </td>
                <td className="num hide-sm">{formatDuration(current.untracked)}</td>
                <td className="num">{formatDuration(current.untracked / Math.max(1, current.elapsedDays))}</td>
                <td className="num muted hide-sm">{formatDuration(previous.untracked / Math.max(1, previous.elapsedDays))}</td>
                <td className="num">
                  <Delta minutes={current.untracked / Math.max(1, current.elapsedDays) - previous.untracked / Math.max(1, previous.elapsedDays)} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DayTable({ data, series, fold, nameOf }: { data: Report; series: string[]; fold: (id: string) => string; nameOf: (id: string) => string }) {
  return (
    <div className="table-scroll">
      <table className="trends">
        <thead>
          <tr>
            <th>Day</th>
            {series.map((id) => (
              <th key={id} className="num">
                {nameOf(id)}
              </th>
            ))}
            <th className="num">Untracked</th>
          </tr>
        </thead>
        <tbody>
          {data.days.map((d) => {
            const row = new Map<string, number>();
            for (const [id, m] of d.byCategory) row.set(fold(id), (row.get(fold(id)) ?? 0) + m);
            return (
              <tr key={d.date}>
                <td>{format(fromKey(d.date), 'EEE d MMM')}</td>
                {series.map((id) => (
                  <td key={id} className="num">
                    {row.get(id) ? formatDuration(row.get(id)!) : '–'}
                  </td>
                ))}
                <td className="num muted">{d.untracked ? formatDuration(d.untracked) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card tile">
      <span className="stat-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="muted small-text">{sub}</span>
    </div>
  );
}

function Delta({ minutes }: { minutes: number }) {
  const m = Math.round(minutes);
  if (Math.abs(m) < 1) return <span className="muted">no change</span>;
  return (
    <span className={m > 0 ? 'delta up' : 'delta down'}>
      {m > 0 ? '▲ +' : '▼ −'}
      {formatDuration(Math.abs(m))}
    </span>
  );
}

function pct(v: number, total: number) {
  return `${Math.round((v / Math.max(1, total)) * 100)}%`;
}
