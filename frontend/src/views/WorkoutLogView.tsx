// WorkoutLogView.tsx - The core date-based workout logger: set entry, logged
// sets table (drag to reorder), today's summary with supersets, comments, and
// the plate-loading visualizer.
import {
  TrendingUp, Calculator, Plus, Check, Trash2, GripVertical, X,
  Dumbbell, Layers, Bookmark, Copy, FileText, Timer, Share2, History as HistoryIcon,
  ArrowLeftRight, Square, Play,
} from 'lucide-react';
import { useEffect, useMemo, useState, useRef, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight, weightInUnit } from '../lib/units';
import { aggregateMuscleTargets } from '../lib/muscles';
import { formatSessionSets, getProgressionSuggestion } from '../lib/progression';
import { MuscleDiagramDetails } from '../components/MuscleDiagram';
import { AttentionCard } from '../components/AttentionCard';
import { OverflowMenu } from '../components/OverflowMenu';
import type { RoutineSection } from '../types';
import { addDays } from '../lib/date';

const isGenericSupersetName = (name?: string | null) => /^superset\s+\d+$/i.test((name || '').trim());

const formatElapsed = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

// Start/stop workout duration tracking chip shown in the summary header.
function WorkoutTimerChip() {
  const { workoutTime, handleStartWorkoutTimer, handleStopWorkoutTimer, handleDeleteWorkoutTime } = useFitNotesStore();
  const running = !!workoutTime?.start_time && !workoutTime?.end_time;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!workoutTime?.start_time) {
    return (
      <button className="workout-timer-chip" onClick={() => handleStartWorkoutTimer()} title="Start workout timer">
        <Play size={14} /> Time Workout
      </button>
    );
  }

  if (running) {
    const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(workoutTime.start_time)) / 1000));
    return (
      <button className="workout-timer-chip running" onClick={handleStopWorkoutTimer} title="Stop workout timer">
        <Square size={12} fill="currentColor" /> {formatElapsed(elapsed)}
      </button>
    );
  }

  const duration = workoutTime.duration_seconds ?? 0;
  return (
    <span className="workout-timer-chip finished">
      <Timer size={14} /> {formatElapsed(duration)}
      <button className="workout-timer-chip-action" onClick={() => handleStartWorkoutTimer()} title="Resume workout timer"><Play size={12} /></button>
      <button className="workout-timer-chip-action" onClick={handleDeleteWorkoutTime} title="Remove workout time"><X size={12} /></button>
    </span>
  );
}

// A set as a headline numeral: "45 lb × 8". Weights show in the user's unit.
function SetValue({ log, typeId, userUnit, fallback }: {
  log: { metric_weight: number | null; reps: number | null; unit: number | null; duration_seconds?: number | null };
  typeId: number;
  userUnit: 'kg' | 'lbs';
  fallback: string;
}) {
  const unit = userUnit === 'kg' ? 'kg' : 'lb';
  const weight = typeHasWeight(typeId) && log.metric_weight ? weightInUnit(log.metric_weight, log.unit, userUnit) : null;
  const reps = typeHasReps(typeId) ? log.reps : null;
  if (weight != null && reps != null) {
    return (
      <span className="set-value">
        <span className="sv-num">{weight}</span><span className="sv-unit">{unit}</span>
        <span className="sv-x" aria-hidden="true">×</span>
        <span className="sv-num">{reps}</span>
      </span>
    );
  }
  if (reps != null && weight == null && !typeHasDistance(typeId) && !typeHasDuration(typeId)) {
    return <span className="set-value"><span className="sv-num">{reps}</span><span className="sv-unit">reps</span></span>;
  }
  if (typeHasDuration(typeId) && !typeHasDistance(typeId) && weight == null && log.duration_seconds != null) {
    const minutes = Math.floor(log.duration_seconds / 60);
    const seconds = String(log.duration_seconds % 60).padStart(2, '0');
    return <span className="set-value"><span className="sv-num">{minutes}:{seconds}</span></span>;
  }
  return <span className="set-value sv-text">{fallback}</span>;
}

export function WorkoutLogView() {
  const {
    selectedExercise, setSelectedExercise, userUnit,
    logWeight, setLogWeight, logReps, setLogReps, logDistance, setLogDistance, logDuration, setLogDuration,
    handleAddSet, currentLogs, selectedLogIdsForGroup, setSelectedLogIdsForGroup,
    handleDragEnd, handleToggleComplete, handleDeleteSet, formatLogValue, handleCreateSuperset,
    handleMarkAllComplete, handleMarkExerciseComplete,
    setShowPlateCalc, setShowCommandPalette, setShowRoutineImportModal, setShowCopyWorkoutDrawer,
    setSelectedExIdsForSuperset, setShowSupersetManagerModal,
    workoutGroups, groupExercises, exercises, categories, selectedDate, setSelectedDate, handleClearGroup, allLogs,
    workoutComment, setWorkoutComment, handleSaveComment,
    settings, logComment, setLogComment, logRpe, setLogRpe, logRir, setLogRir, logSetType, setLogSetType, handleCopyPreviousSet, handleClearDay,
    startRestTimer, shareWorkout, triggerToast,
    editingLog, setEditingLog, handleSelectLogForEdit, handleCancelEdit, handleBulkUpdateExerciseSets,
    setHistoryExerciseId,
    workoutRoutines, routines, handleDeleteWorkoutRoutine,
    setReplaceTargetExerciseId,
  } = useFitNotesStore();
  const showComplete = settings.mark_sets_complete;
  const [showEntryModal, setShowEntryModal] = useState(false);
  // Bulk edit mode: the entry form's values apply to every set of the
  // selected exercise on submit instead of adding/updating a single set.
  const [bulkEditMode, setBulkEditMode] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isSwipingRef = useRef<boolean>(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      // Ignore swipes when modals or sidebar are open
      if (
        document.querySelector('.modal-overlay') || 
        document.querySelector('.sheet-overlay, .drawer-scrim')
      ) {
        return;
      }

      // Ignore swipe if started inside interactive element, sets table cells, or drag handles
      const target = e.target as HTMLElement;
      if (
        !target ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('.set-td') ||
        target.closest('[data-rbd-drag-handle-context-id]') ||
        target.closest('.workout-history-btn') ||
        target.closest('.complete-all-icon-btn') ||
        target.closest('.summary-action-btn')
      ) {
        return;
      }

      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      isSwipingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchStart = touchStartRef.current;
      if (!touchStart) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStart.x;
      const diffY = currentY - touchStart.y;

      if (!isSwipingRef.current) {
        if (Math.abs(diffX) > 10) {
          if (Math.abs(diffX) > Math.abs(diffY)) {
            isSwipingRef.current = true;
            grid.classList.add('swiping');
          } else {
            touchStartRef.current = null;
            return;
          }
        } else if (Math.abs(diffY) > 10) {
          touchStartRef.current = null;
          return;
        }
      }

      if (isSwipingRef.current) {
        if (e.cancelable) e.preventDefault();
        grid.style.transform = `translateX(${diffX}px)`;
        grid.style.opacity = String(Math.max(0.5, 1 - Math.abs(diffX) / window.innerWidth));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchStart = touchStartRef.current;
      const isSwiping = isSwipingRef.current;
      touchStartRef.current = null;
      isSwipingRef.current = false;

      if (!touchStart || !isSwiping) return;

      grid.classList.remove('swiping');

      if (e.changedTouches.length !== 1) {
        grid.style.transform = '';
        grid.style.opacity = '';
        return;
      }

      const diffX = e.changedTouches[0].clientX - touchStart.x;
      const threshold = 80;

      if (Math.abs(diffX) > threshold) {
        const direction = diffX > 0 ? 1 : -1;
        
        grid.style.transform = `translateX(${direction * 100}vw)`;
        grid.style.opacity = '0';

        setTimeout(() => {
          const dateChange = direction > 0 ? -1 : 1;
          setSelectedDate((prevDate) => {
            const nextDate = addDays(prevDate, dateChange);
            triggerToast(direction > 0 ? 'Moved back 1 day' : 'Moved forward 1 day');
            return nextDate;
          });

          grid.classList.add('swiping');
          grid.style.transform = `translateX(${-direction * 100}vw)`;
          grid.style.opacity = '0';

          grid.getBoundingClientRect();

          grid.classList.remove('swiping');
          grid.style.transform = 'translateX(0)';
          grid.style.opacity = '1';
        }, 250);
      } else {
        grid.style.transform = '';
        grid.style.opacity = '';
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setSelectedDate, triggerToast]);

  // Routine day-splits linked to the selected date (for the summary badge).
  // Section names live in routine_sections, which isn't global store state.
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  const dayRoutines = workoutRoutines.filter(wr => wr.date === selectedDate && !wr.is_deleted);
  useEffect(() => {
    let cancelled = false;
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(secs => {
        if (cancelled) return;
        const names: Record<string, string> = {};
        for (const s of secs) names[s.id] = s.name;
        setSectionNames(names);
      })
      .catch(e => console.warn('Failed to load routine sections for log badge:', e));
    return () => { cancelled = true; };
  }, [workoutRoutines]);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const selectedExerciseLogs = selectedExercise ? currentLogs.filter(x => x.exercise_id === selectedExercise.id) : [];

  // Progressive-overload hint for the selected exercise (ghost values from the
  // last session + a next-load recommendation).
  const progression = useMemo(() => {
    if (!selectedExercise) return null;
    return getProgressionSuggestion(allLogs, selectedExercise, userUnit, selectedDate);
  }, [allLogs, selectedExercise, userUnit, selectedDate]);

  const applyProgressionSuggestion = () => {
    if (!progression) return;
    if (progression.suggestedWeight != null) setLogWeight(String(progression.suggestedWeight));
    if (progression.suggestedReps != null) setLogReps(String(progression.suggestedReps));
  };
  const selectInputContents = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  useEffect(() => {
    const openComments = () => setShowCommentsModal(true);
    const openSetEntry = () => setShowEntryModal(true);
    window.addEventListener('fitnotes:open-workout-comments', openComments);
    window.addEventListener('fitnotes:open-set-entry', openSetEntry);
    return () => {
      window.removeEventListener('fitnotes:open-workout-comments', openComments);
      window.removeEventListener('fitnotes:open-set-entry', openSetEntry);
    };
  }, []);

  useEffect(() => {
    if (showEntryModal && selectedExercise) {
      setTimeout(() => {
        let inputToFocus: HTMLInputElement | null = null;
        if (typeHasWeight(selectedExercise.exercise_type_id)) {
          inputToFocus = document.getElementById('log-weight-input') as HTMLInputElement;
        } else if (typeHasReps(selectedExercise.exercise_type_id)) {
          inputToFocus = document.getElementById('log-reps-input') as HTMLInputElement;
        } else if (typeHasDistance(selectedExercise.exercise_type_id)) {
          inputToFocus = document.getElementById('log-distance-input') as HTMLInputElement;
        } else if (typeHasDuration(selectedExercise.exercise_type_id)) {
          inputToFocus = document.getElementById('log-duration-min-input') as HTMLInputElement;
        }
        if (inputToFocus) {
          inputToFocus.focus();
          inputToFocus.select();
        }
      }, 50);
    }
  }, [showEntryModal, selectedExercise]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEntryModal) {
          cancelEntry();
          e.stopPropagation();
          e.preventDefault();
        } else if (showCommentsModal) {
          setShowCommentsModal(false);
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showEntryModal, showCommentsModal, editingLog]);

  const submitSet = async () => {
    if (bulkEditMode) {
      await handleBulkUpdateExerciseSets();
      setBulkEditMode(false);
      return;
    }
    await handleAddSet();
  };

  // Enter submits, and while editing it advances to the next logged set of the
  // exercise so a whole session can be corrected without touching the mouse.
  const submitAndAdvance = async () => {
    if (bulkEditMode || !editingLog) {
      await submitSet();
      return;
    }
    const idx = selectedExerciseLogs.findIndex(l => l.id === editingLog.id);
    await handleAddSet();
    const next = idx !== -1 ? selectedExerciseLogs[idx + 1] : undefined;
    if (next) handleSelectLogForEdit(next);
  };

  const handleEntryKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // The global shortcut listener also submits on Enter in logging fields;
      // stop propagation so this handler owns the event (else double-add).
      e.stopPropagation();
      submitAndAdvance();
    }
  };

  const cancelEntry = () => {
    if (editingLog) handleCancelEdit();
    setBulkEditMode(false);
    setShowEntryModal(false);
  };

  const startBulkEdit = () => {
    const first = selectedExerciseLogs[0];
    if (!first) return;
    handleSelectLogForEdit(first); // prefill the form from the first set
    setEditingLog(null); // but stay out of single-set edit mode
    setBulkEditMode(true);
  };

  const openEntryForLog = (log: typeof currentLogs[number]) => {
    setBulkEditMode(false);
    handleSelectLogForEdit(log);
    setShowEntryModal(true);
  };

  const openEntryForExercise = (exercise: typeof exercises[number]) => {
    setBulkEditMode(false);
    setSelectedExercise(exercise);
    setShowEntryModal(true);
  };

  return (
    <div className="workout-grid" ref={gridRef}>
      {/* Left: Active set Logger & comments */}
      <div className="workout-log-input-column">

        {selectedExercise ? (
          <div className="card active-exercise-card" style={{ gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <div className="card-title">
                  <TrendingUp size={18} color="var(--primary)" />
                  {selectedExercise.name}
                </div>
                <div style={{ color: 'var(--text-secondary-dark)', fontSize: '13px', marginTop: '6px' }}>
                  {selectedExerciseLogs.length} set{selectedExerciseLogs.length === 1 ? '' : 's'} logged today
                </div>
                {progression && (
                  <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>
                    Last ({progression.lastSessionDate}): {formatSessionSets(progression.lastSessionSets)} {userUnit}
                  </div>
                )}
              </div>
              <div className="selected-exercise-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => setShowEntryModal(true)}>
                  <Plus size={16} /> Log Set
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCommandPalette(true)}>
                  <Dumbbell size={16} /> Change
                </button>
                <button className="btn btn-secondary" onClick={() => setShowPlateCalc(true)}>
                  <Calculator size={16} /> Plate Calc
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card active-exercise-card" style={{ gap: '20px', padding: '40px 24px', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderStyle: 'dashed' }}>
            <Dumbbell size={48} color="var(--text-secondary-dark)" style={{ opacity: 0.5, marginBottom: '8px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>No Exercise Selected</h3>
            <p style={{ color: 'var(--text-secondary-dark)', fontSize: '14px', maxWidth: '320px', margin: '4px 0 16px 0' }}>
              Select an exercise or load a routine to start logging today's work.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setShowCommandPalette(true)}>
                <Dumbbell size={16} /> Select Exercise
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRoutineImportModal(true)}>
                <Bookmark size={16} /> Load Routine
              </button>
            </div>
          </div>
        )}

        {showEntryModal && selectedExercise && (
          <div className="modal-overlay mobile-modal-overlay" onClick={cancelEntry}>
            <div className="modal-content mobile-modal-content workout-entry-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-modal-header">
                <div>
                  <div className="card-title">
                    <TrendingUp size={18} color="var(--primary)" />
                    {selectedExercise.name}
                  </div>
                  <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>
                    {bulkEditMode ? `Bulk edit all ${selectedExerciseLogs.length} sets` : editingLog ? 'Edit logged set' : 'Add a set'}
                  </div>
                </div>
                <button className="btn btn-secondary icon-btn" onClick={cancelEntry} aria-label="Close set entry">
                  <X size={18} />
                </button>
              </div>

              <div className="mobile-modal-scroll">
            {progression && !editingLog && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px',
                border: '1px solid var(--border-dark)',
                borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '12px',
              }}>
                <div style={{ color: 'var(--text-secondary-dark)' }}>
                  Last session ({progression.lastSessionDate}): {formatSessionSets(progression.lastSessionSets)} {userUnit}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>
                    <TrendingUp size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    {progression.message}
                  </span>
                  {progression.suggestedWeight != null && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={applyProgressionSuggestion}
                    >
                      Use {progression.suggestedWeight} {userUnit}{progression.suggestedReps != null ? ` × ${progression.suggestedReps}` : ''}
                    </button>
                  )}
                </div>
              </div>
            )}
            {(selectedExercise.instructions || selectedExercise.video_url || selectedExercise.regressions || selectedExercise.progressions || selectedExercise.substitutions) && (
              <details style={{ marginBottom: '12px', border: '1px solid var(--border-dark)', borderRadius: 'var(--radius)', padding: '9px 11px', fontSize: '12px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Exercise guidance</summary>
                {selectedExercise.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{selectedExercise.instructions}</p>}
                {selectedExercise.equipment && <p><strong>Equipment:</strong> {selectedExercise.equipment}</p>}
                {selectedExercise.primary_muscles && <p><strong>Muscles:</strong> {selectedExercise.primary_muscles}</p>}
                {selectedExercise.regressions && <p><strong>Regressions:</strong> {selectedExercise.regressions}</p>}
                {selectedExercise.progressions && <p><strong>Progressions:</strong> {selectedExercise.progressions}</p>}
                {selectedExercise.substitutions && <p><strong>Substitutions:</strong> {selectedExercise.substitutions}</p>}
                {selectedExercise.video_url && <a href={selectedExercise.video_url} target="_blank" rel="noreferrer">Open reference video</a>}
              </details>
            )}
            {/* Dynamic inputs based on exercise type */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
              {typeHasWeight(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight ({userUnit})</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogWeight(w => String(Math.max(0, parseFloat(w) - (userUnit === 'kg' ? 2.5 : 5))))} tabIndex={-1}>-</button>
                    <input id="log-weight-input" type="number" value={logWeight} onFocus={selectInputContents} onChange={(e) => setLogWeight(e.target.value)} onKeyDown={handleEntryKeyDown} placeholder="0.0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogWeight(w => String((parseFloat(w) || 0) + (userUnit === 'kg' ? 2.5 : 5)))} tabIndex={-1}>+</button>
                  </div>
                </div>
              )}
              {typeHasReps(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Reps</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogReps(r => String(Math.max(0, parseInt(r) - 1)))} tabIndex={-1}>-</button>
                    <input id="log-reps-input" type="number" value={logReps} onFocus={selectInputContents} onChange={(e) => setLogReps(e.target.value)} onKeyDown={handleEntryKeyDown} placeholder="0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogReps(r => String((parseInt(r) || 0) + 1))} tabIndex={-1}>+</button>
                  </div>
                </div>
              )}
              {typeHasDistance(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Distance ({settings.distance_unit === 2 ? 'mi' : 'km'})</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogDistance(d => String(Math.max(0, parseFloat(d) - 0.5)))} tabIndex={-1}>-</button>
                    <input id="log-distance-input" type="number" value={logDistance} onFocus={selectInputContents} onChange={(e) => setLogDistance(e.target.value)} onKeyDown={handleEntryKeyDown} placeholder="0.0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogDistance(d => String((parseFloat(d) || 0) + 0.5))} tabIndex={-1}>+</button>
                  </div>
                </div>
              )}
              {typeHasDuration(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Duration (min/sec)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input id="log-duration-min-input" type="number" placeholder="Min" style={{ flex: 1, textAlign: 'center' }} onFocus={selectInputContents} onKeyDown={handleEntryKeyDown} onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      const s = parseInt(logDuration) % 60 || 0;
                      setLogDuration((m * 60 + s).toString());
                    }} value={Math.floor(parseInt(logDuration) / 60) || ''} />
                    <input id="log-duration-sec-input" type="number" placeholder="Sec" style={{ flex: 1, textAlign: 'center' }} onFocus={selectInputContents} onKeyDown={handleEntryKeyDown} onChange={(e) => {
                      const m = Math.floor(parseInt(logDuration) / 60) || 0;
                      const s = parseInt(e.target.value) || 0;
                      setLogDuration((m * 60 + s).toString());
                    }} value={parseInt(logDuration) % 60 || ''} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={submitSet} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                  {editingLog || bulkEditMode ? <Check size={18} /> : <Plus size={18} />} {bulkEditMode ? 'Update All Sets' : editingLog ? 'Update Set' : 'Add Set'}
                </button>
                {bulkEditMode && (
                  <button className="btn btn-secondary" onClick={() => setBulkEditMode(false)} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                    Cancel Bulk Edit
                  </button>
                )}
                {editingLog && !bulkEditMode && (
                  <button className="btn btn-secondary" onClick={cancelEntry} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Set comment + quick actions */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select aria-label="Set type" value={logSetType} onChange={(e) => setLogSetType(e.target.value)} style={{ width: '120px', padding: '8px' }}>
                <option value="working">Working</option><option value="warmup">Warm-up</option><option value="amrap">AMRAP</option><option value="failure">Failure</option><option value="drop">Drop set</option>
              </select>
              <input aria-label="RPE" type="number" min="1" max="10" step="0.5" value={logRpe} onChange={(e) => setLogRpe(e.target.value)} onKeyDown={handleEntryKeyDown} placeholder="RPE" style={{ width: '72px', padding: '8px' }} />
              <input aria-label="RIR" type="number" min="0" max="10" step="0.5" value={logRir} onChange={(e) => setLogRir(e.target.value)} onKeyDown={handleEntryKeyDown} placeholder="RIR" style={{ width: '72px', padding: '8px' }} />
              <input
                id="log-comment-input"
                type="text"
                value={logComment}
                onChange={(e) => setLogComment(e.target.value)}
                onKeyDown={handleEntryKeyDown}
                placeholder="Set comment (optional)"
                style={{ flex: 1, minWidth: '160px', padding: '8px' }}
              />
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={handleCopyPreviousSet}>
                Copy Last
              </button>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => startRestTimer(selectedExercise?.default_rest_time || undefined)}>
                <Timer size={14} /> Rest
              </button>
            </div>

            {/* Logged Sets list */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-secondary-dark)', fontWeight: 700, margin: 0 }}>Logged Sets</h3>
                {selectedExerciseLogs.length > 1 && !bulkEditMode && (
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={startBulkEdit}>
                    Edit All Sets
                  </button>
                )}
              </div>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="logged-sets-list">
                  {(provided) => (
                    <table className="set-table" ref={provided.innerRef} {...provided.droppableProps}>
                      <thead>
                        <tr>
                          <th className="set-th" style={{ width: '40px' }}>Select</th>
                          <th className="set-th" style={{ width: '30px' }}></th>
                          <th className="set-th" style={{ width: '60px' }}>Set</th>
                          <th className="set-th">Target logged</th>
                          {showComplete && <th className="set-th" style={{ width: '100px', textAlign: 'center' }}>Complete</th>}
                          <th className="set-th" style={{ width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedExerciseLogs.map((log, index) => (
                          <Draggable key={log.id} draggableId={log.id} index={index}>
                            {(draggableProvided) => (
                              <tr
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={`set-row ${log.is_complete ? 'completed' : ''}`}
                              >
                                <td className="set-td" style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    className="set-select-checkbox"
                                    checked={selectedLogIdsForGroup.includes(log.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedLogIdsForGroup([...selectedLogIdsForGroup, log.id]);
                                      } else {
                                        setSelectedLogIdsForGroup(selectedLogIdsForGroup.filter(id => id !== log.id));
                                      }
                                    }}
                                  />
                                </td>
                                <td className="set-td" style={{ cursor: 'grab', color: 'var(--text-secondary-dark)' }} {...draggableProvided.dragHandleProps}>
                                  <GripVertical size={14} />
                                </td>
                                <td className="set-td" style={{ fontWeight: 700 }}>{index + 1}</td>
                                <td 
                                  className="set-td" 
                                  style={{ fontWeight: 600, cursor: 'pointer' }}
                                  onClick={() => openEntryForLog(log)}
                                  title="Click to edit set"
                                >
                                  {formatLogValue(log, selectedExercise.exercise_type_id)}
                                  {log.comment && <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', fontWeight: 400, marginLeft: '8px' }}>· {log.comment}</span>}
                                </td>
                                {showComplete && (
                                  <td className="set-td" style={{ textAlign: 'center' }}>
                                    <button
                                      className={`set-complete-toggle ${log.is_complete ? 'checked' : ''}`}
                                      onClick={() => handleToggleComplete(log)}
                                      title={log.is_complete ? 'Mark Incomplete' : 'Mark Complete'}
                                      aria-label={log.is_complete ? 'Mark set incomplete' : 'Mark set complete'}
                                    >
                                      <Check size={18} strokeWidth={3} />
                                    </button>
                                  </td>
                                )}
                                <td className="set-td">
                                  <button className="btn" onClick={() => handleDeleteSet(log.id)} style={{ padding: '4px', backgroundColor: 'transparent', color: 'var(--danger)' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </tbody>
                    </table>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            {/* Superset trigger button */}
            {selectedLogIdsForGroup.length > 0 && (
              <div style={{ backgroundColor: 'var(--primary-glow)', padding: '16px', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedLogIdsForGroup.length} sets selected</span>
                <button className="btn btn-primary" onClick={handleCreateSuperset}>
                  <Layers size={14} /> Create Superset Group
                </button>
              </div>
            )}
              </div>
          </div>
          </div>
        )}

        {/* Workout comments */}
        <div className="card workout-comments-card">
          <div className="card-title"><FileText size={16} /> Workout Comments</div>
          <textarea
            value={workoutComment}
            onChange={(e) => setWorkoutComment(e.target.value)}
            placeholder="Enter notes, targets, or mood for today's session..."
            rows={3}
          />
          <button className="btn btn-secondary" onClick={handleSaveComment} style={{ alignSelf: 'flex-end' }}>
            Save Comments
          </button>
        </div>

        {/* Escape the workout grid's transform containing block. */}
        {showCommentsModal && createPortal(
          <div className="modal-overlay" onClick={() => setShowCommentsModal(false)}>
            <div className="modal-content mobile-modal-content workout-comments-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-modal-header">
                <div className="card-title"><FileText size={16} /> Workout Comments</div>
                <button className="btn btn-secondary icon-btn" onClick={() => setShowCommentsModal(false)} aria-label="Close workout comments">
                  <X size={18} />
                </button>
              </div>
              <textarea
                value={workoutComment}
                onChange={(e) => setWorkoutComment(e.target.value)}
                placeholder="Enter notes, targets, or mood for today's session..."
                rows={5}
              />
              <button className="btn btn-primary" onClick={() => { handleSaveComment(); setShowCommentsModal(false); }}>
                Save Comments
              </button>
            </div>
          </div>,
          document.body,
        )}
      </div>

      {/* The day's workout: every exercise as a block of set lines. */}
      <section className="workout-summary" aria-label="Workout">
        <div className="workout-summary-bar">
          <WorkoutTimerChip />
          {dayRoutines.map(wr => {
            const routine = routines.find(r => r.id === wr.routine_id);
            if (!routine) return null;
            const sectionName = wr.routine_section_id ? sectionNames[wr.routine_section_id] : null;
            const label = `${routine.name}${sectionName ? ` · ${sectionName}` : ''}`;
            return (
              <span key={wr.id} className="routine-chip" title="Routine loaded for this day">
                <Bookmark size={14} aria-hidden />
                <span className="routine-chip-label">{label}</span>
                <button type="button" className="routine-chip-x" onClick={() => handleDeleteWorkoutRoutine(wr.id)} aria-label={`Unlink ${label} from this workout`}>
                  <X size={14} aria-hidden />
                </button>
              </span>
            );
          })}
          <span className="workout-summary-spacer" />
          <OverflowMenu
            label="Workout actions"
            items={[
              ...(currentLogs.some(l => !l.is_complete) ? [{ label: 'Complete every set', icon: <Check size={16} aria-hidden />, onSelect: handleMarkAllComplete }] : []),
              { label: 'Copy a past workout', icon: <Copy size={16} aria-hidden />, onSelect: () => setShowCopyWorkoutDrawer(true) },
              { label: 'Plate calculator', icon: <Calculator size={16} aria-hidden />, onSelect: () => setShowPlateCalc(true) },
              ...(currentLogs.length > 0 ? [
                { label: 'Link a superset', icon: <Plus size={16} aria-hidden />, onSelect: () => { setSelectedExIdsForSuperset([]); setShowSupersetManagerModal(true); } },
                { label: 'Share workout', icon: <Share2 size={16} aria-hidden />, onSelect: shareWorkout },
                { label: 'Clear this day', icon: <Trash2 size={16} aria-hidden />, tone: 'danger' as const, onSelect: handleClearDay },
              ] : []),
            ]}
          />
        </div>

        {workoutComment.trim() && (
          <button type="button" className="workout-note" onClick={() => setShowCommentsModal(true)}>
            <FileText size={16} aria-hidden />
            <span>{workoutComment}</span>
          </button>
        )}

        {currentLogs.length === 0 ? (
          <div className="empty-state workout-empty">
            <p className="empty-title">Nothing logged</p>
            <p>Add an exercise, load a routine day, or copy a past workout into this day.</p>
            <div className="empty-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRoutineImportModal(true)}>
                <Bookmark size={16} aria-hidden /> Load routine
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCopyWorkoutDrawer(true)}>
                <Copy size={16} aria-hidden /> Copy a workout
              </button>
            </div>
          </div>
        ) : (
          <div className="ex-blocks">
            {(() => {
              // Superset groups active on this date, keyed by member exercise.
              const activeGroups = workoutGroups.filter(wg => wg.date === selectedDate && !wg.is_deleted);
              const groupMap: Record<string, typeof activeGroups[0]> = {};
              for (const wg of activeGroups) {
                for (const ge of groupExercises.filter(ge => ge.workout_group_id === wg.id && ge.date === selectedDate && !ge.is_deleted)) {
                  groupMap[ge.exercise_id] = wg;
                }
              }

              const firstIndex = (exerciseId: string) => {
                const index = currentLogs.findIndex(l => l.exercise_id === exerciseId);
                return index === -1 ? 999999 : index;
              };

              // One item per standalone exercise or superset, ordered by first set.
              const items: Array<
                | { type: 'superset'; group: typeof activeGroups[0]; exerciseIds: string[]; sortIndex: number }
                | { type: 'exercise'; exerciseId: string; sortIndex: number }
              > = [];
              const addedGroupIds = new Set<string>();
              for (const exId of Array.from(new Set(currentLogs.map(l => l.exercise_id)))) {
                const parentGroup = groupMap[exId];
                if (!parentGroup) {
                  items.push({ type: 'exercise', exerciseId: exId, sortIndex: firstIndex(exId) });
                  continue;
                }
                if (addedGroupIds.has(parentGroup.id)) continue;
                addedGroupIds.add(parentGroup.id);
                const linked = groupExercises
                  .filter(ge => ge.workout_group_id === parentGroup.id && ge.date === selectedDate && !ge.is_deleted)
                  .map(ge => ge.exercise_id);
                items.push({ type: 'superset', group: parentGroup, exerciseIds: linked, sortIndex: Math.min(...linked.map(firstIndex)) });
              }
              items.sort((a, b) => a.sortIndex - b.sortIndex);

              const groupLabelById = new Map<string, string>();
              for (const item of items) {
                if (item.type === 'superset' && isGenericSupersetName(item.group.name) && !groupLabelById.has(item.group.id)) {
                  groupLabelById.set(item.group.id, `Superset ${groupLabelById.size + 1}`);
                }
              }

              const liftOrder: string[] = [];
              for (const item of items) {
                if (item.type === 'exercise') {
                  liftOrder.push(...currentLogs.filter(l => l.exercise_id === item.exerciseId).map(l => l.id));
                  continue;
                }
                const members = [...item.exerciseIds]
                  .sort((a, b) => firstIndex(a) - firstIndex(b))
                  .map(id => currentLogs.filter(l => l.exercise_id === id));
                const rounds = Math.max(0, ...members.map(m => m.length));
                for (let round = 0; round < rounds; round++) {
                  for (const memberLogs of members) if (memberLogs[round]) liftOrder.push(memberLogs[round].id);
                }
              }
              const nextId = liftOrder.find(id => !currentLogs.find(l => l.id === id)?.is_complete);

              const renderExercise = (exerciseId: string) => {
                const ex = exercises.find(x => x.id === exerciseId);
                if (!ex) return null;
                const exLogs = currentLogs.filter(l => l.exercise_id === ex.id);
                const cat = categories.find(c => c.id === ex.category_id);
                const doneCount = exLogs.filter(l => l.is_complete).length;
                const hasUncompleted = exLogs.some(l => !l.is_complete);
                return (
                  <article key={ex.id} className="ex-block" style={{ ['--cat' as string]: cat ? intColorToHex(cat.colour) : 'var(--fg-muted)' }}>
                    <header className="ex-block-head">
                      <button type="button" className="ex-block-name" onClick={() => openEntryForExercise(ex)}>{ex.name}</button>
                      <OverflowMenu
                        label={`${ex.name} actions`}
                        items={[
                          { label: 'Add a set', icon: <Plus size={16} aria-hidden />, onSelect: () => openEntryForExercise(ex) },
                          ...(hasUncompleted && exLogs.length > 1 ? [{ label: 'Complete all sets', icon: <Check size={16} aria-hidden />, onSelect: () => handleMarkExerciseComplete(ex.id) }] : []),
                          { label: 'History & records', icon: <HistoryIcon size={16} aria-hidden />, onSelect: () => setHistoryExerciseId(ex.id) },
                          { label: 'Swap exercise', icon: <ArrowLeftRight size={16} aria-hidden />, onSelect: () => { setReplaceTargetExerciseId(ex.id); setShowCommandPalette(true); } },
                        ]}
                      />
                    </header>
                    <p className="ex-block-meta">
                      <span className="cat-swatch" aria-hidden="true" />
                      {cat?.name || 'Uncategorised'} · {doneCount} of {exLogs.length} done
                    </p>
                    <ol className="set-lines">
                      {exLogs.map((log, index) => (
                        <li key={log.id} className={`set-line${log.is_complete ? ' is-done' : log.id === nextId ? ' is-next' : ' is-later'}${log.is_personal_record ? ' is-pr' : ''}`}>
                          <button
                            type="button"
                            className="set-line-main"
                            onClick={() => openEntryForLog(log)}
                            aria-label={`${ex.name} set ${index + 1}, ${formatLogValue(log, ex.exercise_type_id)}${log.is_complete ? ', done' : log.id === nextId ? ', next up' : ''}. Edit set`}
                          >
                            <span className="set-line-num">Set {index + 1}</span>
                            <SetValue log={log} typeId={ex.exercise_type_id} userUnit={userUnit} fallback={formatLogValue(log, ex.exercise_type_id)} />
                            {!!log.is_personal_record && <span className="pr-tag">PR</span>}
                          </button>
                          <button
                            type="button"
                            className="set-check"
                            aria-pressed={!!log.is_complete}
                            aria-label={`${ex.name} set ${index + 1} done`}
                            onClick={() => handleToggleComplete(log)}
                          >
                            <Check size={22} strokeWidth={3} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ol>
                  </article>
                );
              };

              return items.map(item => {
                if (item.type === 'exercise') return renderExercise(item.exerciseId);
                const wg = item.group;
                const sortedExIds = [...item.exerciseIds].sort((a, b) => firstIndex(a) - firstIndex(b));
                return (
                  <div key={wg.id} className="superset-group" style={{ ['--superset' as string]: intColorToHex(wg.colour) }}>
                    <div className="superset-group-head">
                      <span className="superset-tag">{groupLabelById.get(wg.id) || wg.name || 'Superset'}</span>
                      {!!wg.auto_jump_enabled && <span className="superset-note">alternates sets</span>}
                      <button type="button" className="btn btn-ghost" onClick={() => handleClearGroup(wg.id)}>Unlink</button>
                    </div>
                    {sortedExIds.map(renderExercise)}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Coaching notes come after the workout, never before it. */}
        <AttentionCard />

        {currentLogs.length > 0 && (() => {
          const todayExerciseIds = new Set(currentLogs.filter(l => !l.is_deleted).map(l => l.exercise_id));
          const targets = aggregateMuscleTargets(exercises.filter(ex => todayExerciseIds.has(ex.id)));
          return (
            <MuscleDiagramDetails
              primary={targets.primary}
              secondary={targets.secondary}
              height={195}
              showLegend
            />
          );
        })()}
      </section>
    </div>
  );
}
