// AttentionCard.tsx - "Needs attention" feed on the workout log home screen:
// stalled lifts, goal deadlines, under-target muscle volume, and neglected
// exercises. Items deep-link to the relevant place (logger, goals, analysis).
import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown, Target, Activity, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { needsAttention, type AttentionItem } from '../lib/attention';

const KIND_ICONS = {
  stalled: TrendingDown,
  goal_deadline: Target,
  under_volume: Activity,
  neglected: Clock,
} as const;

const KIND_COLORS = {
  stalled: 'var(--danger)',
  goal_deadline: 'var(--accent)',
  under_volume: 'var(--primary)',
  neglected: 'var(--text-secondary-dark)',
} as const;

export function AttentionCard() {
  const {
    allLogs, exercises, goals, userUnit, settings,
    setActiveTab, setSelectedExercise,
  } = useFitNotesStore();
  const [collapsed, setCollapsed] = useState(false);

  const items = useMemo(() => needsAttention({
    allLogs,
    exercises,
    goals,
    userUnit,
    firstDay: Math.max(0, Math.min(6, settings.first_day_of_week - 1)),
    requireComplete: settings.mark_sets_complete,
  }), [allLogs, exercises, goals, userUnit, settings.first_day_of_week, settings.mark_sets_complete]);

  if (items.length === 0) return null;

  const open = (item: AttentionItem) => {
    if (item.kind === 'goal_deadline') {
      setActiveTab('goals');
      return;
    }
    if (item.kind === 'under_volume') {
      setActiveTab('analysis');
      return;
    }
    const exercise = exercises.find(ex => ex.id === item.exerciseId);
    if (exercise) setSelectedExercise(exercise);
  };

  return (
    <div className="card" style={{ gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ margin: 0 }}>
          <AlertTriangle size={16} color="var(--accent)" /> Needs Attention
        </div>
        <button
          className="btn btn-secondary icon-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand needs attention' : 'Collapse needs attention'}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => {
            const Icon = KIND_ICONS[item.kind];
            return (
              <button
                key={`${item.kind}-${item.exerciseId ?? item.goalId ?? item.title}`}
                onClick={() => open(item)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
                  borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  color: 'inherit', width: '100%',
                }}
              >
                <Icon size={15} color={KIND_COLORS[item.kind]} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{item.title}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '2px' }}>
                    {item.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
