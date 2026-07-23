// ExercisesView.tsx - Exercise catalog: filter exercises, create custom
// exercises in a modal, favourite/edit, bulk edit, and open per-exercise history.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckSquare, Dumbbell, History as HistoryIcon, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { getExerciseTypeLabel } from '../lib/units';
import { exerciseMuscleTargets } from '../lib/muscles';
import MuscleDiagram from '../components/MuscleDiagram';
import type { Exercise } from '../types';

type ExerciseSortMode = 'name' | 'lastUsed' | 'workouts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ExercisesView() {
  const {
    categories, exercises, allLogs,
    newExName, setNewExName, newExNotes, setNewExNotes,
    newExCategory, setNewExCategory, newExType, setNewExType, handleCreateExercise,
    expandedCategories, toggleCategoryExpand,
    handleToggleExerciseFavourite, openExerciseEditor, setHistoryExerciseId,
    refreshData, triggerToast, triggerConfirm, handleMergeExercises, userEmail,
  } = useFitNotesStore();

  const [sortMode, setSortMode] = useState<ExerciseSortMode>(() => {
    const saved = localStorage.getItem('fn_exercise_sort_mode') as ExerciseSortMode | null;
    return saved === 'lastUsed' || saved === 'workouts' ? saved : 'name';
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showMergeReview, setShowMergeReview] = useState(false);
  const [mergeReviewFilter, setMergeReviewFilter] = useState<'recommended' | 'denied'>('recommended');
  const [dismissedMergePairs, setDismissedMergePairs] = useState<Set<string>>(new Set());
  const [preferredMergeTargets, setPreferredMergeTargets] = useState<Record<string, string>>({});
  const [reviewMergeBusyId, setReviewMergeBusyId] = useState('');
  const [acceptedMergeCount, setAcceptedMergeCount] = useState(0);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeBusy, setMergeBusy] = useState(false);
  const mergeDismissalKey = `fn_merge_dismissals_${userEmail || 'guest'}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(mergeDismissalKey) || '[]');
      setDismissedMergePairs(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setDismissedMergePairs(new Set());
    }
  }, [mergeDismissalKey]);

  const duplicateGroups = useMemo(() => {
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const groups = new Map<string, Exercise[]>();
    exercises.filter(ex => !ex.is_deleted).forEach(ex => {
      const key = normalize(ex.name);
      groups.set(key, [...(groups.get(key) || []), ex]);
    });
    return [...groups.values()].filter(group => group.length > 1);
  }, [exercises]);

  const mergeExercises = async () => {
    setMergeBusy(true);
    try {
      if (await handleMergeExercises(mergeSourceId, mergeTargetId)) {
        setShowMergeModal(false);
        setMergeSourceId('');
        setMergeTargetId('');
      }
    } finally {
      setMergeBusy(false);
    }
  };

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
    const m: Record<string, { lastUsed: string; workouts: number; sets: number }> = {};
    for (const l of allLogs) {
      if (l.is_deleted) continue;
      const s = m[l.exercise_id] || (m[l.exercise_id] = { lastUsed: '', workouts: 0, sets: 0 });
      if (l.date > s.lastUsed) s.lastUsed = l.date;
      s.sets += 1;
    }
    const days: Record<string, Set<string>> = {};
    for (const l of allLogs) {
      if (l.is_deleted) continue;
      (days[l.exercise_id] || (days[l.exercise_id] = new Set())).add(l.date);
    }
    for (const id in days) m[id].workouts = days[id].size;
    return m;
  }, [allLogs]);

  const mergeRecommendations = useMemo(() => {
    const guidanceScore = (ex: Exercise) => [
      ex.notes, ex.aliases, ex.instructions, ex.video_url, ex.equipment,
      ex.primary_muscles, ex.regressions, ex.progressions, ex.substitutions,
    ].filter(value => Boolean(value?.trim())).length;
    const score = (ex: Exercise) =>
      (exStats[ex.id]?.sets ?? 0) * 100 +
      (exStats[ex.id]?.workouts ?? 0) * 20 +
      guidanceScore(ex) * 5 +
      (ex.is_favourite ? 2 : 0);

    return duplicateGroups.flatMap(group => {
      // Signed-in browser stores can still contain the old built-in `e-*`
      // starter rows alongside their server UUID equivalents. Always keep a
      // server-backed row so accepting the recommendation never tries to send
      // a legacy ID to the UUID-only API.
      const ranked = [...group].sort((a, b) =>
        Number(UUID_RE.test(b.id)) - Number(UUID_RE.test(a.id)) ||
        score(b) - score(a) ||
        a.name.localeCompare(b.name)
      );
      const target = ranked[0];
      return ranked.slice(1).map(source => ({
        id: [source.id, target.id].sort().join('::'),
        source,
        target,
        reason: source.name === target.name
          ? 'Exact duplicate name'
          : 'Same name after ignoring capitalization, spaces, and punctuation',
      }));
    });
  }, [duplicateGroups, exStats]);

  const activeMergeRecommendations = mergeRecommendations.filter(rec => !dismissedMergePairs.has(rec.id));
  const deniedMergeRecommendations = mergeRecommendations.filter(rec => dismissedMergePairs.has(rec.id));

  const setMergeDismissed = (recommendationId: string, dismissed: boolean) => {
    setDismissedMergePairs(current => {
      const next = new Set(current);
      if (dismissed) next.add(recommendationId);
      else next.delete(recommendationId);
      localStorage.setItem(mergeDismissalKey, JSON.stringify([...next]));
      return next;
    });
  };

  const acceptMergeRecommendation = async (recommendation: typeof mergeRecommendations[number]) => {
    const targetId = preferredMergeTargets[recommendation.id] || recommendation.target.id;
    const sourceId = targetId === recommendation.target.id ? recommendation.source.id : recommendation.target.id;
    setReviewMergeBusyId(recommendation.id);
    try {
      if (await handleMergeExercises(sourceId, targetId)) {
        setAcceptedMergeCount(count => count + 1);
        setPreferredMergeTargets(current => {
          const next = { ...current };
          delete next[recommendation.id];
          return next;
        });
      }
    } finally {
      setReviewMergeBusyId('');
    }
  };

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
        ex.aliases ?? '', ex.instructions ?? '', ex.equipment ?? '', ex.primary_muscles ?? '',
        ex.regressions ?? '', ex.progressions ?? '', ex.substitutions ?? '',
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
            {ex.equipment && <span>{ex.equipment}</span>}
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
        {(ex.instructions || ex.video_url || ex.regressions || ex.progressions || ex.substitutions || ex.primary_muscles || ex.secondary_muscles) && (
          <details style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
            <summary style={{ cursor: 'pointer' }}>Guidance</summary>
            {(() => {
              const targets = exerciseMuscleTargets(ex);
              if (targets.primary.size === 0 && targets.secondary.size === 0) return null;
              return (
                <div style={{ margin: '10px 0' }}>
                  <MuscleDiagram primary={targets.primary} secondary={targets.secondary} height={170} />
                </div>
              );
            })()}
            {ex.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{ex.instructions}</p>}
            {ex.primary_muscles && <p><strong>Primary muscles:</strong> {ex.primary_muscles}</p>}
            {ex.secondary_muscles && <p><strong>Secondary muscles:</strong> {ex.secondary_muscles}</p>}
            {ex.regressions && <p><strong>Regressions:</strong> {ex.regressions}</p>}
            {ex.progressions && <p><strong>Progressions:</strong> {ex.progressions}</p>}
            {ex.substitutions && <p><strong>Substitutions:</strong> {ex.substitutions}</p>}
            {ex.video_url && <a href={ex.video_url} target="_blank" rel="noreferrer">Open reference video</a>}
          </details>
        )}
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

  const renderMergeModal = () => (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowMergeModal(false)}>
      <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="mobile-modal-header">
          <h2>Merge duplicate exercises</h2>
          <button className="icon-btn" onClick={() => setShowMergeModal(false)} aria-label="Close merge dialog"><X size={20} /></button>
        </div>
        <p style={{ color: 'var(--text-secondary-dark)', fontSize: '13px' }}>All logs, routines, goals, comments and group links move to the exercise you keep. The removed name becomes an alias.</p>
        {duplicateGroups.length > 0 && (
          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <strong>{duplicateGroups.length} likely duplicate group{duplicateGroups.length === 1 ? '' : 's'}:</strong>{' '}
            {duplicateGroups.slice(0, 5).map(group => group.map(x => x.name).join(' / ')).join('; ')}
          </div>
        )}
        <label>Duplicate to remove</label>
        <select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)}>
          <option value="">Select duplicate…</option>
          {[...exercises].filter(ex => !ex.is_deleted).sort((a, b) => a.name.localeCompare(b.name)).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <label style={{ display: 'block', marginTop: '12px' }}>Canonical exercise to keep</label>
        <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
          <option value="">Select exercise to keep…</option>
          {[...exercises].filter(ex => !ex.is_deleted && ex.id !== mergeSourceId).sort((a, b) => a.name.localeCompare(b.name)).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        <button className="btn btn-primary" disabled={mergeBusy || !mergeSourceId || !mergeTargetId} onClick={mergeExercises} style={{ width: '100%', marginTop: '18px' }}>
          {mergeBusy ? 'Merging…' : 'Merge into canonical exercise'}
        </button>
      </div>
    </div>
  );

  const hasFilters = Boolean(query.trim() || categoryFilter || favouritesOnly);
  const favourites = sortExercises(filteredExercises.filter(x => x.is_favourite));

  if (showMergeReview) {
    const reviewItems = mergeReviewFilter === 'recommended' ? activeMergeRecommendations : deniedMergeRecommendations;
    const exerciseSummary = (ex: Exercise) => {
      const category = categories.find(cat => cat.id === ex.category_id)?.name || 'Misc';
      const populatedGuidance = [ex.instructions, ex.video_url, ex.equipment, ex.primary_muscles, ex.regressions, ex.progressions, ex.substitutions].filter(Boolean).length;
      return { category, populatedGuidance, stats: exStats[ex.id] };
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
        <div className="card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <button className="btn btn-secondary" onClick={() => setShowMergeReview(false)} style={{ marginBottom: '12px' }}><ArrowLeft size={15} /> Exercises</button>
              <h2 style={{ margin: 0 }}>Duplicate exercise review</h2>
              <p style={{ color: 'var(--text-secondary-dark)', fontSize: '13px', marginBottom: 0 }}>
                Review each suggested fix. Accept consolidates all history into the selected record; Deny hides only that recommendation.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowMergeModal(true)}>Manual merge</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(99,102,241,0.08)' }}><strong>{activeMergeRecommendations.length}</strong><br /><span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Recommended fixes</span></div>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)' }}><strong>{deniedMergeRecommendations.length}</strong><br /><span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Denied</span></div>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)' }}><strong>{acceptedMergeCount}</strong><br /><span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Accepted this session</span></div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button className={`btn ${mergeReviewFilter === 'recommended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMergeReviewFilter('recommended')}>Recommended ({activeMergeRecommendations.length})</button>
            <button className={`btn ${mergeReviewFilter === 'denied' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMergeReviewFilter('denied')}>Denied ({deniedMergeRecommendations.length})</button>
          </div>
        </div>

        {reviewItems.length === 0 ? (
          <div className="card" style={{ padding: '42px 20px', textAlign: 'center' }}>
            <Check size={30} color="var(--success)" style={{ marginBottom: '8px' }} />
            <h3 style={{ margin: '0 0 6px' }}>{mergeReviewFilter === 'recommended' ? 'No recommended fixes remaining' : 'No denied recommendations'}</h3>
            <p style={{ color: 'var(--text-secondary-dark)', fontSize: '13px', margin: 0 }}>
              {mergeReviewFilter === 'recommended' ? 'The current exercise catalog has no unresolved exact-name duplicates.' : 'Denied recommendations can be restored here later.'}
            </p>
          </div>
        ) : reviewItems.map(recommendation => {
          const selectedTargetId = preferredMergeTargets[recommendation.id] || recommendation.target.id;
          const keep = selectedTargetId === recommendation.target.id ? recommendation.target : recommendation.source;
          const remove = keep.id === recommendation.target.id ? recommendation.source : recommendation.target;
          const keepSummary = exerciseSummary(keep);
          const removeSummary = exerciseSummary(remove);
          const busy = reviewMergeBusyId === recommendation.id;

          const recordPanel = (ex: Exercise, summary: ReturnType<typeof exerciseSummary>, role: 'keep' | 'remove') => (
            <div style={{ flex: '1 1 280px', padding: '14px', border: `1px solid ${role === 'keep' ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.35)'}`, borderRadius: '12px', background: role === 'keep' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.035)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: role === 'keep' ? 'var(--success)' : 'var(--danger)', marginBottom: '5px' }}>{role === 'keep' ? 'Keep this record' : 'Merge and remove'}</div>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>{ex.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', marginTop: '2px' }}>Record …{ex.id.slice(-8)}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>{summary.category}</span><span>{getExerciseTypeLabel(ex.exercise_type_id)}</span>
                <span>{summary.stats?.sets ?? 0} sets</span><span>{summary.stats?.workouts ?? 0} workouts</span>
                <span>{summary.populatedGuidance} guidance fields</span>
              </div>
              {summary.stats?.lastUsed && <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '5px' }}>Last used {summary.stats.lastUsed}</div>}
              {ex.aliases && <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '5px' }}>Aliases: {ex.aliases}</div>}
              {ex.notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '5px' }}>{ex.notes}</div>}
            </div>
          );

          return (
            <div className="card" key={recommendation.id} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div><strong>{recommendation.reason}</strong><div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '3px' }}>The record with more history and guidance is selected by default.</div></div>
                <label style={{ fontSize: '12px' }}>Record to keep
                  <select value={selectedTargetId} onChange={(e) => setPreferredMergeTargets(current => ({ ...current, [recommendation.id]: e.target.value }))} style={{ marginLeft: '8px', width: '210px', padding: '6px' }}>
                    <option value={recommendation.target.id}>{recommendation.target.name} · {exStats[recommendation.target.id]?.sets ?? 0} sets · …{recommendation.target.id.slice(-6)}</option>
                    <option value={recommendation.source.id}>{recommendation.source.name} · {exStats[recommendation.source.id]?.sets ?? 0} sets · …{recommendation.source.id.slice(-6)}</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {recordPanel(keep, keepSummary, 'keep')}
                {recordPanel(remove, removeSummary, 'remove')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                {mergeReviewFilter === 'recommended' ? <>
                  <button className="btn btn-secondary" disabled={busy} onClick={() => setMergeDismissed(recommendation.id, true)}>Deny recommendation</button>
                  <button className="btn btn-primary" disabled={busy} onClick={() => acceptMergeRecommendation(recommendation)}>{busy ? 'Merging…' : 'Accept merge'}</button>
                </> : (
                  <button className="btn btn-secondary" onClick={() => setMergeDismissed(recommendation.id, false)}>Restore recommendation</button>
                )}
              </div>
            </div>
          );
        })}

        {showMergeModal && renderMergeModal()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div className="card exercise-database-card">
        <div className="exercise-catalog-header">
          <div className="card-title" style={{ margin: 0 }}><Dumbbell size={16} /> Exercises ({filteredExercises.length})</div>
          <div className="exercise-catalog-controls">
            <button className="btn btn-secondary" onClick={() => setShowMergeReview(true)} title="Review recommended duplicate fixes">
              Review duplicates{activeMergeRecommendations.length > 0 ? ` (${activeMergeRecommendations.length})` : ''}
            </button>
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
      {showMergeModal && renderMergeModal()}

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
