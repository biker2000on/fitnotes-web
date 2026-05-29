// ExercisesView.tsx - Exercise catalog: create exercises, manage categories,
// favourite, edit, and open per-exercise history.
import { useMemo, useState } from 'react';
import { Plus, FolderPlus, Dumbbell, Star, History as HistoryIcon } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { getExerciseTypeLabel } from '../lib/units';
import type { Exercise } from '../types';

export function ExercisesView() {
  const {
    categories, exercises, allLogs,
    newExName, setNewExName, newExNotes, setNewExNotes,
    newExCategory, setNewExCategory, newExType, setNewExType, handleCreateExercise,
    setNewCatName, setNewCatColor, setShowCatModal, setShowManageCatsModal,
    expandedCategories, toggleCategoryExpand,
    handleToggleExerciseFavourite, openExerciseEditor, setHistoryExerciseId,
  } = useFitNotesStore();

  const [sortMode, setSortMode] = useState<'name' | 'lastUsed' | 'workouts'>('name');

  // Per-exercise stats derived from logs (last-used date + distinct workout count).
  const exStats = useMemo(() => {
    const m: Record<string, { lastUsed: string; workouts: number }> = {};
    for (const l of allLogs) {
      if (l.is_deleted) continue;
      const s = m[l.exercise_id] || (m[l.exercise_id] = { lastUsed: '', workouts: 0 });
      if (l.date > s.lastUsed) s.lastUsed = l.date;
    }
    const days: Record<string, Set<string>> = {};
    for (const l of allLogs) {
      if (l.is_deleted) continue;
      (days[l.exercise_id] || (days[l.exercise_id] = new Set())).add(l.date);
    }
    for (const id in days) m[id].workouts = days[id].size;
    return m;
  }, [allLogs]);

  const sortExercises = (list: typeof exercises) => {
    const copy = [...list];
    if (sortMode === 'lastUsed') copy.sort((a, b) => (exStats[b.id]?.lastUsed ?? '').localeCompare(exStats[a.id]?.lastUsed ?? ''));
    else if (sortMode === 'workouts') copy.sort((a, b) => (exStats[b.id]?.workouts ?? 0) - (exStats[a.id]?.workouts ?? 0));
    else copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  };

  const ExerciseRow = ({ ex }: { ex: Exercise }) => {
    const cat = categories.find(c => c.id === ex.category_id);
    const color = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-dark)', borderRadius: '8px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{ex.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '4px' }}>
            {getExerciseTypeLabel(ex.exercise_type_id)}
            {exStats[ex.id]?.lastUsed && <span> · last {exStats[ex.id].lastUsed} · {exStats[ex.id].workouts}×</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={(e) => handleToggleExerciseFavourite(ex, e)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ex.is_favourite ? 'var(--warning)' : 'var(--text-secondary-dark)', padding: '4px', display: 'flex', alignItems: 'center' }}
            title={ex.is_favourite ? 'Remove Favorite' : 'Mark Favorite'}
          >
            <Star size={18} fill={ex.is_favourite ? 'var(--warning)' : 'transparent'} />
          </button>
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', backgroundColor: color + '15', color, fontWeight: 700 }}>
            {cat?.name || 'Misc'}
          </span>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setHistoryExerciseId(ex.id)} title="History & Records">
            <HistoryIcon size={13} />
          </button>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => openExerciseEditor(ex)}>
            Edit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div className="card-title"><Plus size={18} /> Create Custom Exercise</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => { setNewCatName(''); setNewCatColor('#6366f1'); setShowCatModal(true); }}>
              <FolderPlus size={16} /> Add Category
            </button>
            <button className="btn btn-secondary" onClick={() => setShowManageCatsModal(true)}>
              Manage Categories
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <input type="text" placeholder="Exercise Name (e.g. Incline Bench Press)" value={newExName} onChange={(e) => setNewExName(e.target.value)} style={{ flex: 2, minWidth: '200px' }} />
          <input type="text" placeholder="Exercise Notes (e.g. Keep elbows in)" value={newExNotes} onChange={(e) => setNewExNotes(e.target.value)} style={{ flex: 2, minWidth: '200px' }} />
          <select value={newExCategory} onChange={(e) => setNewExCategory(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={newExType} onChange={(e) => setNewExType(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
            <option value="1">Weight & Reps</option>
            <option value="2">Reps Only</option>
            <option value="3">Distance & Time</option>
            <option value="4">Distance Only</option>
            <option value="5">Time Only</option>
            <option value="6">Weight & Distance</option>
            <option value="7">Weight & Time</option>
          </select>
          <button className="btn btn-primary" onClick={handleCreateExercise}>Create</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ margin: 0 }}><Dumbbell size={16} /> Database Exercises ({exercises.length})</div>
          <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} style={{ padding: '6px', fontSize: '12px' }}>
            <option value="name">Sort: A–Z</option>
            <option value="lastUsed">Sort: Last Used</option>
            <option value="workouts">Sort: Most Workouts</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Starred / Favorites */}
          {exercises.some(x => x.is_favourite) && (
            <div className="category-section" style={{ border: '1px solid var(--border-dark)', borderRadius: '12px', overflow: 'hidden' }}>
              <div
                onClick={() => toggleCategoryExpand('favourites')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(2, 132, 199, 0.05)', cursor: 'pointer', fontWeight: 800, fontSize: '14px', borderBottom: expandedCategories['favourites'] !== false ? '1px solid var(--border-dark)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                  <Star size={16} fill="var(--warning)" />
                  <span>Starred / Favorites</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
                  {expandedCategories['favourites'] !== false ? 'Collapse' : 'Expand'}
                </span>
              </div>
              {expandedCategories['favourites'] !== false && (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '8px', gap: '8px' }}>
                  {sortExercises(exercises.filter(x => x.is_favourite)).map(ex => <ExerciseRow key={ex.id} ex={ex} />)}
                </div>
              )}
            </div>
          )}

          {/* Standard categories */}
          {categories.map(cat => {
            const catColor = intColorToHex(cat.colour);
            const catExercises = sortExercises(exercises.filter(x => x.category_id === cat.id));
            const isExpanded = expandedCategories[cat.id] !== false;
            return (
              <div key={cat.id} className="category-section" style={{ border: '1px solid var(--border-dark)', borderRadius: '12px', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleCategoryExpand(cat.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer', fontWeight: 800, fontSize: '14px', borderBottom: isExpanded ? '1px solid var(--border-dark)' : 'none', borderLeft: `4px solid ${catColor}` }}
                >
                  <span style={{ color: catColor }}>{cat.name} ({catExercises.length})</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '8px', gap: '8px' }}>
                    {catExercises.length === 0 ? (
                      <div style={{ padding: '16px', fontStyle: 'italic', fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center' }}>
                        No exercises in this category.
                      </div>
                    ) : (
                      catExercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
