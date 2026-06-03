// ExercisesView.tsx - Exercise catalog: filter exercises, create custom
// exercises in a modal, favourite/edit, and open per-exercise history.
import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, History as HistoryIcon, Plus, Search, Star, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { getExerciseTypeLabel } from '../lib/units';
import type { Exercise } from '../types';

export function ExercisesView() {
  const {
    categories, exercises, allLogs,
    newExName, setNewExName, newExNotes, setNewExNotes,
    newExCategory, setNewExCategory, newExType, setNewExType, handleCreateExercise,
    expandedCategories, toggleCategoryExpand,
    handleToggleExerciseFavourite, openExerciseEditor, setHistoryExerciseId,
  } = useFitNotesStore();

  const [sortMode, setSortMode] = useState<'name' | 'lastUsed' | 'workouts'>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  useEffect(() => {
    const openCreate = () => setShowCreateModal(true);
    window.addEventListener('fitnotes:open-create-exercise', openCreate);
    return () => window.removeEventListener('fitnotes:open-create-exercise', openCreate);
  }, []);

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

  const sortExercises = (list: Exercise[]) => {
    const copy = [...list];
    if (sortMode === 'lastUsed') copy.sort((a, b) => (exStats[b.id]?.lastUsed ?? '').localeCompare(exStats[a.id]?.lastUsed ?? ''));
    else if (sortMode === 'workouts') copy.sort((a, b) => (exStats[b.id]?.workouts ?? 0) - (exStats[a.id]?.workouts ?? 0));
    else copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  };

  const filteredExercises = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return exercises.filter(ex => {
      if (ex.is_deleted) return false;
      if (favouritesOnly && !ex.is_favourite) return false;
      if (categoryFilter && ex.category_id !== categoryFilter) return false;

      const cat = categories.find(c => c.id === ex.category_id);
      const haystack = [
        ex.name,
        ex.notes ?? '',
        cat?.name ?? '',
        getExerciseTypeLabel(ex.exercise_type_id),
      ].join(' ').toLowerCase();

      return !needle || haystack.includes(needle);
    });
  }, [categories, categoryFilter, exercises, favouritesOnly, query]);

  const createExercise = async () => {
    if (!newExName.trim()) return;
    await handleCreateExercise();
    setShowCreateModal(false);
  };

  const ExerciseRow = ({ ex }: { ex: Exercise }) => {
    const cat = categories.find(c => c.id === ex.category_id);
    const color = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
    const stats = exStats[ex.id];

    return (
      <div className="exercise-catalog-row">
        <div className="exercise-catalog-name">{ex.name}</div>
        <div className="exercise-catalog-meta-row">
          <div className="exercise-catalog-meta">
            <span className="exercise-category-chip" style={{ backgroundColor: color + '15', color }}>
              {cat?.name || 'Misc'}
            </span>
            <span>{getExerciseTypeLabel(ex.exercise_type_id)}</span>
            {stats?.lastUsed && <span>last {stats.lastUsed} - {stats.workouts}x</span>}
          </div>
          <div className="exercise-catalog-actions">
            <button
              className="icon-btn"
              onClick={(e) => handleToggleExerciseFavourite(ex, e)}
              title={ex.is_favourite ? 'Remove Favorite' : 'Mark Favorite'}
              aria-label={ex.is_favourite ? 'Remove Favorite' : 'Mark Favorite'}
              style={{ color: ex.is_favourite ? 'var(--warning)' : 'var(--text-secondary-dark)' }}
            >
              <Star size={18} fill={ex.is_favourite ? 'var(--warning)' : 'transparent'} />
            </button>
            <button className="icon-btn" onClick={() => setHistoryExerciseId(ex.id)} title="History & Records" aria-label="History & Records">
              <HistoryIcon size={17} />
            </button>
            <button className="btn btn-secondary exercise-edit-btn" onClick={() => openExerciseEditor(ex)}>
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateModal = () => (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowCreateModal(false)}>
      <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h2><Plus size={18} /> Create Custom Exercise</h2>
          <button className="icon-btn" onClick={() => setShowCreateModal(false)} aria-label="Close create exercise">
            <X size={20} />
          </button>
        </div>
        <div className="exercise-create-form">
          <input type="text" placeholder="Exercise Name (e.g. Incline Bench Press)" value={newExName} onChange={(e) => setNewExName(e.target.value)} />
          <input type="text" placeholder="Exercise Notes (e.g. Keep elbows in)" value={newExNotes} onChange={(e) => setNewExNotes(e.target.value)} />
          <select value={newExCategory} onChange={(e) => setNewExCategory(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={newExType} onChange={(e) => setNewExType(e.target.value)}>
            <option value="1">Weight & Reps</option>
            <option value="2">Reps Only</option>
            <option value="3">Distance & Time</option>
            <option value="4">Distance Only</option>
            <option value="5">Time Only</option>
            <option value="6">Weight & Distance</option>
            <option value="7">Weight & Time</option>
          </select>
          <button className="btn btn-primary" onClick={createExercise}>Create Exercise</button>
        </div>
      </div>
    </div>
  );

  const hasFilters = Boolean(query.trim() || categoryFilter || favouritesOnly);
  const favourites = sortExercises(filteredExercises.filter(x => x.is_favourite));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div className="card exercise-database-card">
        <div className="exercise-catalog-header">
          <div className="card-title" style={{ margin: 0 }}><Dumbbell size={16} /> Exercises ({filteredExercises.length})</div>
          <div className="exercise-catalog-controls">
            <button className={`btn ${favouritesOnly ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFavouritesOnly(v => !v)}>
              <Star size={15} fill={favouritesOnly ? 'currentColor' : 'transparent'} /> Favorites
            </button>
            <select value={sortMode} onChange={e => setSortMode(e.target.value as typeof sortMode)}>
              <option value="name">Sort: A-Z</option>
              <option value="lastUsed">Sort: Last Used</option>
              <option value="workouts">Sort: Most Workouts</option>
            </select>
          </div>
        </div>

        <div className="exercise-filter-grid">
          <div className="exercise-search-field">
            <Search size={16} />
            <input type="search" placeholder="Filter exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {favourites.length > 0 && !favouritesOnly && (
            <div className="category-section">
              <div
                onClick={() => toggleCategoryExpand('favourites')}
                className="exercise-category-header exercise-favourites-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                  <Star size={16} fill="var(--warning)" />
                  <span>Starred / Favorites ({favourites.length})</span>
                </div>
                <span>{expandedCategories['favourites'] !== false ? 'Collapse' : 'Expand'}</span>
              </div>
              {expandedCategories['favourites'] !== false && (
                <div className="exercise-category-list">
                  {favourites.map(ex => <ExerciseRow key={ex.id} ex={ex} />)}
                </div>
              )}
            </div>
          )}

          {categories.map(cat => {
            const catColor = intColorToHex(cat.colour);
            const catExercises = sortExercises(filteredExercises.filter(x => x.category_id === cat.id));
            const isExpanded = expandedCategories[cat.id] !== false;
            if (hasFilters && catExercises.length === 0) return null;

            return (
              <div key={cat.id} className="category-section">
                <div
                  onClick={() => toggleCategoryExpand(cat.id)}
                  className="exercise-category-header"
                  style={{ borderLeftColor: catColor }}
                >
                  <span style={{ color: catColor }}>{cat.name} ({catExercises.length})</span>
                  <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                </div>
                {isExpanded && (
                  <div className="exercise-category-list">
                    {catExercises.length === 0 ? (
                      <div className="empty-state-text">No exercises in this category.</div>
                    ) : (
                      catExercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredExercises.length === 0 && (
            <div className="empty-state-text">No exercises match your filters.</div>
          )}
        </div>
      </div>

      {showCreateModal && renderCreateModal()}
    </div>
  );
}
