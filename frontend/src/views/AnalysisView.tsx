// AnalysisView.tsx - Exercise progress graphs + category/exercise breakdown.
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { LineChart as LineIcon, PieChart as PieIcon, GitCompare, BarChart3, History as HistoryIcon, Star, Activity, Trophy } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import {
  exerciseGraphSeries, breakdown, periodStart, workoutGraphSeries, weeklyMuscleVolume, startOfWeek, strengthAnalytics,
  type BreakdownMetric, type BreakdownPeriod, type WorkoutGroupBy,
} from '../lib/stats';
import { intColorToHex } from '../lib/colors';

type Metric = 'volume' | 'maxWeight' | 'estimated1RM' | 'maxReps' | 'totalReps';
const METRIC_LABELS: Record<Metric, string> = {
  volume: 'Volume', maxWeight: 'Max Weight', estimated1RM: 'Estimated 1RM', maxReps: 'Max Reps', totalReps: 'Total Reps',
};

// Least-squares trend line over a numeric series.
const trend = (vals: number[]): number[] => {
  const n = vals.length;
  if (n < 2) return vals;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  vals.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  return vals.map((_, x) => Math.round((intercept + slope * x) * 100) / 100);
};

export function AnalysisView() {
  const { exercises, categories, allLogs, userUnit, settings, analyticExerciseId, setAnalyticExerciseId, setHistoryExerciseId, graphFavourites, saveGraphFavourite, uuidv4 } = useFitNotesStore();
  const [tab, setTab] = useState<'graph' | 'muscles' | 'strength' | 'breakdown' | 'comparison' | 'workout'>('graph');
  const [metric, setMetric] = useState<Metric>('volume');
  const [gFrom, setGFrom] = useState('');
  const [gTo, setGTo] = useState('');
  const [bScope, setBScope] = useState<'category' | 'exercise'>('category');
  const [bMetric, setBMetric] = useState<BreakdownMetric>('volume');
  const [bPeriod, setBPeriod] = useState<BreakdownPeriod>('month');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [wBy, setWBy] = useState<WorkoutGroupBy>('week');
  const [wMetric, setWMetric] = useState<'sets' | 'reps' | 'volume' | 'durationMin' | 'workouts'>('volume');

  const COMPARE_COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b'];
  const compareData = useMemo(() => {
    if (compareIds.length === 0) return [] as any[];
    const lim = settings.estimated_1rm_max_apply_to_graph ? settings.estimated_1rm_max_reps_to_include : 999;
    const byDate: Record<string, any> = {};
    compareIds.forEach(id => {
      exerciseGraphSeries(allLogs.filter(l => l.exercise_id === id), lim).forEach(p => {
        byDate[p.date] = byDate[p.date] || { date: p.date };
        byDate[p.date][id] = p[metric];
      });
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [allLogs, compareIds, metric, settings]);
  const workoutData = useMemo(() => workoutGraphSeries(allLogs, wBy), [allLogs, wBy]);

  const repLimit = settings.estimated_1rm_max_apply_to_graph ? settings.estimated_1rm_max_reps_to_include : 999;
  const strengthRepLimit = Math.max(1, repLimit);
  const muscleWeekStart = useMemo(
    () => startOfWeek(new Date(), Math.max(0, Math.min(6, settings.first_day_of_week - 1))),
    [settings.first_day_of_week],
  );
  const muscleData = useMemo(
    () => weeklyMuscleVolume(allLogs, exercises, muscleWeekStart, settings.mark_sets_complete),
    [allLogs, exercises, muscleWeekStart, settings.mark_sets_complete],
  );
  const strengthData = useMemo(
    () => strengthAnalytics(allLogs.filter(log => log.exercise_id === analyticExerciseId), strengthRepLimit, settings.mark_sets_complete),
    [allLogs, analyticExerciseId, strengthRepLimit, settings.mark_sets_complete],
  );
  const displayStrengthWeight = (weightKg: number): number =>
    Math.round((userUnit === 'lbs' ? weightKg * 2.20462 : weightKg) * 10) / 10;
  const strengthSeries = useMemo(
    () => strengthData.series.map(point => ({
      ...point,
      estimated1RM: displayStrengthWeight(point.estimated1RM),
      adjusted1RM: displayStrengthWeight(point.adjusted1RM),
      maxWeight: displayStrengthWeight(point.maxWeight),
    })),
    [strengthData.series, userUnit],
  );
  const latestStrength = strengthSeries[strengthSeries.length - 1];
  const bestStrength = strengthSeries.reduce((best, point) => Math.max(best, point.adjusted1RM), 0);
  const series = useMemo(() => {
    let logs = allLogs.filter(l => l.exercise_id === analyticExerciseId);
    if (gFrom) logs = logs.filter(l => l.date >= gFrom);
    if (gTo) logs = logs.filter(l => l.date <= gTo);
    const data = exerciseGraphSeries(logs, repLimit);
    if (settings.graph_show_trend_line && data.length > 1) {
      const t = trend(data.map(d => d[metric]));
      return data.map((d, i) => ({ ...d, trend: t[i] }));
    }
    return data;
  }, [allLogs, analyticExerciseId, metric, repLimit, settings.graph_show_trend_line, gFrom, gTo]);

  const exFavourites = graphFavourites.filter(f => !f.is_deleted && f.exercise_id);

  const bData = useMemo(() => {
    const from = periodStart(bPeriod);
    const keyOf = bScope === 'category'
      ? (l: any) => categories.find(c => c.id === exercises.find(e => e.id === l.exercise_id)?.category_id)?.name ?? 'Uncategorised'
      : (l: any) => exercises.find(e => e.id === l.exercise_id)?.name ?? '';
    const rows = breakdown(allLogs, keyOf, bMetric, from);
    return rows.map(r => {
      const cat = categories.find(c => c.name === r.key);
      return { name: r.key, value: r.value, color: bScope === 'category' && cat ? intColorToHex(cat.colour) : undefined };
    });
  }, [allLogs, exercises, categories, bScope, bMetric, bPeriod]);

  const PALETTE = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#a855f7', '#0ea5e9', '#ec4899', '#84cc16'];
  const niceDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'graph' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('graph')}><LineIcon size={16} /> Exercise</button>
        <button className={`btn ${tab === 'muscles' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('muscles')}><Activity size={16} /> Muscle Volume</button>
        <button className={`btn ${tab === 'strength' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('strength')}><Trophy size={16} /> Strength</button>
        <button className={`btn ${tab === 'breakdown' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('breakdown')}><PieIcon size={16} /> Breakdown</button>
        <button className={`btn ${tab === 'comparison' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('comparison')}><GitCompare size={16} /> Compare</button>
        <button className={`btn ${tab === 'workout' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('workout')}><BarChart3 size={16} /> Workout</button>
      </div>

      {tab === 'graph' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title">{METRIC_LABELS[metric]}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={metric} onChange={e => setMetric(e.target.value as Metric)} style={{ padding: '8px' }}>
                {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={analyticExerciseId} onChange={e => setAnalyticExerciseId(e.target.value)} style={{ width: '200px', padding: '8px' }}>
                {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
              <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => analyticExerciseId && setHistoryExerciseId(analyticExerciseId)}><HistoryIcon size={16} /></button>
            </div>
          </div>
          {/* Date range + favourites */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>From</span>
            <input type="date" value={gFrom} onChange={e => setGFrom(e.target.value)} style={{ padding: '5px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>To</span>
            <input type="date" value={gTo} onChange={e => setGTo(e.target.value)} style={{ padding: '5px' }} />
            {(gFrom || gTo) && <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }} onClick={() => { setGFrom(''); setGTo(''); }}>Clear</button>}
            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '11px', marginLeft: 'auto' }} title="Save as favourite"
              onClick={() => saveGraphFavourite({ id: uuidv4(), exercise_id: analyticExerciseId, graph_type: Object.keys(METRIC_LABELS).indexOf(metric), time_period: 0, rep_filter: null })}>
              <Star size={13} /> Save
            </button>
            {exFavourites.length > 0 && (
              <select value="" onChange={e => { const f = exFavourites.find(x => x.id === e.target.value); if (f) { setAnalyticExerciseId(f.exercise_id!); setMetric((Object.keys(METRIC_LABELS)[f.graph_type] as Metric) || 'volume'); } }} style={{ padding: '5px' }}>
                <option value="">Favourites…</option>
                {exFavourites.map(f => <option key={f.id} value={f.id}>{exercises.find(e => e.id === f.exercise_id)?.name} · {METRIC_LABELS[(Object.keys(METRIC_LABELS)[f.graph_type] as Metric)] ?? ''}</option>)}
              </select>
            )}
          </div>
          <div style={{ width: '100%', height: 320 }}>
            {series.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>No logged sets for this exercise yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickFormatter={niceDate} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <YAxis domain={settings.graph_start_at_zero ? [0, 'auto'] : ['auto', 'auto']} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <Tooltip labelFormatter={niceDate} contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                  <Area type="monotone" dataKey={metric} stroke="var(--primary)" strokeWidth={3} fill="url(#g)" dot={settings.graph_show_points ? { r: 2 } : false} name={METRIC_LABELS[metric]} />
                  {settings.graph_show_trend_line && <Area type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} name="Trend" />}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'muscles' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="card-title">Weekly Volume by Muscle</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
                Week of {muscleWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. {settings.mark_sets_complete ? 'Completed' : 'Logged'} working sets only; secondary muscles count as half a set.
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
              Reference band: 10–20 sets
            </div>
          </div>
          {muscleData.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>
              {settings.mark_sets_complete ? 'Complete' : 'Log'} some working sets to populate this week’s muscle volume.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {muscleData.map(row => {
                const pct = Math.min(100, (row.sets / row.targetMax) * 100);
                const inBand = row.sets >= row.targetMin && row.sets <= row.targetMax;
                const over = row.sets > row.targetMax;
                const color = over ? 'var(--danger)' : inBand ? 'var(--success)' : 'var(--primary)';
                return (
                  <div key={row.muscle} className="muscle-volume-row" style={{ display: 'grid', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{row.name}</span>
                    <div style={{ height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'absolute', left: '50%', width: '50%', top: 0, bottom: 0, background: 'rgba(16,185,129,0.10)' }} />
                      <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: '999px', background: color, position: 'relative' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, textAlign: 'right' }}>{row.sets}</span>
                    <span style={{ fontSize: '11px', textAlign: 'right', color: row.delta > 0 ? 'var(--success)' : row.delta < 0 ? 'var(--danger)' : 'var(--text-secondary-dark)' }}>
                      {row.delta > 0 ? '+' : ''}{row.delta} vs prior
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'strength' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="card-title">PR, e1RM & Effort</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
                  RPE-adjusted e1RM uses explicit RIR first, then 10 − RPE as reserve reps; {strengthRepLimit >= 999 ? 'all rep ranges are included' : `sets above ${strengthRepLimit} reps are excluded from e1RM`}.
                </div>
              </div>
              <select value={analyticExerciseId} onChange={e => setAnalyticExerciseId(e.target.value)} style={{ width: '220px', padding: '8px' }}>
                {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Best adjusted e1RM</div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{Math.round(bestStrength * 10) / 10} <small>{userUnit}</small></div>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Latest e1RM</div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{latestStrength?.estimated1RM ?? 0} <small>{userUnit}</small></div>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Latest average RPE</div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{latestStrength?.averageRpe ?? '—'}</div>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>PR events</div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{strengthData.timeline.length}</div>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              {strengthSeries.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>No completed weighted working sets for this exercise yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strengthSeries} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tickFormatter={niceDate} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                    <YAxis domain={settings.graph_start_at_zero ? [0, 'auto'] : ['auto', 'auto']} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                    <Tooltip labelFormatter={niceDate} contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="estimated1RM" name="e1RM" stroke="var(--primary)" strokeWidth={2} dot={settings.graph_show_points ? { r: 2 } : false} />
                    <Line type="monotone" dataKey="adjusted1RM" name="RPE-adjusted e1RM" stroke="var(--accent)" strokeWidth={3} dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return <circle cx={cx} cy={cy} r={payload.isPR ? 5 : 2} fill={payload.isPR ? 'var(--success)' : 'var(--accent)'} />;
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="cols-2">
            <div className="card">
              <div className="card-title">Rep Max Grid</div>
              {strengthData.repMaxGrid.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>No rep records yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px' }}>
                  {strengthData.repMaxGrid.map(record => (
                    <div key={record.reps} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)' }}>{record.reps} rep{record.reps === 1 ? '' : 's'}</div>
                      <div style={{ fontSize: '16px', fontWeight: 800 }}>{displayStrengthWeight(record.weight)}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary-dark)' }}>{userUnit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">PR Timeline</div>
              {strengthData.timeline.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>No PR events yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '330px', overflowY: 'auto' }}>
                  {strengthData.timeline.slice(0, 30).map(event => (
                    <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{displayStrengthWeight(event.weight)} {userUnit} × {event.reps}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)' }}>
                          {event.kinds.includes('e1rm') ? 'e1RM PR' : 'Rep PR'} · estimated {displayStrengthWeight(event.adjusted1RM)} {userUnit}
                          {event.rpe !== null ? ` · RPE ${event.rpe}` : event.rir !== null ? ` · RIR ${event.rir}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', whiteSpace: 'nowrap' }}>{niceDate(event.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'breakdown' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title">Breakdown</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={bScope} onChange={e => setBScope(e.target.value as any)} style={{ padding: '8px' }}><option value="category">By Category</option><option value="exercise">By Exercise</option></select>
              <select value={bMetric} onChange={e => setBMetric(e.target.value as BreakdownMetric)} style={{ padding: '8px' }}><option value="volume">Volume</option><option value="sets">Sets</option><option value="reps">Reps</option><option value="workouts">Workouts</option></select>
              <select value={bPeriod} onChange={e => setBPeriod(e.target.value as BreakdownPeriod)} style={{ padding: '8px' }}><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option><option value="all">All</option></select>
            </div>
          </div>
          {bData.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>No data for this period.</p>
          ) : (
            <div className="cols-2" style={{ alignItems: 'center' }}>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => e.name}>
                      {bData.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {bData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: d.color || PALETTE[i % PALETTE.length] }} /> {d.name}</span>
                    <span style={{ fontWeight: 700 }}>{d.value}{bMetric === 'volume' ? ` ${userUnit}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'comparison' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title">Compare Exercises</div>
            <select value={metric} onChange={e => setMetric(e.target.value as Metric)} style={{ padding: '8px' }}>
              {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {exercises.slice(0, 60).map(ex => {
              const on = compareIds.includes(ex.id);
              return (
                <button key={ex.id} className={`btn ${on ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => setCompareIds(ids => on ? ids.filter(i => i !== ex.id) : ids.length >= 4 ? ids : [...ids, ex.id])}>
                  {ex.name}
                </button>
              );
            })}
          </div>
          <div style={{ width: '100%', height: 300 }}>
            {compareData.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>Select up to 4 exercises to compare.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickFormatter={niceDate} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <YAxis stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <Tooltip labelFormatter={niceDate} contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                  <Legend />
                  {compareIds.map((id, i) => (
                    <Line key={id} type="monotone" dataKey={id} name={exercises.find(e => e.id === id)?.name ?? id} stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === 'workout' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title">Workout Totals</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={wMetric} onChange={e => setWMetric(e.target.value as any)} style={{ padding: '8px' }}>
                <option value="volume">Volume</option><option value="sets">Sets</option><option value="reps">Reps</option><option value="durationMin">Duration (min)</option><option value="workouts">Workouts</option>
              </select>
              <select value={wBy} onChange={e => setWBy(e.target.value as WorkoutGroupBy)} style={{ padding: '8px' }}>
                <option value="week">Per Week</option><option value="month">Per Month</option><option value="year">Per Year</option>
              </select>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            {workoutData.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px' }}>No workouts logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workoutData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <YAxis stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                  <Bar dataKey={wMetric} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
