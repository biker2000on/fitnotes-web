// ExerciseHistoryDrawer.tsx - Per-exercise History / Records / Graph,
// mirroring FitNotes' exercise detail tabs. Opens when historyExerciseId is set.
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { X, Trophy, History as HistoryIcon, LineChart } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { personalRecords, sessionSummaries, exerciseGraphSeries } from '../lib/stats';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../lib/units';
import type { TrainingLog } from '../types';

type Tab = 'history' | 'records' | 'graph';

export function ExerciseHistoryDrawer() {
  const { historyExerciseId, setHistoryExerciseId, exercises, allLogs, userUnit, settings, formatLogValue, displayWeight } = useFitNotesStore();
  const [tab, setTab] = useState<Tab>('history');

  const exercise = exercises.find(e => e.id === historyExerciseId) ?? null;
  const exerciseTypeId = exercise?.exercise_type_id ?? 0;
  const hasWeight = typeHasWeight(exerciseTypeId);
  const hasReps = typeHasReps(exerciseTypeId);
  const hasDistance = typeHasDistance(exerciseTypeId);
  const hasDuration = typeHasDuration(exerciseTypeId);
  const logs = useMemo(
    () => allLogs.filter(l => l.exercise_id === historyExerciseId && !l.is_deleted),
    [allLogs, historyExerciseId],
  );
  const summaries = useMemo(() => sessionSummaries(logs), [logs]);
  const records = useMemo(() => personalRecords(logs), [logs]);
  const graph = useMemo(() => {
    const raw = exerciseGraphSeries(logs);
    return raw.map(p => ({
      ...p,
      maxWeight: userUnit === 'lbs' ? Math.round(p.maxWeight * 2.20462 * 10) / 10 : p.maxWeight,
      estimated1RM: userUnit === 'lbs' ? Math.round(p.estimated1RM * 2.20462 * 10) / 10 : p.estimated1RM,
      volume: userUnit === 'lbs' ? Math.round(p.volume * 2.20462) : p.volume,
      maxDistance: settings.distance_unit === 2 ? Math.round((p.maxDistance / 1.60934) * 100) / 100 : p.maxDistance,
      totalDistance: settings.distance_unit === 2 ? Math.round((p.totalDistance / 1.60934) * 100) / 100 : p.totalDistance,
      maxDuration: Math.round((p.maxDuration / 60) * 10) / 10,
      totalDuration: Math.round((p.totalDuration / 60) * 10) / 10,
    }));
  }, [logs, settings.distance_unit, userUnit]);

  useEffect(() => {
    if (!historyExerciseId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryExerciseId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyExerciseId, setHistoryExerciseId]);

  if (!historyExerciseId || !exercise) return null;

  const niceDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const shortDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const close = () => setHistoryExerciseId(null);
  const displayMetricWeight = (metricWeight: number) => displayWeight(metricWeight, 1);
  const displayMetricVolume = (metricVolume: number) => {
    const converted = userUnit === 'lbs' ? metricVolume * 2.20462 : metricVolume;
    return `${Math.round(converted)} ${userUnit}`;
  };
  const displayDistance = (km: number) => {
    if (settings.distance_unit === 2) return `${Math.round((km / 1.60934) * 100) / 100} mi`;
    return `${Math.round(km * 100) / 100} km`;
  };
  const displayDuration = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    return `${secs}s`;
  };
  const summarizeSession = (sessionLogs: TrainingLog[], totalVolume: number, totalReps: number) => {
    const parts = [`${sessionLogs.length} set${sessionLogs.length === 1 ? '' : 's'}`];
    const totalDistance = sessionLogs.reduce((sum, log) => sum + (log.distance ?? 0), 0);
    const totalDuration = sessionLogs.reduce((sum, log) => sum + (log.duration_seconds ?? 0), 0);

    if (hasWeight && hasReps) parts.push(`${displayMetricVolume(totalVolume)} vol`);
    else if (hasReps) parts.push(`${totalReps} reps`);

    if (hasDistance && totalDistance > 0) parts.push(displayDistance(totalDistance));
    if (hasDuration && totalDuration > 0) parts.push(displayDuration(totalDuration));

    return parts.join(' - ');
  };
  const maxDistanceLog = logs.reduce<TrainingLog | null>((best, log) => ((log.distance ?? 0) > (best?.distance ?? 0) ? log : best), null);
  const maxDurationLog = logs.reduce<TrainingLog | null>((best, log) => ((log.duration_seconds ?? 0) > (best?.duration_seconds ?? 0) ? log : best), null);
  const maxRepsLog = logs.reduce<TrainingLog | null>((best, log) => ((log.reps ?? 0) > (best?.reps ?? 0) ? log : best), null);
  const maxWeightLog = logs.reduce<TrainingLog | null>((best, log) => ((log.metric_weight ?? 0) > (best?.metric_weight ?? 0) ? log : best), null);
  const totalDistance = logs.reduce((sum, log) => sum + (log.distance ?? 0), 0);
  const totalDuration = logs.reduce((sum, log) => sum + (log.duration_seconds ?? 0), 0);
  const totalReps = logs.reduce((sum, log) => sum + (log.reps ?? 0), 0);
  const graphTitle = hasWeight && hasReps
    ? 'Estimated 1RM Progression'
    : hasDistance
      ? 'Distance Progression'
      : hasDuration
        ? 'Duration Progression'
        : 'Rep Progression';

  return (
    <>
      <div className="sidebar-backdrop open" onClick={close} style={{ zIndex: 100000 }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, height: '100dvh', width: 'min(480px, 100vw)',
        background: 'var(--bg-surface-dark)', borderLeft: '1px solid var(--border-dark)',
        zIndex: 100001, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px', paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
          borderBottom: '1px solid var(--border-dark)',
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{exercise.name}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>{logs.length} sets across {summaries.length} sessions</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close history">
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-dark)' }}>
          {([['history', 'History', HistoryIcon], ['records', 'Records', Trophy], ['graph', 'Graph', LineChart]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: '12px', background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 700,
                color: tab === id ? 'var(--primary)' : 'var(--text-secondary-dark)',
                borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tab === 'history' && (
            summaries.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '32px' }}>No history yet.</p>
            ) : summaries.map(s => (
              <div key={s.date} className="card" style={{ gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{niceDate(s.date)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>{summarizeSession(s.logs, s.totalVolume, s.totalReps)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {s.logs.map((l, i) => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary-dark)' }}>Set {i + 1}</span>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'right' }}>
                        {formatLogValue(l, exercise.exercise_type_id)}
                        {l.is_personal_record && <Trophy size={12} color="var(--accent)" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {tab === 'records' && (
            <>
              <div className="card" style={{ gap: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>Best Records</div>
                {hasWeight && hasReps && (
                  <>
                    <Stat label="Max Weight" value={records.maxWeight ? `${displayMetricWeight(records.maxWeight.weight)} x ${records.maxWeight.reps}` : '-'} date={records.maxWeight?.date} />
                    <Stat label="Max Reps" value={records.maxReps ? `${records.maxReps.reps} @ ${displayMetricWeight(records.maxReps.weight)}` : '-'} date={records.maxReps?.date} />
                    <Stat label="Best Est. 1RM" value={records.bestEstimated1RM ? displayMetricWeight(records.bestEstimated1RM.value) : '-'} date={records.bestEstimated1RM?.date} />
                    <Stat label="Max Set Volume" value={records.maxSetVolume ? displayMetricVolume(records.maxSetVolume.volume) : '-'} date={records.maxSetVolume?.date} />
                  </>
                )}
                {hasWeight && !hasReps && (
                  <Stat label="Max Weight" value={maxWeightLog?.metric_weight ? displayMetricWeight(maxWeightLog.metric_weight) : '-'} date={maxWeightLog?.date} />
                )}
                {hasReps && !hasWeight && (
                  <>
                    <Stat label="Max Reps" value={maxRepsLog?.reps ? `${maxRepsLog.reps} reps` : '-'} date={maxRepsLog?.date} />
                    <Stat label="Total Reps" value={totalReps ? `${totalReps} reps` : '-'} />
                  </>
                )}
                {hasDistance && (
                  <>
                    <Stat label="Max Distance" value={maxDistanceLog?.distance ? displayDistance(maxDistanceLog.distance) : '-'} date={maxDistanceLog?.date} />
                    <Stat label="Total Distance" value={totalDistance ? displayDistance(totalDistance) : '-'} />
                  </>
                )}
                {hasDuration && (
                  <>
                    <Stat label="Max Duration" value={maxDurationLog?.duration_seconds ? displayDuration(maxDurationLog.duration_seconds) : '-'} date={maxDurationLog?.date} />
                    <Stat label="Total Duration" value={totalDuration ? displayDuration(totalDuration) : '-'} />
                  </>
                )}
              </div>
              {hasWeight && hasReps && (
                <div className="card" style={{ gap: '6px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>Rep Maxes (Actual)</div>
                  {records.byReps.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>No records yet.</p>
                  ) : records.byReps.map(r => (
                    <div key={r.reps} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                      <span style={{ color: 'var(--text-secondary-dark)' }}>{r.reps} RM</span>
                      <span style={{ fontWeight: 600 }}>{displayMetricWeight(r.weight)} <span style={{ color: 'var(--text-secondary-dark)', fontWeight: 400, fontSize: '11px' }}>- {shortDate(r.date)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'graph' && (
            graph.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '32px' }}>No data to graph.</p>
            ) : (
              <div className="card">
                <div className="card-title">{graphTitle}</div>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ReLineChart data={graph} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                      <YAxis stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                      <Tooltip labelFormatter={shortDate} contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                      {hasWeight && hasReps && <Line type="monotone" dataKey="estimated1RM" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} name="Est. 1RM" />}
                      {hasWeight && <Line type="monotone" dataKey="maxWeight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} name="Max Weight" />}
                      {hasReps && !hasWeight && <Line type="monotone" dataKey="totalReps" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} name="Total Reps" />}
                      {hasDistance && <Line type="monotone" dataKey="totalDistance" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} name="Total Distance" />}
                      {hasDuration && !hasDistance && <Line type="monotone" dataKey="totalDuration" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} name="Total Duration" />}
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value, date }: { label: string; value: string; date?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', padding: '3px 0' }}>
      <span style={{ color: 'var(--text-secondary-dark)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>
        {value}
        {date && <span style={{ color: 'var(--text-secondary-dark)', fontWeight: 400, fontSize: '11px' }}> - {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
      </span>
    </div>
  );
}
