// YearHeatmap.tsx - GitHub-style rolling-year training heatmap with weekly
// streak stats. Cell intensity is quantile-scaled by session volume so a
// light technique day and a heavy squat day read differently.
import { useMemo } from 'react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { trainingDayTotals, weeklyStreaks, startOfWeek } from '../lib/stats';
import { getLocalDateString } from '../lib/date';

const WEEKS = 53;
const CELL = 12;
const GAP = 3;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function YearHeatmap() {
  const { allLogs, settings } = useFitNotesStore();
  const firstDay = Math.max(0, Math.min(6, settings.first_day_of_week - 1));

  const { columns, monthLabels, stats, levelOf } = useMemo(() => {
    const totals = trainingDayTotals(allLogs);
    const today = new Date();
    const todayKey = getLocalDateString(today);

    // Grid runs from the week (WEEKS - 1) weeks ago through the current week.
    const gridStart = startOfWeek(today, firstDay);
    gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * 7);
    const gridStartKey = getLocalDateString(gridStart);

    // Quantile thresholds over the window's non-zero session volumes.
    const volumes: number[] = [];
    for (const [date, t] of totals) {
      if (date >= gridStartKey && date <= todayKey && t.volume > 0) volumes.push(t.volume);
    }
    volumes.sort((a, b) => a - b);
    const quantile = (q: number) => volumes.length === 0 ? 0 : volumes[Math.min(volumes.length - 1, Math.floor(q * volumes.length))];
    const q25 = quantile(0.25), q50 = quantile(0.5), q75 = quantile(0.75);
    const levelOf = (sets: number, volume: number): number => {
      if (sets === 0) return 0;
      if (volume <= q25) return 1;
      if (volume <= q50) return 2;
      if (volume <= q75) return 3;
      return 4;
    };

    const columns: { date: string; inRange: boolean; sets: number; volume: number }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    const cursor = new Date(gridStart);
    let prevMonth = -1;
    const windowDates: string[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; inRange: boolean; sets: number; volume: number }[] = [];
      const colMonth = cursor.getMonth();
      if (colMonth !== prevMonth) {
        monthLabels.push({ col: w, label: cursor.toLocaleDateString(undefined, { month: 'short' }) });
        prevMonth = colMonth;
      }
      for (let d = 0; d < 7; d++) {
        const key = getLocalDateString(cursor);
        const t = totals.get(key);
        const inRange = key <= todayKey;
        col.push({ date: key, inRange, sets: t?.sets ?? 0, volume: Math.round(t?.volume ?? 0) });
        if (inRange && t && t.sets > 0) windowDates.push(key);
        cursor.setDate(cursor.getDate() + 1);
      }
      columns.push(col);
    }

    const stats = weeklyStreaks(windowDates, firstDay, today);
    return { columns, monthLabels, stats, levelOf };
  }, [allLogs, firstDay]);

  const LEVEL_OPACITY = [0, 0.25, 0.5, 0.75, 1];
  const statTiles = [
    { label: 'Workouts (12 mo)', value: stats.trainingDays },
    { label: 'Active weeks', value: `${stats.weeksActive}/${WEEKS}` },
    { label: 'Current streak', value: `${stats.currentStreakWeeks} wk` },
    { label: 'Longest streak', value: `${stats.longestStreakWeeks} wk` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
        {statTiles.map(tile => (
          <div key={tile.label} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>{tile.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{tile.value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: `${GAP}px` }}>
          {/* Month labels */}
          <div style={{ position: 'relative', height: '14px', marginLeft: `${CELL + GAP + 24}px` }}>
            {monthLabels.map(m => (
              <span key={`${m.col}-${m.label}`} style={{
                position: 'absolute', left: `${m.col * (CELL + GAP)}px`,
                fontSize: '10px', color: 'var(--text-secondary-dark)', whiteSpace: 'nowrap',
              }}>
                {m.label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: `${GAP}px` }}>
            {/* Day-of-week labels (alternate rows only, to reduce noise) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, width: `${24 + CELL}px` }}>
              {Array.from({ length: 7 }, (_, d) => (
                <span key={d} style={{ height: `${CELL}px`, fontSize: '9px', lineHeight: `${CELL}px`, color: 'var(--text-secondary-dark)', textAlign: 'right', paddingRight: '4px' }}>
                  {d % 2 === 1 ? DAY_LABELS[(firstDay + d) % 7] : ''}
                </span>
              ))}
            </div>
            {columns.map((col, w) => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                {col.map(cell => {
                  const level = cell.inRange ? levelOf(cell.sets, cell.volume) : 0;
                  return (
                    <div
                      key={cell.date}
                      title={cell.inRange ? `${cell.date}: ${cell.sets} set${cell.sets === 1 ? '' : 's'}${cell.volume > 0 ? `, volume ${cell.volume}` : ''}` : undefined}
                      style={{
                        width: `${CELL}px`, height: `${CELL}px`, borderRadius: '3px',
                        background: level === 0 ? 'rgba(255,255,255,0.06)' : 'var(--primary)',
                        opacity: cell.inRange ? (level === 0 ? 1 : LEVEL_OPACITY[level]) : 0.25,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', marginTop: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', marginRight: '2px' }}>Less</span>
            {LEVEL_OPACITY.map((op, i) => (
              <span key={i} style={{
                width: `${CELL}px`, height: `${CELL}px`, borderRadius: '3px',
                background: i === 0 ? 'rgba(255,255,255,0.06)' : 'var(--primary)',
                opacity: i === 0 ? 1 : op,
              }} />
            ))}
            <span style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', marginLeft: '2px' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
