// ExercisesView.tsx - Exercise catalog: filter exercises, create custom
// exercises in a modal, favourite/edit, bulk edit, and open per-exercise history.
import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Dumbbell, History as HistoryIcon, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { getExerciseTypeLabel } from '../lib/units';
import type { Exercise } from '../types';

type ExerciseSortMode = 'name' | 'lastUsed' | 'workouts';

export function ExercisesView() {
  const {
    categories, exercises, allLogs,
    newExName, setNewExName, newExNotes, setNewExNotes,
    newExCategory, setNewExCategory, newExType, setNewExType, handleCreateExercise,
    expandedCategories, toggleCategoryExpand,
    handleToggleExerciseFavourite, openExerciseEditor, setHistoryExerciseId,
    refreshData, triggerToast, triggerConfirm,
  } = useFitNotesStore();

  const [sortMode, setSortMode] = useState<ExerciseSortMode>(() => {
    const saved = localStorage.getItem('fn_exercise_sort_mode') as ExerciseSortMode | null;
    return saved === 'lastUsed' || saved === 'workouts' ? saved : 'name';
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  // Bulk-edit selection mode
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkType, setBulkType] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkCategory('');
    setBulkType('');
  };

  // Apply a partial update to every selected exercise.
  const applyBulk = async (patch: Partial<Exercise>, message: string) => {
    if (selectedIds.size === 0) {
      triggerToast('No exercises selected.', 'error');
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        const ex = exercises.find(x => x.id === id);
        if (ex) await db.execute('UPDATE exercises', [{ ...ex, ...patch }]);
      }
      await refreshData();
      triggerToast(`${message} (${selectedIds.size} exercises)`);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      triggerToast('No exercises selected.', 'error');
      return;
    }
    triggerConfirm(
      'Delete Exercises',
      `Delete ${selectedIds.size} selected exercises? Logged history is retained but they will be hidden from the catalog.`,
      async () => {
        await applyBulk({ is_deleted: true }, 'Deleted');
        exitBulkMode();
      }
    );
  };

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
    const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (sortMode === 'lastUsed') copy.sort((a, b) => (exStats[b.id]?.lastUsed ?? '').localeCompare(exStats[a.id]?.lastUsed ?? '') || byName(a, b));
    else if (sortMode === 'workouts') copy.sort((a, b) => ((exStats[b.id]?.workouts ?? 0) - (exStats[a.id]?.workouts ?? 0)) || byName(a, b));
    else copy.sort(byName);
    return copy;
  };

  const sortedCategories = useMemo(
    () => [...categories].filter(c => !c.is_deleted).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [categories]
  );

  const updateSortMode = (mode: ExerciseSortMode) => {
    setSortMode(mode);
    localStorage.setItem('fn_exercise_sort_mode', mode);
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

  // View-scoped keys: b toggles bulk-edit; in bulk mode Ctrl+A selects all
  // visible and Esc exits. Single keys are ignored while typing in a field.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (bulkMode && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault();
        setSelectedIds(new Set(filteredExercises.map(x => x.id)));
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'b') {
        e.preventDefault();
        setBulkMode(prev => {
          if (prev) {
            setSelectedIds(new Set());
            setBulkCategory('');
            setBulkType('');
          }
          return !prev;
        });
        return;
      }
      if (e.key === 'Escape' && bulkMode) {
        exitBulkMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkMode, filteredExercises]);

  const createExercise = async () => {
    if (!newExName.trim()) return;
    await handleCreateExercise();
    setShowCreateModal(false);
  };

  const ExerciseRow = ({ ex }: { ex: Exercise }) => {
    const cat = categories.find(c => c.id === ex.category_id);
    const color = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
    const stats = exStats[ex.id];
    const selected = selectedIds.has(ex.id);

    if (bulkMode) {
      return (
        <div
          className="exercise-catalog-row"
          onClick={() => toggleSelected(ex.id)}
          style={{
            cursor: 'pointer',
            outline: selected ? '2px solid var(--primary)' : 'none',
            borderRadius: '8px',
            background: selected ? 'rgba(99, 102, 241, 0.08)' : undefined,
            // Leading checkbox column spanning the card height, content beside it.
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Global CSS sizes inputs at 100% width; pin the checkbox so the name stays visible. */}
          <input type="checkbox" checked={selected} readOnly style={{ pointerEvents: 'none', width: '17px', height: '17px', padding: 0, flexShrink: 0, accentColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
            <div className="exercise-catalog-name">{ex.name}</div>
            <div className="exercise-catalog-meta-row">
              <div className="exercise-catalog-meta">
                <span className="exercise-category-chip" style={{ backgroundColor: color + '15', color }}>
                  {cat?.name || 'Misc'}
                </span>
                <span>{getExerciseTypeLabel(ex.exercise_type_id)}</span>
                {stats?.lastUsed && <span>last {stats.lastUsed} - {stats.workouts}x</span>}
              </div>
            </div>
          </div>
        </div>
      );
    }

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
            <option value="0">Weight & Reps</option>
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
            <button
              className={`btn ${bulkMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
              title="Select multiple exercises to edit at once (b)"
            >
              <CheckSquare size={15} /> {bulkMode ? 'Done' : 'Bulk Edit'} <kbd className="kbd" style={{ opacity: 0.6 }}>b</kbd>
            </button>
            <button className={`btn ${favouritesOnly ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFavouritesOnly(v => !v)}>
              <Star size={15} fill={favouritesOnly ? 'currentColor' : 'transparent'} /> Favorites
            </button>
            <select value={sortMode} onChange={e => updateSortMode(e.target.value as ExerciseSortMode)}>
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
            {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

          {sortedCategories.map(cat => {
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

          {(() => {
            const miscExercises = sortExercises(filteredExercises.filter(x => !x.category_id || !categories.some(c => c.id === x.category_id && !c.is_deleted)));
            const isExpanded = expandedCategories.misc !== false;
            if (hasFilters && miscExercises.length === 0) return null;

            return (
              <div className="category-section">
                <div
                  onClick={() => toggleCategoryExpand('misc')}
                  className="exercise-category-header"
                  style={{ borderLeftColor: 'var(--text-secondary-dark)' }}
                >
                  <span style={{ color: 'var(--text-secondary-dark)' }}>Misc ({miscExercises.length})</span>
                  <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                </div>
                {isExpanded && (
                  <div className="exercise-category-list">
                    {miscExercises.length === 0 ? (
                      <div className="empty-state-text">No exercises in this category.</div>
                    ) : (
                      miscExercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {filteredExercises.length === 0 && (
            <div className="empty-state-text">No exercises match your filters.</div>
          )}
        </div>
      </div>

      {showCreateModal && renderCreateModal()}

      {bulkMode && (
        <div style={{
          position: 'sticky', bottom: '12px', zIndex: 50,
          background: 'var(--bg-surface-dark)', border: '1px solid var(--primary)',
          borderRadius: '14px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setSelectedIds(new Set(filteredExercises.map(x => x.id)))}
            title="Select all visible (Ctrl+A)"
          >
            Select All ({filteredExercises.length}) <kbd className="kbd" style={{ opacity: 0.6 }}>Ctrl+A</kbd>
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>

          <span style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border-dark)' }} />

          <select
            value={bulkCategory}
            onChange={async (e) => {
              const val = e.target.value;
              setBulkCategory(val);
              if (val) {
                await applyBulk({ category_id: val }, `Moved to ${categories.find(c => c.id === val)?.name || 'category'}`);
                setBulkCategory('');
              }
            }}
            disabled={bulkBusy}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', width: 'auto', maxWidth: '180px' }}
          >
            <option value="">Set Category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={bulkType}
            onChange={async (e) => {
              const val = e.target.value;
              setBulkType(val);
              if (val !== '') {
                await applyBulk({ exercise_type_id: parseInt(val) }, `Type set to ${getExerciseTypeLabel(parseInt(val))}`);
                setBulkType('');
              }
            }}
            disabled={bulkBusy}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', width: 'auto', maxWidth: '180px' }}
          >
            <option value="">Set Type...</option>
            <option value="0">Weight & Reps</option>
            <option value="2">Reps Only</option>
            <option value="3">Distance & Time</option>
            <option value="4">Distance Only</option>
            <option value="5">Time Only</option>
            <option value="6">Weight & Distance</option>
            <option value="7">Weight & Time</option>
          </select>

          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            disabled={bulkBusy}
            onClick={() => applyBulk({ is_favourite: true }, 'Favourited')}
          >
            <Star size={13} fill="var(--warning)" color="var(--warning)" /> Favourite
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            disabled={bulkBusy}
            onClick={() => applyBulk({ is_favourite: false }, 'Unfavourited')}
          >
            <Star size={13} /> Unfavourite
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            disabled={bulkBusy}
            onClick={handleBulkDelete}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
