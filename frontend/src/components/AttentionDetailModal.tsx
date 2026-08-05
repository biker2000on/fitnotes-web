import { useEffect, useMemo, useRef } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Target, TrendingDown, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { goalCurrentValue, goalTargetValue, goalTypeLabel, goalUnit } from '../lib/goals';
import { exerciseGraphSeries, startOfWeek, weeklyMuscleVolume } from '../lib/stats';
import { getLocalDateString } from '../lib/date';
import type { AttentionItem } from '../lib/attention';

interface AttentionDetailModalProps {
  item: AttentionItem;
  onClose: () => void;
  onDismiss: () => void;
}

const niceDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
  month: 'short', day: 'numeric', year: '2-digit',
});

export function AttentionDetailModal({ item, onClose, onDismiss }: AttentionDetailModalProps) {
  const { allLogs, exercises, goals, settings, userUnit } = useFitNotesStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  const exercise = exercises.find(ex => ex.id === item.exerciseId);
  const goal = goals.find(candidate => candidate.id === item.goalId);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key.toLowerCase() === 'd') {
        const target = event.target as HTMLElement | null;
        if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onDismiss]);

  const exerciseChart = useMemo(() => {
    if (!exercise || (item.kind !== 'stalled' && item.kind !== 'neglected')) return null;
    const data = exerciseGraphSeries(
      allLogs.filter(log => log.exercise_id === exercise.id),
      settings.estimated_1rm_max_apply_to_graph ? settings.estimated_1rm_max_reps_to_include : 999,
    );
    if (item.kind === 'stalled') {
      return { data, dataKey: 'estimated1RM' as const, label: 'Estimated 1RM', unit: userUnit };
    }
    const hasVolume = data.some(point => point.volume > 0);
    return hasVolume
      ? { data, dataKey: 'volume' as const, label: 'Session Volume', unit: `${userUnit} × reps` }
      : { data, dataKey: 'totalReps' as const, label: 'Session Reps', unit: 'reps' };
  }, [allLogs, exercise, item.kind, settings.estimated_1rm_max_apply_to_graph, settings.estimated_1rm_max_reps_to_include, userUnit]);

  const goalChart = useMemo(() => {
    if (!goal || item.kind !== 'goal_deadline') return null;
    const logs = allLogs
      .filter(log => log.exercise_id === goal.exercise_id && !log.is_deleted)
      .sort((a, b) => a.date.localeCompare(b.date));
    const dates = Array.from(new Set(logs.map(log => log.date)));
    return {
      data: dates.map(date => ({
        date,
        value: goalCurrentValue(goal, logs.filter(log => log.date <= date)),
      })),
      target: goalTargetValue(goal),
      label: goalTypeLabel(goal.type_id),
      unit: goalUnit(goal.type_id) === 'weight'
        ? userUnit
        : goalUnit(goal.type_id) === 'reps'
          ? 'reps'
          : goalUnit(goal.type_id) === 'dist'
            ? 'distance'
            : 'seconds',
    };
  }, [allLogs, goal, item.kind, userUnit]);

  const muscleChart = useMemo(() => {
    if (!item.muscle || item.kind !== 'under_volume') return null;
    const currentWeek = startOfWeek(new Date(), Math.max(0, Math.min(6, settings.first_day_of_week - 1)));
    const rows: Array<{ date: string; sets: number }> = [];
    for (let offset = 8; offset >= 1; offset--) {
      const week = new Date(currentWeek);
      week.setDate(week.getDate() - offset * 7);
      const sets = weeklyMuscleVolume(allLogs, exercises, week, settings.mark_sets_complete)
        .find(row => row.muscle === item.muscle)?.sets ?? 0;
      rows.push({ date: getLocalDateString(week), sets });
    }
    return { data: rows, targetMin: 10, targetMax: 20 };
  }, [allLogs, exercises, item.kind, item.muscle, settings.first_day_of_week, settings.mark_sets_complete]);

  const tooltipStyle = {
    backgroundColor: 'var(--bg-surface-dark)',
    borderColor: 'var(--border-dark)',
    borderRadius: '8px',
    color: 'var(--text-primary-dark)',
  };

  const chart = exerciseChart ? (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={exerciseChart.data} margin={{ top: 12, right: 22, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={niceDate} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} minTickGap={24} />
        <YAxis width={52} domain={['auto', 'auto']} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={niceDate} formatter={(value) => [`${value} ${exerciseChart.unit}`, exerciseChart.label]} />
        <Line type="monotone" dataKey={exerciseChart.dataKey} name={exerciseChart.label} stroke="var(--primary)" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  ) : goalChart ? (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={goalChart.data} margin={{ top: 12, right: 22, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={niceDate} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} minTickGap={24} />
        <YAxis width={52} domain={[0, Math.max(goalChart.target, ...goalChart.data.map(point => point.value), 1)]} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={niceDate} formatter={(value) => [`${value} ${goalChart.unit}`, goalChart.label]} />
        <ReferenceLine y={goalChart.target} stroke="var(--accent)" strokeDasharray="6 4" label={{ value: `Target ${goalChart.target}`, fill: 'var(--accent)', fontSize: 11 }} />
        <Line type="monotone" dataKey="value" name={goalChart.label} stroke="var(--primary)" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  ) : muscleChart ? (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={muscleChart.data} margin={{ top: 12, right: 22, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={niceDate} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} minTickGap={20} />
        <YAxis width={42} domain={[0, Math.max(muscleChart.targetMax, ...muscleChart.data.map(point => point.sets))]} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `Week of ${niceDate(String(value))}`} formatter={(value) => [`${value} sets`, 'Volume']} />
        <ReferenceArea y1={muscleChart.targetMin} y2={muscleChart.targetMax} fill="var(--success)" fillOpacity={0.1} strokeOpacity={0} />
        <ReferenceLine y={muscleChart.targetMin} stroke="var(--success)" strokeDasharray="5 5" />
        <Line type="monotone" dataKey="sets" name="Weekly sets" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  ) : null;

  const Icon = item.kind === 'under_volume' ? Activity : item.kind === 'goal_deadline' ? Target : TrendingDown;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
      <div
        className="modal-content mobile-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attention-detail-title"
        onClick={event => event.stopPropagation()}
        style={{ width: 'min(720px, calc(100vw - 32px))', maxWidth: '720px' }}
      >
        <div className="mobile-modal-header">
          <div>
            <div id="attention-detail-title" className="card-title"><Icon size={18} color="var(--accent)" /> {item.title}</div>
            <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>{item.detail}</div>
          </div>
          <button ref={closeRef} className="btn btn-secondary icon-btn" onClick={onClose} aria-label="Close attention detail">
            <X size={18} />
          </button>
        </div>
        <div className="mobile-modal-scroll">
          <div style={{ height: '320px', minHeight: '240px' }}>
            {chart ?? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '24px' }}>
                There is not enough history to draw this chart yet.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={onDismiss}>Dismiss item <kbd style={{ marginLeft: '6px' }}>D</kbd></button>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
