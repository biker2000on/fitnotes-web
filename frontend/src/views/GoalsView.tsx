// GoalsView.tsx - Create and track per-exercise goals.
import { useState } from 'react';
import { Target, Plus, Trash2, Check, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { GOAL_TYPE, type Goal } from '../types';
import { GOAL_TYPE_OPTIONS, goalTypeLabel, goalUnit, goalCurrentValue, goalTargetValue } from '../lib/goals';

export function GoalsView() {
  const { goals, exercises, userUnit, saveGoal, deleteGoal, allLogs, uuidv4, settings } = useFitNotesStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState('');
  const [typeId, setTypeId] = useState<number>(GOAL_TYPE.MAX_WEIGHT);
  const [target, setTarget] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const usesReps = goalUnit(typeId) === 'reps';

  // Current best value for a goal, computed from logs (used for the progress bar).
  const currentValue = (g: Goal): number => goalCurrentValue(g, allLogs);
  const targetValue = goalTargetValue;

  const submit = () => {
    if (!exerciseId || (!target && !targetReps)) return;
    const existing = editingId ? goals.find(g => g.id === editingId) : null;
    const goal: Goal = {
      id: editingId ?? uuidv4(),
      type_id: typeId,
      exercise_id: exerciseId,
      metric_weight: usesReps ? null : (target ? parseFloat(target) : null),
      reps: usesReps ? (targetReps ? parseInt(targetReps, 10) : null) : null,
      unit: userUnit === 'kg' ? 1 : 2,
      title: null,
      target_date: targetDate || null,
      sort_order: existing?.sort_order ?? (goals.reduce((max, g) => Math.max(max, g.sort_order), -1) + 1),
      distance: null,
      duration_seconds: null,
      start_date: existing?.start_date ?? new Date().toISOString().split('T')[0],
    };
    saveGoal(goal);
    setShowForm(false); setEditingId(null);
    setExerciseId(''); setTarget(''); setTargetReps(''); setTargetDate('');
  };

  const startEdit = (g: Goal) => {
    setEditingId(g.id);
    setExerciseId(g.exercise_id);
    setTypeId(g.type_id);
    setTarget(g.metric_weight != null ? String(g.metric_weight) : '');
    setTargetReps(g.reps != null ? String(g.reps) : '');
    setTargetDate(g.target_date ?? '');
    setShowForm(true);
  };

  // Reorder by swapping sort_order with the neighbour.
  const move = (g: Goal, dir: -1 | 1) => {
    const sorted = [...goals].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(x => x.id === g.id);
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const other = sorted[j];
    saveGoal({ ...g, sort_order: other.sort_order });
    saveGoal({ ...other, sort_order: g.sort_order });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ margin: 0 }}><Target size={18} /> Goals</div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setExerciseId(''); setTarget(''); setTargetReps(''); setTargetDate(''); setShowForm(s => !s); }}>
          <Plus size={16} /> New Goal
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise</label>
            <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={{ width: '100%', padding: '10px' }}>
              <option value="">Select exercise…</option>
              {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Goal Type</label>
            <select value={typeId} onChange={e => setTypeId(parseInt(e.target.value, 10))} style={{ width: '100%', padding: '10px' }}>
              {GOAL_TYPE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {usesReps ? (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Target Reps</label>
                <input type="number" value={targetReps} onChange={e => setTargetReps(e.target.value)} />
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Target ({userUnit})</label>
                <input type="number" value={target} onChange={e => setTarget(e.target.value)} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Target Date (optional)</label>
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit}>Save Goal</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {goals.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '32px' }}>No goals yet. Create one to track your progress.</p>
        ) : (
          goals.map(g => {
            const ex = exercises.find(e => e.id === g.exercise_id);
            const current = currentValue(g);
            const tgt = targetValue(g);
            const pct = tgt > 0 ? Math.min(100, (current / tgt) * 100) : 0;
            const done = current >= tgt && tgt > 0;
            const gu = goalUnit(g.type_id);
            const unitLabel = gu === 'reps' ? 'reps' : gu === 'dist' ? (settings.distance_unit === 2 ? 'mi' : 'km') : gu === 'time' ? 's' : userUnit;
            return (
              <div key={g.id} className="card" style={{ gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ex?.name ?? 'Unknown exercise'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
                      {goalTypeLabel(g.type_id)}{g.target_date ? ` · by ${g.target_date}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {done && <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, marginRight: '4px' }}><Check size={14} /> Achieved</span>}
                    <button className="icon-btn workout-history-btn" onClick={() => move(g, -1)} title="Move up" aria-label="Move goal up"><ChevronUp size={16} /></button>
                    <button className="icon-btn workout-history-btn" onClick={() => move(g, 1)} title="Move down" aria-label="Move goal down"><ChevronDown size={16} /></button>
                    <button className="icon-btn workout-history-btn" onClick={() => startEdit(g)} title="Edit goal" aria-label="Edit goal"><Pencil size={15} /></button>
                    <button className="icon-btn workout-history-btn" onClick={() => deleteGoal(g.id)} title="Delete goal" aria-label="Delete goal" style={{ color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
                  <span>{Math.round(current * 100) / 100} {unitLabel}</span>
                  <span>Target: {tgt} {unitLabel}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: done ? 'var(--success)' : 'var(--primary)', transition: 'width var(--transition-fast)' }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
