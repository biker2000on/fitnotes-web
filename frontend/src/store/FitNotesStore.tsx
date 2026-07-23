// FitNotesStore.tsx - Central app state + actions.
// useFitNotesController() composes the domain slice hooks under ./slices and
// keeps only the cross-domain glue here: hash routing, global keyboard
// shortcuts, the boot/seed effect, refreshData/refreshDateData (which touch
// every domain), and drag-and-drop reordering. It returns the `store` object,
// which is provided via context; view components consume their slice through
// useFitNotesStore().
import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import type { DropResult } from '@hello-pangea/dnd';
import { db, isTauri } from '../storage/db';
import { uuidv4 } from '../lib/uuid';
import { getLocalDateString, addDays } from '../lib/date';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { DEFAULT_CATEGORIES, DEFAULT_EXERCISES } from '../lib/defaultData';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../lib/units';
import type {
  Category, Exercise, TrainingLog, BodyWeight, WorkoutComment,
  WorkoutGroup, WorkoutGroupExercise, Routine, RoutineSection,
  RoutineSectionExercise, RoutineSectionExerciseSet,
  Goal, Measurement, Settings, ExerciseComment, GraphFavourite, CustomUnit,
  WorkoutRoutine, WorkoutTime,
} from '../types';
import { getApiBaseUrl, isAuthExpiredError, VALID_TABS, type TabId } from './slices/shared';
import type { LateDeps } from './slices/types';
import { useUiSlice } from './slices/useUiSlice';
import { useSyncSlice } from './slices/useSyncSlice';
import { useSettingsSlice } from './slices/useSettingsSlice';
import { useExercisesSlice } from './slices/useExercisesSlice';
import { useWorkoutSlice } from './slices/useWorkoutSlice';
import { useCalendarSlice } from './slices/useCalendarSlice';
import { useToolsSlice } from './slices/useToolsSlice';
import { useRoutinesSlice } from './slices/useRoutinesSlice';
import { useBodySlice } from './slices/useBodySlice';
import { useWithingsSlice } from './slices/useWithingsSlice';

const sortLogsByRoutineTemplate = (
  logs: TrainingLog[],
  sections: RoutineSection[],
  sectionExercises: RoutineSectionExercise[],
  exerciseSets: RoutineSectionExerciseSet[],
): TrainingLog[] => {
  const sectionOrderById = new Map(sections.map(section => [section.id, section.sort_order]));
  const sectionExerciseById = new Map(sectionExercises.map(sectionExercise => [sectionExercise.id, sectionExercise]));
  const setOrderById = new Map<string, number>();

  for (const set of exerciseSets) {
    const sectionExercise = sectionExerciseById.get(set.routine_section_exercise_id);
    if (!sectionExercise) continue;
    const sectionOrder = sectionOrderById.get(sectionExercise.routine_section_id) ?? 0;
    setOrderById.set(set.id, sectionOrder * 1_000_000 + sectionExercise.sort_order * 1_000 + set.sort_order);
  }

  const fallbackTime = (log: TrainingLog) => Date.parse((log as TrainingLog & { last_modified?: string }).last_modified ?? '') || 0;

  return [...logs].sort((a, b) => {
    const aOrder = a.routine_section_exercise_set_id ? setOrderById.get(a.routine_section_exercise_set_id) : undefined;
    const bOrder = b.routine_section_exercise_set_id ? setOrderById.get(b.routine_section_exercise_set_id) : undefined;

    if (aOrder !== undefined || bOrder !== undefined) {
      const diff = (aOrder ?? Number.POSITIVE_INFINITY) - (bOrder ?? Number.POSITIVE_INFINITY);
      if (diff !== 0) return diff;
    }

    const timeDiff = fallbackTime(a) - fallbackTime(b);
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
};

let lastKeyPressed = '';
let lastKeyPressTime = 0;

export function useFitNotesController() {
  // Seed the tab from the URL hash so a reload stays on the current route.
  // Starting at 'log' unconditionally made the tab->hash sync effect rewrite
  // the URL to #/log before the hash router could read it.
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'log';
    const hash = window.location.hash.replace(/^#\//, '');
    return (VALID_TABS as readonly string[]).includes(hash) ? (hash as TabId) : 'log';
  });
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Per-exercise history drawer (null = closed)
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);

  const selectedDateRef = useRef<string>(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Late-bound cross-slice dependencies (see ./slices/types.ts). Filled at the
  // bottom of this hook on every render, after all slices have run.
  const late = useRef({} as LateDeps).current;

  const {
    toastMessage, setToastMessage, toastType, setToastType, showToast, setShowToast,
    toastTimerId, setToastTimerId, triggerToast,
    confirmOpen, setConfirmOpen, confirmTitle, setConfirmTitle, confirmMessage, setConfirmMessage,
    confirmOnApprove, setConfirmOnApprove, confirmApproveLabel, setConfirmApproveLabel, confirmTone, setConfirmTone,
    triggerConfirm,
    showCommandPalette, setShowCommandPalette, showShortcutsHelp, setShowShortcutsHelp,
  } = useUiSlice();

  const {
    token, setToken, userEmail, setUserEmail, customApiUrl, updateCustomApiUrl,
    authEmail, setAuthEmail, authPassword, setAuthPassword, authError, setAuthError,
    authLoading, setAuthLoading, syncStatus, setSyncStatus, lastSyncTime, setLastSyncTime,
    importStatus, setImportStatus, exporting, setExporting,
    isAuthenticated, tokenRef, hasLocalChangesRef, localChangeVersionRef, lastPullAtRef,
    loadLastSyncTime, refreshAuthToken, triggerPullSync, triggerSync,
    handleAuth, handleLogout, handleAuthExpired,
    handleBackupUpload, handleBackupDownload, handleCsvDownload,
  } = useSyncSlice({ late, triggerToast, setActiveTab });

  const {
    isLightTheme, setIsLightTheme, userUnit, setUserUnit, settings, setSettings,
    updateSetting, handleUnitChange, displayWeight, toggleTheme,
  } = useSettingsSlice({ late, activeTab });

  const {
    categories, setCategories, exercises, setExercises,
    newExName, setNewExName, newExCategory, setNewExCategory, newExType, setNewExType, newExNotes, setNewExNotes,
    showCatModal, setShowCatModal, newCatName, setNewCatName, newCatColor, setNewCatColor,
    showManageCatsModal, setShowManageCatsModal, editingCategory, setEditingCategory,
    editingCatName, setEditingCatName, editingCatColor, setEditingCatColor,
    showEditExModal, setShowEditExModal, editingExercise, setEditingExercise,
    editExName, setEditExName, editExCategory, setEditExCategory, editExType, setEditExType,
    editExNotes, setEditExNotes, editExWeightIncrement, setEditExWeightIncrement,
    editExDefaultRestTime, setEditExDefaultRestTime, editExWeightUnit, setEditExWeightUnit,
    editExIsFavourite, setEditExIsFavourite, editExGuidance, setEditExGuidance,
    expandedCategories, setExpandedCategories, toggleCategoryExpand,
    handleToggleExerciseFavourite, openExerciseEditor,
    handleCreateExercise, handleCreateCategory, handleUpdateCategory, handleDeleteCategory,
    handleUpdateExercise, handleDeleteExercise, handleMergeExercises,
  } = useExercisesSlice({ late, triggerToast, triggerConfirm, triggerSync, refreshAuthToken, tokenRef });

  const {
    currentLogs, setCurrentLogs, workoutComment, setWorkoutComment,
    workoutTime, setWorkoutTime,
    replaceTargetExerciseId, setReplaceTargetExerciseId,
    workoutGroups, setWorkoutGroups, groupExercises, setGroupExercises,
    workoutRoutines, setWorkoutRoutines, selectedLogIdsForGroup, setSelectedLogIdsForGroup,
    selectedExercise, setSelectedExercise, selectedExerciseRef, workoutCommentRef,
    logWeight, setLogWeight, logReps, setLogReps, logDistance, setLogDistance, logDuration, setLogDuration,
    logComment, setLogComment, logRpe, setLogRpe, logRir, setLogRir, logSetType, setLogSetType,
    editingLog, setEditingLog, exerciseComments, setExerciseComments,
    restRemaining, restPaused, startRestTimer, pauseRestTimer, cancelRestTimer, adjustRestTimer,
    showSupersetManagerModal, setShowSupersetManagerModal, selectedExIdsForSuperset, setSelectedExIdsForSuperset,
    supersetColor, setSupersetColor, supersetName, setSupersetName, targetSupersetGroupId, setTargetSupersetGroupId,
    allLogs, setAllLogs,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, showBulkMoveModal, setShowBulkMoveModal,
    bulkMoveTargetDate, setBulkMoveTargetDate,
    calculateEstimated1RM, getHighest1RM,
    handleAddSet, handleSelectLogForEdit, handleCancelEdit, handleCopyPreviousSet, handleClearDay,
    handleReplaceExercise, handleStartWorkoutTimer, handleStopWorkoutTimer, handleDeleteWorkoutTime,
    saveExerciseComment, handleToggleComplete, handleMarkAllComplete,
    handleMarkExerciseComplete, handleDeleteSet, handleDeleteWorkoutRoutine, handleCopyWorkoutConfirm,
    recordWorkoutRoutine, handleBulkDelete, handleBulkMoveConfirm, handleBulkIncrementWeight, handleBulkIncrementReps,
    formatLogValue, handleSaveComment, shareWorkout,
    handleCreateWorkoutSuperset, handleCreateSuperset, handleClearGroup,
  } = useWorkoutSlice({
    late, triggerToast, triggerConfirm, settings, userUnit, displayWeight,
    selectedDate, selectedDateRef, exercises,
  });

  const {
    showCalendarPreviewModal, setShowCalendarPreviewModal,
    previewDate, setPreviewDate, previewLogs, setPreviewLogs, previewComment, setPreviewComment,
    calendarYear, setCalendarYear, calendarMonth, setCalendarMonth,
    handlePrevMonth, handleNextMonth, handleCalendarDayClick,
  } = useCalendarSlice({ selectedDate, allLogs });

  const {
    graphFavourites, setGraphFavourites, saveGraphFavourite, deleteGraphFavourite,
    customUnits, setCustomUnits, saveCustomUnit, deleteCustomUnit,
    showPlateCalc, setShowPlateCalc, plateCalcTarget, setPlateCalcTarget,
    calculatedPlates, setCalculatedPlates, calculatePlatesSolver,
    analyticExerciseId, setAnalyticExerciseId, analyticMetric, setAnalyticMetric,
  } = useToolsSlice({ userUnit, triggerToast });

  const {
    editingRoutine, setEditingRoutine, editorSections, setEditorSections,
    editorSectionExercises, setEditorSectionExercises, editorExerciseSets, setEditorExerciseSets,
    routines, setRoutines,
    showRoutineImportModal, setShowRoutineImportModal, showCreateRoutineModal, setShowCreateRoutineModal,
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory,
    selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    pastLoggedDates, setPastLoggedDates,
    newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes,
    newRoutineCategory, setNewRoutineCategory,
    activeRoutineForPopulate, setActiveRoutineForPopulate,
    activeSectionForPopulate, setActiveSectionForPopulate,
    editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId,
    showPastImporterModal, setShowPastImporterModal,
    pastImporterTargetSectionId, setPastImporterTargetSectionId, pastImporterDate, setPastImporterDate,
    handleImportRoutinePopulated, handleCreateRoutineSuperset, handleUpdateRoutineGroupName, handleClearRoutineGroup,
    handleCreateRoutineTemplate, handleUpdateRoutineCategory, handleUpdateRoutineDetails, handleDeleteRoutine,
    handleCopyRoutine, handleCreateRoutineVersion, handleImportRoutine,
    loadEditorData, handleAddDayToRoutine, openAddExerciseToSection, openPastImporter,
    handleAddExerciseToSection, handleDeleteExerciseFromSection, handleAddSetToTemplateExercise,
    handleUpdatePopulateSetsType, handleDeleteSetFromTemplateExercise, handleUpdateTemplateSetValues,
    handleUpdateRoutineSectionExercise, handleUpdateSectionSchedule, handleUpdateSectionName, handleDeleteSection,
    handleAddAllSectionLogs, handleImportPastLogsToSection,
  } = useRoutinesSlice({
    late, triggerToast, triggerConfirm, activeTab, setActiveTab,
    selectedDate, selectedDateRef, userUnit, exercises, allLogs,
    workoutGroups, supersetName, supersetColor, getHighest1RM, recordWorkoutRoutine,
  });

  const {
    bodyWeights, setBodyWeights, newWeight, setNewWeight, newFat, setNewFat,
    goals, setGoals, measurements, setMeasurements, measurementRecords, setMeasurementRecords,
    handleAddWeight, saveGoal, deleteGoal, loadMeasurementRecords,
    saveMeasurement, deleteMeasurement, saveMeasurementRecord, deleteMeasurementRecord,
  } = useBodySlice({ late, triggerToast, selectedDate, userUnit });

  const {
    withingsConnected, setWithingsConnected, withingsLastSync, setWithingsLastSync,
    withingsSyncing, setWithingsSyncing,
    fetchWithingsStatus, connectWithings, disconnectWithings, syncWithings,
  } = useWithingsSlice({ token, triggerToast, triggerSync });

  // Global Keyboard Shortcuts Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 0. Chord Navigation Shortcuts (e.g. g then l for Workout Log, g then c for Calendar, etc.)
      const activeEl = document.activeElement;

      // Check if one of the logging fields is focused
      const isLoggingField = activeEl && (
        activeEl.id === 'log-weight-input' ||
        activeEl.id === 'log-reps-input' ||
        activeEl.id === 'log-distance-input' ||
        activeEl.id === 'log-duration-min-input' ||
        activeEl.id === 'log-duration-sec-input' ||
        activeEl.id === 'log-comment-input'
      );

      if (isLoggingField) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSet();
          return;
        }

        if (activeEl.id !== 'log-comment-input') {
          if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            if (activeEl.id === 'log-weight-input') {
              const increment = userUnit === 'kg' ? 2.5 : 5;
              setLogWeight(w => {
                const val = (parseFloat(w) || 0) + increment;
                return String(val);
              });
            } else if (activeEl.id === 'log-reps-input') {
              setLogReps(r => String((parseInt(r) || 0) + 1));
            } else if (activeEl.id === 'log-distance-input') {
              setLogDistance(d => {
                const val = (parseFloat(d) || 0) + 0.1;
                return String(Math.round(val * 10) / 10);
              });
            } else if (activeEl.id === 'log-duration-min-input') {
              setLogDuration(d => {
                const totalSec = parseInt(d) || 0;
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                return String((m + 1) * 60 + s);
              });
            } else if (activeEl.id === 'log-duration-sec-input') {
              setLogDuration(d => {
                const totalSec = parseInt(d) || 0;
                return String(totalSec + 1);
              });
            }
            setTimeout(() => {
              (activeEl as HTMLInputElement).select();
            }, 0);
            return;
          }

          if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            if (activeEl.id === 'log-weight-input') {
              const decrement = userUnit === 'kg' ? 2.5 : 5;
              setLogWeight(w => {
                const val = Math.max(0, (parseFloat(w) || 0) - decrement);
                return String(val);
              });
            } else if (activeEl.id === 'log-reps-input') {
              setLogReps(r => String(Math.max(0, (parseInt(r) || 0) - 1)));
            } else if (activeEl.id === 'log-distance-input') {
              setLogDistance(d => {
                const val = Math.max(0, (parseFloat(d) || 0) - 0.1);
                return String(Math.round(val * 10) / 10);
              });
            } else if (activeEl.id === 'log-duration-min-input') {
              setLogDuration(d => {
                const totalSec = parseInt(d) || 0;
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                return String(Math.max(0, m - 1) * 60 + s);
              });
            } else if (activeEl.id === 'log-duration-sec-input') {
              setLogDuration(d => {
                const totalSec = parseInt(d) || 0;
                return String(Math.max(0, totalSec - 1));
              });
            }
            setTimeout(() => {
              (activeEl as HTMLInputElement).select();
            }, 0);
            return;
          }
        }
      }

      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (!isTyping) {
        const now = Date.now();
        if (lastKeyPressed === 'g' && now - lastKeyPressTime < 1500) {
          const key = e.key.toLowerCase();
          let targetTab: 'log' | 'calendar' | 'exercises' | 'routines' | 'routine-editor' | 'body' | 'measurements' | 'goals' | 'analysis' | 'tools' | 'history' | 'settings' | 'sync' | null = null;

          switch (key) {
            case 'l':
            case 'w':
              targetTab = 'log';
              break;
            case 'c':
              targetTab = 'calendar';
              break;
            case 'e':
              targetTab = 'exercises';
              break;
            case 'r':
              targetTab = 'routines';
              break;
            case 'b':
              targetTab = 'body';
              break;
            case 'm':
              targetTab = 'measurements';
              break;
            case 'g':
              targetTab = 'goals';
              break;
            case 'a':
              targetTab = 'analysis';
              break;
            case 't':
              targetTab = 'tools';
              break;
            case 's':
              targetTab = 'settings';
              break;
            case 'y':
              targetTab = 'sync';
              break;
          }

          if (targetTab) {
            e.preventDefault();
            setActiveTab(targetTab);
            window.location.hash = `#/${targetTab}`;
            triggerToast(`Navigated to ${targetTab.toUpperCase()}`);
            lastKeyPressed = '';
            lastKeyPressTime = 0;
            return;
          }
        }

        if (e.key.toLowerCase() === 'g') {
          lastKeyPressed = 'g';
          lastKeyPressTime = now;
          return;
        }
      }

      // 1. Ctrl + K (or Cmd + K) -> Toggle Command Palette Quick Exercise Search Selector
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      // 2. Escape -> Close all active modals
      if (e.key === 'Escape') {
        setShowShortcutsHelp(false);
        setShowCommandPalette(false);
        setShowRoutineImportModal(false);
        setShowCreateRoutineModal(false);
        setShowCatModal(false);
        setShowManageCatsModal(false);
        setShowEditExModal(false);
        setShowSupersetManagerModal(false);
        setShowCalendarPreviewModal(false);
        setShowPlateCalc(false);
        setConfirmOpen(false);
        setShowBulkMoveModal(false);
        setShowAddExToSectionModal(false);
        setShowPastImporterModal(false);
        setShowCopyWorkoutDrawer(false);
        setActiveRoutineForPopulate(null);
        return;
      }

      // If command palette is open, ignore other hotkeys to avoid conflict
      if (showCommandPalette) return;

      // 3. Ctrl + S -> Save Set (Always allowed, even inside input text fields)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleAddSet();
        return;
      }

      // If actively typing, skip single-key or standard navigation logs shortcuts
      if (isTyping) return;

      // 3.5. ? -> Toggle the keyboard shortcuts reference overlay
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }

      // 3.6. / -> Focus the current view's search/filter input
      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('main input[type="search"]');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      // 4. Ctrl + E -> Load last logged set values into active inputs for quick editing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (currentLogs.length > 0 && selectedExercise) {
          const exLogs = currentLogs.filter(l => l.exercise_id === selectedExercise.id && !l.is_deleted);
          if (exLogs.length > 0) {
            const lastLog = exLogs[exLogs.length - 1];
            if (typeHasWeight(selectedExercise.exercise_type_id) || typeHasReps(selectedExercise.exercise_type_id)) {
              if (lastLog.metric_weight !== null) setLogWeight(lastLog.metric_weight.toString());
              if (lastLog.reps !== null) setLogReps(lastLog.reps.toString());
              setTimeout(() => {
                const wInput = document.getElementById('log-weight-input');
                const repsInput = document.getElementById('log-reps-input');
                const target = wInput || repsInput;
                if (target) {
                  (target as HTMLInputElement).focus();
                  (target as HTMLInputElement).select();
                }
              }, 50);
            }
            if (typeHasDistance(selectedExercise.exercise_type_id) || typeHasDuration(selectedExercise.exercise_type_id)) {
              if (lastLog.distance !== null) setLogDistance(String(settings.distance_unit === 2 ? Math.round((lastLog.distance / 1.60934) * 1000) / 1000 : lastLog.distance));
              if (lastLog.duration_seconds !== null) setLogDuration(lastLog.duration_seconds.toString());
              setTimeout(() => {
                const dInput = document.getElementById('log-distance-input');
                const durationInput = document.getElementById('log-duration-min-input');
                const target = dInput || durationInput;
                if (target) {
                  (target as HTMLInputElement).focus();
                  (target as HTMLInputElement).select();
                }
              }, 50);
            }
            triggerToast('Last logged set loaded into inputs.');
          }
        }
        return;
      }

      // 5. Ctrl + M -> Toggle Plate Load Solver Calculator Modal
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setShowPlateCalc(prev => !prev);
        return;
      }

      // 6. Global Date Navigation Hotkeys (+ / - to increment/decrement, t for today)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const nextDate = addDays(selectedDate, 1);
        setSelectedDate(nextDate);
        triggerToast('Date set to ' + nextDate);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const prevDate = addDays(selectedDate, -1);
        setSelectedDate(prevDate);
        triggerToast('Date set to ' + prevDate);
        return;
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        const todayStr = getLocalDateString();
        setSelectedDate(todayStr);
        triggerToast('Date set to Today (' + todayStr + ')');
        return;
      }

      // 6.5. Global Month Navigation Hotkeys ([ / ] to shift backwards/forwards one month)
      if (e.key === '[') {
        e.preventDefault();
        handlePrevMonth();
        triggerToast('Calendar shifted backwards one month');
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        handleNextMonth();
        triggerToast('Calendar shifted forwards one month');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, selectedExercise, currentLogs, logWeight, logReps, logDistance, logDuration, logComment, editingLog, userUnit, selectedDate, setActiveTab, triggerToast, handlePrevMonth, handleNextMonth]);

  // Lightweight location hash router (History API responsive)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\//, '');
      if ((VALID_TABS as readonly string[]).includes(hash)) {
        setActiveTab(hash as TabId);
      } else {
        setActiveTab('log');
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    // Normalize an invalid/missing hash on mount (state already seeded from it).
    const hash = window.location.hash.replace(/^#\//, '');
    if (!(VALID_TABS as readonly string[]).includes(hash)) {
      window.location.hash = '#/log';
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Synchronize activeTab changes back to URL hash
  useEffect(() => {
    const currentHash = window.location.hash.replace(/^#\//, '');
    if (currentHash !== activeTab) {
      window.location.hash = '#/' + activeTab;
    }
    // Auto-close sliding mobile sidebar drawer on navigation
    setSidebarOpen(false);
    // The exercise history drawer is contextual; navigating to another
    // section should dismiss it rather than letting it shadow the new view.
    setHistoryExerciseId(null);
  }, [activeTab]);

  // Initial Boot Database seed & data loading.
  // Keyed on auth *presence*, not the token value: every token refresh mints a
  // new JWT, and re-running this effect per refresh created a perpetual
  // refresh -> sync -> setToken -> re-run loop.
  useEffect(() => {
    const seedAndLoad = async () => {
      if (isTauri() && isAuthenticated) {
        const syncRows = await db.query<{ key: string; value: string }>("SELECT * FROM settings WHERE key = 'last_sync_timestamp'");
        const localCats = await db.query<Category>('SELECT * FROM categories');
        const localExs = await db.query<Exercise>('SELECT * FROM exercises');
        const localRoutines = await db.query<Routine>('SELECT * FROM routines');

        if (syncRows.length === 0 && localCats.length === 0 && localExs.length === 0 && localRoutines.length === 0) {
          // First launch after sign-in: nothing local to render, so a visible
          // blocking sync is the right call here.
          try {
            setSyncStatus('syncing');
            const refreshedToken = await refreshAuthToken(token);
            await db.sync(refreshedToken, getApiBaseUrl());
            hasLocalChangesRef.current = false;
            localChangeVersionRef.current = 0;
            lastPullAtRef.current = Date.now();
            setSyncStatus('success');
            await refreshData();
            setTimeout(() => setSyncStatus('idle'), 3000);
            return;
          } catch (e) {
            if (isAuthExpiredError(e)) {
              handleAuthExpired();
              return;
            }
            console.warn('Initial Android sync failed:', e);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
          }
        }
      }

      if (isAuthenticated) {
        workoutCommentRef.current = '';
        setWorkoutComment('');
        // Paint local data immediately, then pull from the server in the
        // background; the UI refreshes again only if the pull brought changes.
        await refreshData();
        fetchWithingsStatus();
        triggerPullSync(15_000);
        return;
      }

      // 1. Check if DB has default categories
      const localCats = await db.query<Category>('SELECT * FROM categories');
      if (localCats.length === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await db.execute('INSERT INTO categories', [cat]);
        }
      }

      // 2. Check if DB has default exercises
      const localExs = await db.query<Exercise>('SELECT * FROM exercises');
      if (localExs.length === 0) {
        for (const ex of DEFAULT_EXERCISES) {
          await db.execute('INSERT INTO exercises', [ex]);
        }
      }

      await refreshData();
    };

    seedAndLoad();
  }, [token]);

  const refreshDateData = async (date = selectedDateRef.current) => {
    const logs = await db.query<TrainingLog>('SELECT * FROM training_logs WHERE date = ? AND is_deleted = 0', [date]);
    const comments = await db.query<WorkoutComment>('SELECT * FROM workout_comments WHERE date = ? AND is_deleted = 0', [date]);
    const exComments = await db.query<ExerciseComment>('SELECT * FROM exercise_comments WHERE date = ? AND is_deleted = 0', [date]);
    const workoutTimes = await db.query<WorkoutTime>('SELECT * FROM workout_times');

    if (date !== selectedDateRef.current) return;

    setCurrentLogs(logs);
    setExerciseComments(exComments);
    setSelectedLogIdsForGroup([]);
    setWorkoutTime(workoutTimes.find(wt => wt.date === date && !wt.is_deleted) ?? null);

    const nextComment = comments.length > 0 ? comments[0].comment : '';
    workoutCommentRef.current = nextComment;
    setWorkoutComment(nextComment);
  };

  useEffect(() => {
    refreshDateData(selectedDate).catch(e => console.warn('Failed to refresh selected date data:', e));
  }, [selectedDate]);

  const refreshData = async (date = selectedDateRef.current) => {
    const cats = await db.query<Category>('SELECT * FROM categories');
    const exs = await db.query<Exercise>('SELECT * FROM exercises');
    const rawLogs = await db.query<TrainingLog>('SELECT * FROM training_logs WHERE date = ? AND is_deleted = 0', [date]);
    const allLgs = await db.query<TrainingLog>('SELECT * FROM training_logs');
    const routineSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const routineSectionExercises = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const routineExerciseSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
    const logs = sortLogsByRoutineTemplate(
      rawLogs,
      routineSections.filter(section => !section.is_deleted),
      routineSectionExercises.filter(sectionExercise => !sectionExercise.is_deleted),
      routineExerciseSets.filter(set => !set.is_deleted),
    );
    const weights = await db.query<BodyWeight>('SELECT * FROM body_weights');
    const comments = await db.query<WorkoutComment>('SELECT * FROM workout_comments WHERE date = ? AND is_deleted = 0', [date]);
    const rts = await db.query<Routine>('SELECT * FROM routines');
    const wGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const wGroupExs = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    const wRoutines = await db.query<WorkoutRoutine>('SELECT * FROM workout_routines');
    const gls = await db.query<Goal>('SELECT * FROM goals');
    const meas = await db.query<Measurement>('SELECT * FROM measurements');
    const exComments = await db.query<ExerciseComment>('SELECT * FROM exercise_comments WHERE date = ? AND is_deleted = 0', [date]);
    const isVisibleDate = date === selectedDateRef.current;
    if (isVisibleDate) setExerciseComments(exComments);
    const favs = await db.query<GraphFavourite>('SELECT * FROM graph_favourites');
    setGraphFavourites(favs);
    const cu = await db.query<CustomUnit>('SELECT * FROM custom_units');
    setCustomUnits(cu);

    // Reflect synced settings into the UI prefs, unless there's a pending local
    // change (is_dirty) we haven't pushed yet.
    const settingsRows = await db.query<Settings>('SELECT * FROM settings');
    const s = settingsRows[0];
    if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
    if (s && s.is_dirty !== 1) {
      const serverUnit: 'kg' | 'lbs' = s.metric === false ? 'lbs' : 'kg';
      if (serverUnit !== userUnit) {
        setUserUnit(serverUnit);
        localStorage.setItem('fn_user_unit', serverUnit);
      }
      const serverLight = s.app_theme_id === 1;
      if (serverLight !== isLightTheme) {
        setIsLightTheme(serverLight);
        document.body.classList.toggle('light-theme', serverLight);
      }
    }

    const activeCats = cats.filter(c => !c.is_deleted);
    const activeExercises = exs.filter(ex => !ex.is_deleted);
    const activeRoutines = rts.filter(r => !r.is_deleted);
    const activeMeasurements = meas.filter(m => !m.is_deleted);

    setCategories(activeCats);
    setGoals(gls);
    setMeasurements(activeMeasurements);
    setExercises(activeExercises);
    if (isVisibleDate) setCurrentLogs(logs);
    setAllLogs(allLgs);
    setBodyWeights(weights);
    setRoutines(activeRoutines);
    setWorkoutGroups(wGroups);
    setGroupExercises(wGroupExs);
    setWorkoutRoutines(wRoutines.filter(wr => !wr.is_deleted));

    if (activeCats.length > 0 && !newExCategory) {
      setNewExCategory(activeCats[0].id);
    }

    if (!isVisibleDate) return;

    if (comments.length > 0) {
      if (!workoutCommentRef.current) {
        setWorkoutComment(comments[0].comment);
      }
    } else {
      if (!workoutCommentRef.current) {
        setWorkoutComment('');
      }
    }

    if (exs.length > 0 && !selectedExerciseRef.current) {
      setSelectedExercise(exs[0]);
      setAnalyticExerciseId(exs[0].id);
    }

    await loadLastSyncTime();
  };

  // Drag and Drop sets and templates reordering handler
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    // Case 1: Active Workout Sets
    if (result.source.droppableId === 'logged-sets-list') {
      if (!selectedExercise) return;
      const exerciseId = selectedExercise.id;
      const exLogs = currentLogs.filter(x => x.exercise_id === exerciseId);

      const reordered = Array.from(exLogs);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);

      // High-performance reorder: directly update in localStorage
      const allLogsFromStore = JSON.parse(localStorage.getItem('fn_training_logs') || '[]');

      const otherStoreLogs = allLogsFromStore.filter((l: any) => l.exercise_id !== exerciseId || l.date !== selectedDate);
      const reorderedStoreLogs = reordered.map(l => allLogsFromStore.find((x: any) => x.id === l.id)).filter(Boolean);

      const finalStoreLogs = [...otherStoreLogs, ...reorderedStoreLogs];
      localStorage.setItem('fn_training_logs', JSON.stringify(finalStoreLogs));

      await refreshData();
      triggerToast('Sets reordered.');
      return;
    }

    // Case 2: Routine Days (Sections) Reordering
    if (result.source.droppableId === 'routine-days') {
      if (!editingRoutine) return;
      const reorderedSections = Array.from(editorSections);
      const [removed] = reorderedSections.splice(result.source.index, 1);
      reorderedSections.splice(result.destination.index, 0, removed);

      // Update sort order in db
      let order = 1;
      for (const section of reorderedSections) {
        await db.execute('INSERT INTO routine_sections', [{ ...section, sort_order: order++ }]);
      }

      await loadEditorData(editingRoutine.id);
      triggerToast('Workout days reordered.');
      return;
    }

    // Case 3: Exercises in Routine Day Reordering
    if (result.source.droppableId.startsWith('routine-section-exercises-')) {
      if (!editingRoutine) return;
      const sectionId = result.source.droppableId.replace('routine-section-exercises-', '');
      const secExs = editorSectionExercises.filter(se => se.routine_section_id === sectionId);

      const reorderedExs = Array.from(secExs);
      const [removed] = reorderedExs.splice(result.source.index, 1);
      reorderedExs.splice(result.destination.index, 0, removed);

      let order = 1;
      for (const se of reorderedExs) {
        await db.execute('INSERT INTO routine_section_exercises', [{ ...se, sort_order: order++ }]);
      }

      await loadEditorData(editingRoutine.id);
      triggerToast('Exercises reordered.');
      return;
    }
  };

  // Fill the late-bound cross-slice dependencies for this render (slices only
  // dereference these at call time, never during render).
  late.refreshData = refreshData;
  late.refreshDateData = refreshDateData;
  late.allLogs = allLogs;
  late.setLogWeight = setLogWeight;
  late.setPlateCalcTarget = setPlateCalcTarget;

  // Central store passed to view components via context. Grown as views are extracted.
  // Complete store: every state value, setter, and handler, provided via context.
  const store = {
    activeTab, setActiveTab, isLightTheme, setIsLightTheme, selectedDate, setSelectedDate, sidebarOpen, setSidebarOpen,
    editingRoutine, setEditingRoutine, editorSections, setEditorSections, editorSectionExercises, setEditorSectionExercises,
    editorExerciseSets, setEditorExerciseSets, userUnit, setUserUnit, token, setToken, userEmail, setUserEmail,
    customApiUrl, updateCustomApiUrl, getApiBaseUrl,
    authEmail, setAuthEmail, authPassword, setAuthPassword, authError, setAuthError, authLoading, setAuthLoading, syncStatus, setSyncStatus,
    lastSyncTime, setLastSyncTime,
    importStatus, setImportStatus, exporting, setExporting, categories, setCategories, exercises, setExercises,
    currentLogs, setCurrentLogs, bodyWeights, setBodyWeights, workoutComment, setWorkoutComment, routines, setRoutines,
    workoutTime, handleStartWorkoutTimer, handleStopWorkoutTimer, handleDeleteWorkoutTime,
    replaceTargetExerciseId, setReplaceTargetExerciseId, handleReplaceExercise, handleCopyRoutine, handleCreateRoutineVersion,
    showRoutineImportModal, setShowRoutineImportModal, showCreateRoutineModal, setShowCreateRoutineModal,
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory, selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    pastLoggedDates, setPastLoggedDates, workoutGroups, setWorkoutGroups, groupExercises, setGroupExercises,
    workoutRoutines, setWorkoutRoutines, recordWorkoutRoutine, handleDeleteWorkoutRoutine,
    selectedLogIdsForGroup, setSelectedLogIdsForGroup, newExName, setNewExName, newExCategory, setNewExCategory,
    newExType, setNewExType, newExNotes, setNewExNotes, showCatModal, setShowCatModal, newCatName, setNewCatName,
    newCatColor, setNewCatColor, selectedExercise, setSelectedExercise, logWeight, setLogWeight, logReps, setLogReps,
    logDistance, setLogDistance, logDuration, setLogDuration, showPlateCalc, setShowPlateCalc, plateCalcTarget, setPlateCalcTarget,
    calculatedPlates, setCalculatedPlates, analyticExerciseId, setAnalyticExerciseId, analyticMetric, setAnalyticMetric,
    newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes,
    newRoutineCategory, setNewRoutineCategory, handleUpdateRoutineCategory, handleUpdateRoutineDetails,
    showManageCatsModal, setShowManageCatsModal, editingCategory, setEditingCategory,
    editingCatName, setEditingCatName, editingCatColor, setEditingCatColor, showEditExModal, setShowEditExModal,
    showCommandPalette, setShowCommandPalette, showShortcutsHelp, setShowShortcutsHelp, editingExercise, setEditingExercise, editExName, setEditExName,
    editExCategory, setEditExCategory, editExType, setEditExType, editExNotes, setEditExNotes, editExWeightIncrement, setEditExWeightIncrement,
    editExDefaultRestTime, setEditExDefaultRestTime, editExWeightUnit, setEditExWeightUnit, editExIsFavourite, setEditExIsFavourite,
    editExGuidance, setEditExGuidance,
    showSupersetManagerModal, setShowSupersetManagerModal, selectedExIdsForSuperset, setSelectedExIdsForSuperset,
    supersetColor, setSupersetColor, supersetName, setSupersetName, targetSupersetGroupId, setTargetSupersetGroupId,
    allLogs, setAllLogs, showCalendarPreviewModal, setShowCalendarPreviewModal,
    previewDate, setPreviewDate, previewLogs, setPreviewLogs, previewComment, setPreviewComment, calendarYear, setCalendarYear,
    calendarMonth, setCalendarMonth, toastMessage, setToastMessage, toastType, setToastType, showToast, setShowToast,
    toastTimerId, setToastTimerId, confirmOpen, setConfirmOpen, confirmTitle, setConfirmTitle, confirmMessage, setConfirmMessage,
    confirmOnApprove, setConfirmOnApprove, confirmApproveLabel, setConfirmApproveLabel, confirmTone, setConfirmTone,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, activeRoutineForPopulate, setActiveRoutineForPopulate,
    activeSectionForPopulate, setActiveSectionForPopulate,
    showBulkMoveModal, setShowBulkMoveModal, bulkMoveTargetDate, setBulkMoveTargetDate, expandedCategories, setExpandedCategories,
    editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId, showPastImporterModal, setShowPastImporterModal,
    pastImporterTargetSectionId, setPastImporterTargetSectionId, pastImporterDate, setPastImporterDate, newWeight, setNewWeight,
    newFat, setNewFat, goals, setGoals, measurements, setMeasurements, measurementRecords, setMeasurementRecords,
    withingsConnected, setWithingsConnected, withingsLastSync, setWithingsLastSync, withingsSyncing, setWithingsSyncing,
    fetchWithingsStatus, connectWithings, disconnectWithings, syncWithings,
    historyExerciseId, setHistoryExerciseId, uuidv4,
    settings, updateSetting,
    logComment, setLogComment, logRpe, setLogRpe, logRir, setLogRir, logSetType, setLogSetType, handleCopyPreviousSet, handleClearDay, shareWorkout,
    editingLog, setEditingLog, handleSelectLogForEdit, handleCancelEdit,
    exerciseComments, saveExerciseComment,
    graphFavourites, saveGraphFavourite, deleteGraphFavourite,
    customUnits, saveCustomUnit, deleteCustomUnit,
    restRemaining, restPaused, startRestTimer, pauseRestTimer, cancelRestTimer, adjustRestTimer,
    handleUnitChange, displayWeight, triggerToast, triggerConfirm, calculateEstimated1RM, getHighest1RM, refreshData, toggleTheme,
    handleAuth, handleLogout, triggerSync, handleBackupUpload, handleBackupDownload, handleCsvDownload, handleAddSet, handleToggleComplete, handleDeleteSet,
    handleCopyWorkoutConfirm, handleImportRoutinePopulated, handleBulkDelete, handleBulkMoveConfirm, handleBulkIncrementWeight, handleBulkIncrementReps,
    handleDragEnd, formatLogValue, handleSaveComment, toggleCategoryExpand, handleToggleExerciseFavourite, openExerciseEditor,
    handleMarkAllComplete, handleMarkExerciseComplete,
    handleCreateExercise, handleCreateCategory, handleUpdateCategory, handleDeleteCategory, handleUpdateExercise, handleDeleteExercise, handleMergeExercises,
    handleCalendarDayClick, handlePrevMonth, handleNextMonth, handleCreateWorkoutSuperset, handleCreateSuperset, handleClearGroup,
    handleCreateRoutineSuperset, handleUpdateRoutineGroupName, handleClearRoutineGroup, handleCreateRoutineTemplate, handleDeleteRoutine, handleImportRoutine,
    loadEditorData, handleAddDayToRoutine, openAddExerciseToSection, openPastImporter, handleAddExerciseToSection, handleDeleteExerciseFromSection,
    handleAddSetToTemplateExercise, handleDeleteSetFromTemplateExercise, handleUpdateTemplateSetValues, handleUpdatePopulateSetsType, handleUpdateRoutineSectionExercise, handleUpdateSectionName, handleUpdateSectionSchedule, handleDeleteSection,
    handleAddAllSectionLogs, handleImportPastLogsToSection, handleAddWeight, saveGoal, deleteGoal, loadMeasurementRecords,
    saveMeasurement, deleteMeasurement, saveMeasurementRecord, deleteMeasurementRecord, calculatePlatesSolver,
  };
  return store;
}

export type FitNotesStore = ReturnType<typeof useFitNotesController>;

const FitNotesContext = createContext<FitNotesStore | null>(null);

export function FitNotesProvider({ value, children }: { value: FitNotesStore; children: ReactNode }) {
  return <FitNotesContext.Provider value={value}>{children}</FitNotesContext.Provider>;
}

export function useFitNotesStore(): FitNotesStore {
  const ctx = useContext(FitNotesContext);
  if (!ctx) throw new Error('useFitNotesStore must be used within a FitNotesProvider');
  return ctx;
}
