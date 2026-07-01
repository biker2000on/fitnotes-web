// FitNotesStore.tsx - Central app state + actions.
// useFitNotesController() owns every useState + handler + effect (relocated from
// App.tsx so App is a thin shell). It returns the `store` object, which is provided
// via context; view components consume their slice through useFitNotesStore().
import React, { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import type { DropResult } from '@hello-pangea/dnd';
import { AuthExpiredError, db, isTauri } from '../storage/db';
import { uuidv4 } from '../lib/uuid';
import { getLocalDateString, addDays } from '../lib/date';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { DEFAULT_CATEGORIES, DEFAULT_EXERCISES } from '../lib/defaultData';
import { beep, vibrate, notify } from '../lib/notify';
import { lbsToKg, typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../lib/units';
import { hexToSignedArgb } from '../lib/colors';
import type {
  Category, Exercise, TrainingLog, BodyWeight, WorkoutComment,
  WorkoutGroup, WorkoutGroupExercise, Routine, RoutineSection,
  RoutineSectionExercise, RoutineSectionExerciseSet,
  Goal, Measurement, MeasurementRecord, Settings, ExerciseComment, GraphFavourite, CustomUnit,
  WorkoutRoutine,
} from '../types';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

const isAuthExpiredError = (error: unknown): boolean => {
  if (error instanceof AuthExpiredError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b|unauthorized|invalid or expired token|session expired/i.test(message);
};

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

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('fn_api_base_url');
    if (custom) return custom;
  }
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  if (isTauri()) return 'https://fitnotes.adventureintandem.com';

  if (typeof window === 'undefined') return 'http://localhost:8080';

  const { hostname, port, origin } = window.location;
  const localDevPorts = new Set(['3001', '5173']);
  if (hostname === 'tauri.localhost' || localDevPorts.has(port)) {
    const resolvedHost = hostname === 'tauri.localhost' || !hostname ? 'localhost' : hostname;
    return `http://${resolvedHost}:8080`;
  }

  return origin;
};

const getClientType = () => (isTauri() ? 'mobile' : 'web');

const SYNC_TABLES = [
  'categories',
  'exercises',
  'training_logs',
  'body_weights',
  'plates',
  'barbells',
  'workout_comments',
  'routines',
  'routine_sections',
  'routine_section_exercises',
  'routine_section_exercise_sets',
  'workout_groups',
  'workout_group_exercises',
  'workout_routines',
  'goals',
  'measurements',
  'measurement_records',
  'exercise_comments',
  'workout_times',
  'custom_units',
  'graph_favourites',
] as const;

const VALID_TABS = ['log', 'calendar', 'exercises', 'routines', 'routine-editor', 'body', 'measurements', 'goals', 'analysis', 'tools', 'history', 'settings', 'sync'] as const;
type TabId = typeof VALID_TABS[number];

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
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Routine Editor modular states
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editorSections, setEditorSections] = useState<RoutineSection[]>([]);
  const [editorSectionExercises, setEditorSectionExercises] = useState<RoutineSectionExercise[]>([]);
  const [editorExerciseSets, setEditorExerciseSets] = useState<RoutineSectionExerciseSet[]>([]);

  // User unit preference: kg or lbs
  const [userUnit, setUserUnit] = useState<'kg' | 'lbs'>(() => {
    return (localStorage.getItem('fn_user_unit') as 'kg' | 'lbs') || 'kg';
  });

  // Full settings singleton, loaded from the offline store (synced).
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('fn_settings') : null;
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  // Persist a partial settings change to the singleton so it syncs (last-write-wins).
  const persistSettings = (partial: Record<string, unknown>) => {
    db.execute('UPDATE settings', [partial]).catch(e => console.warn('Failed to persist settings:', e));
  };

  // Update one setting: optimistic local state + persisted (dirty) for sync.
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    persistSettings({ [key]: value });
    if (key === 'metric') {
      const unit = value ? 'kg' : 'lbs';
      setUserUnit(unit as 'kg' | 'lbs');
      localStorage.setItem('fn_user_unit', unit);
    }
    if (key === 'app_theme_id') {
      const light = value === 1;
      setIsLightTheme(light);
      document.body.classList.toggle('light-theme', light);
    }
  };

  // Keep the screen awake during workout logging when enabled (Screen Wake Lock API).
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const want = settings.keep_screen_on && activeTab === 'log';
    if (want && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((s: any) => { sentinel = s; }).catch(() => {});
    }
    return () => { if (sentinel) sentinel.release().catch(() => {}); };
  }, [settings.keep_screen_on, activeTab]);

  const handleUnitChange = (unit: 'kg' | 'lbs') => {
    if (unit === userUnit) return;

    setUserUnit(unit);
    localStorage.setItem('fn_user_unit', unit);
    persistSettings({ metric: unit === 'kg' });

    // Suggest standard conversion weights
    if (unit === 'lbs') {
      setLogWeight(w => String(Math.round(parseFloat(w) * 2.20462) || 135));
      setPlateCalcTarget(t => Math.round(t * 2.20462) || 225);
    } else {
      setLogWeight(w => String(Math.round(parseFloat(w) / 2.20462) || 60));
      setPlateCalcTarget(t => Math.round(t / 2.20462) || 100);
    }
  };

  const displayWeight = (metricWeight: number | null, logUnit: number | null): string => {
    if (metricWeight === null) return '';
    
    // logUnit: 1 = kg, 2 = lbs
    const isLogLbs = logUnit === 2;
    const isPrefLbs = userUnit === 'lbs';
    
    if (isLogLbs === isPrefLbs) {
      return `${metricWeight} ${userUnit}`;
    }
    
    if (isPrefLbs) {
      // Logged in kg, but pref is lbs -> Convert kg to lbs
      const converted = Math.round(metricWeight * 2.20462 * 10) / 10;
      return `${converted} lbs`;
    } else {
      // Logged in lbs, but pref is kg -> Convert lbs to kg
      const converted = Math.round(metricWeight / 2.20462 * 10) / 10;
      return `${converted} kg`;
    }
  };
  
  // Auth state
  const [token, setToken] = useState<string>(localStorage.getItem('fn_token') || '');
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('fn_user_email') || '');
  const [customApiUrl, setCustomApiUrl] = useState<string>(() => {
    return (typeof localStorage !== 'undefined' ? localStorage.getItem('fn_api_base_url') : '') || '';
  });
  const updateCustomApiUrl = (url: string) => {
    const trimmed = url.trim();
    setCustomApiUrl(trimmed);
    if (trimmed) {
      localStorage.setItem('fn_api_base_url', trimmed);
    } else {
      localStorage.removeItem('fn_api_base_url');
    }
  };
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [exporting, setExporting] = useState(false);

  // DB Entities State
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentLogs, setCurrentLogs] = useState<TrainingLog[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [workoutComment, setWorkoutComment] = useState<string>('');
  
  // Routines State
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRoutineImportModal, setShowRoutineImportModal] = useState(false);
  const [showCreateRoutineModal, setShowCreateRoutineModal] = useState(false);
  const [showAddExToSectionModal, setShowAddExToSectionModal] = useState(false);
  const [editorExSearchQuery, setEditorExSearchQuery] = useState('');
  const [editorExSelectedCategory, setEditorExSelectedCategory] = useState<string | null>(null);
  const [selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset] = useState<string[]>([]);
  const [pastLoggedDates, setPastLoggedDates] = useState<string[]>([]);

  // Supersets / Workout Groups State
  const [workoutGroups, setWorkoutGroups] = useState<WorkoutGroup[]>([]);
  const [groupExercises, setGroupExercises] = useState<WorkoutGroupExercise[]>([]);
  // Routine-to-day completion links
  const [workoutRoutines, setWorkoutRoutines] = useState<WorkoutRoutine[]>([]);
  const [selectedLogIdsForGroup, setSelectedLogIdsForGroup] = useState<string[]>([]);
  
  // Exercise creation form
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExType, setNewExType] = useState('0'); // 0: Weight & Reps
  const [newExNotes, setNewExNotes] = useState('');

  // Category creation form
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Selected Log State
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [logWeight, setLogWeight] = useState('60');
  const [logReps, setLogReps] = useState('10');
  const [logDistance, setLogDistance] = useState('5');
  const [logDuration, setLogDuration] = useState('30');
  const [logComment, setLogComment] = useState('');
  const [editingLog, setEditingLog] = useState<TrainingLog | null>(null);
  const [exerciseComments, setExerciseComments] = useState<ExerciseComment[]>([]);
  const [graphFavourites, setGraphFavourites] = useState<GraphFavourite[]>([]);
  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);

  const selectedExerciseRef = useRef<Exercise | null>(null);
  const workoutCommentRef = useRef<string>('');
  const selectedDateRef = useRef<string>(selectedDate);

  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
  }, [selectedExercise]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    workoutCommentRef.current = workoutComment;
  }, [workoutComment]);

  const saveGraphFavourite = async (fav: GraphFavourite) => {
    await db.execute('INSERT INTO graph_favourites', [fav]);
    setGraphFavourites(await db.query<GraphFavourite>('SELECT * FROM graph_favourites'));
    triggerToast('Graph saved to favourites!');
  };
  const deleteGraphFavourite = async (id: string) => {
    const f = graphFavourites.find(x => x.id === id);
    if (f) await db.execute('UPDATE graph_favourites', [{ ...f, is_deleted: true }]);
    setGraphFavourites(await db.query<GraphFavourite>('SELECT * FROM graph_favourites'));
  };
  const saveCustomUnit = async (u: CustomUnit) => {
    await db.execute('INSERT INTO custom_units', [u]);
    setCustomUnits(await db.query<CustomUnit>('SELECT * FROM custom_units'));
    triggerToast('Custom unit saved!');
  };
  const deleteCustomUnit = async (id: string) => {
    const u = customUnits.find(x => x.id === id);
    if (u) await db.execute('UPDATE custom_units', [{ ...u, is_deleted: true }]);
    setCustomUnits(await db.query<CustomUnit>('SELECT * FROM custom_units'));
  };

  // Rest timer (seconds remaining; null = inactive).
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restPaused, setRestPaused] = useState(false);
  const startRestTimer = (seconds?: number) => { setRestRemaining(seconds ?? settings.rest_timer_seconds); setRestPaused(false); };
  const pauseRestTimer = () => setRestPaused(p => !p);
  const cancelRestTimer = () => { setRestRemaining(null); setRestPaused(false); };
  const adjustRestTimer = (delta: number) => setRestRemaining(r => (r == null ? r : Math.max(0, r + delta)));

  useEffect(() => {
    if (restRemaining === null || restPaused) return;
    if (restRemaining <= 0) {
      if (settings.rest_timer_sound) beep(settings.rest_timer_volume);
      if (settings.rest_timer_vibrate) vibrate();
      notify('Rest complete', 'Time for your next set');
      setRestRemaining(null);
      return;
    }
    const id = setTimeout(() => setRestRemaining(r => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [restRemaining, restPaused]);

  // Plate Calculator State
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [plateCalcTarget, setPlateCalcTarget] = useState(100);
  const [calculatedPlates, setCalculatedPlates] = useState<Array<{ weight: number; count: number; color: string }>>([]);

  // Analytics graph selection
  const [analyticExerciseId, setAnalyticExerciseId] = useState<string>('');
  const [analyticMetric, setAnalyticMetric] = useState<'volume' | 'maxWeight' | 'estimated1RM'>('volume');

  // Routine templates creation states
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineNotes, setNewRoutineNotes] = useState('');
  const [routineCreatorExercises, setRoutineCreatorExercises] = useState<Array<{ exercise_id: string; weight: string; reps: string; sort_order: number }>>([]);
  const [selectedExForRoutine, setSelectedExForRoutine] = useState('');

  // Manage Categories modal states
  const [showManageCatsModal, setShowManageCatsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState('#6366f1');

  // Edit Exercise modal states
  const [showEditExModal, setShowEditExModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExCategory, setEditExCategory] = useState('');
  const [editExType, setEditExType] = useState('1');
  const [editExNotes, setEditExNotes] = useState('');
  const [editExWeightIncrement, setEditExWeightIncrement] = useState('2.5');
  const [editExDefaultRestTime, setEditExDefaultRestTime] = useState('90');
  const [editExWeightUnit, setEditExWeightUnit] = useState('1');
  const [editExIsFavourite, setEditExIsFavourite] = useState(false);

  // Superset Manager modal states
  const [showSupersetManagerModal, setShowSupersetManagerModal] = useState(false);
  const [selectedExIdsForSuperset, setSelectedExIdsForSuperset] = useState<string[]>([]);
  const [supersetColor, setSupersetColor] = useState('#ef4444');
  const [supersetName, setSupersetName] = useState('Superset');
  const [targetSupersetGroupId, setTargetSupersetGroupId] = useState('');

  // Calendar day preview modal states
  const [allLogs, setAllLogs] = useState<TrainingLog[]>([]);
  const [showCalendarPreviewModal, setShowCalendarPreviewModal] = useState(false);
  const [previewDate, setPreviewDate] = useState('');
  const [previewLogs, setPreviewLogs] = useState<TrainingLog[]>([]);
  const [previewComment, setPreviewComment] = useState<string>('');

  // Calendar Navigation State
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11

  // Auto-sync calendar view with selected date changes
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        if (!isNaN(year) && !isNaN(month)) {
          if (year !== calendarYear || month !== calendarMonth) {
            setCalendarYear(year);
            setCalendarMonth(month);
          }
        }
      }
    }
  }, [selectedDate]);

  // Toast notifications states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  const [toastTimerId, setToastTimerId] = useState<any>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerId) clearTimeout(toastTimerId);
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    const timer = setTimeout(() => {
      setShowToast(false);
    }, 3000);
    setToastTimerId(timer);
  };

  // Custom confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOnApprove, setConfirmOnApprove] = useState<(() => void) | null>(null);
  const [confirmApproveLabel, setConfirmApproveLabel] = useState('Confirm');
  const [confirmTone, setConfirmTone] = useState<'default' | 'danger'>('default');

  const triggerConfirm = (
    title: string,
    msg: string,
    onApprove: () => void,
    options: { approveLabel?: string; tone?: 'default' | 'danger' } = {},
  ) => {
    setConfirmTitle(title);
    setConfirmMessage(msg);
    setConfirmOnApprove(() => onApprove);
    setConfirmApproveLabel(options.approveLabel || 'Confirm');
    setConfirmTone(options.tone || 'default');
    setConfirmOpen(true);
  };

  // Premium Features States (Phases 10-13)
  const [showCopyWorkoutDrawer, setShowCopyWorkoutDrawer] = useState(false);
  const [activeRoutineForPopulate, setActiveRoutineForPopulate] = useState<Routine | null>(null);
  const [activeSectionForPopulate, setActiveSectionForPopulate] = useState<RoutineSection | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTargetDate, setBulkMoveTargetDate] = useState<string>(selectedDate);

  // 1-Rep Max Math helpers for Routines Populator
  const calculateEstimated1RM = (weight: number, reps: number) => {
    if (reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight / (1.0278 - 0.0278 * reps);
  };

  const getHighest1RM = (exerciseId: string, beforeDate?: string) => {
    const activeExLogs = allLogs.filter(l =>
      l.exercise_id === exerciseId &&
      !l.is_deleted &&
      l.metric_weight &&
      l.reps &&
      (!beforeDate || l.date < beforeDate)
    );
    if (activeExLogs.length === 0) return 0;
    
    let max1RM = 0;
    for (const log of activeExLogs) {
      const w = log.metric_weight || 0;
      const r = log.reps || 0;
      const oneRM = calculateEstimated1RM(w, r);
      if (oneRM > max1RM) {
        max1RM = oneRM;
      }
    }
    return max1RM;
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

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
  const isAuthenticated = Boolean(token);
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

    if (date !== selectedDateRef.current) return;

    setCurrentLogs(logs);
    setExerciseComments(exComments);
    setSelectedLogIdsForGroup([]);

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
      setSelectedExForRoutine(exs[0].id);
    }

    await loadLastSyncTime();
  };

  const loadLastSyncTime = async () => {
    if (isTauri()) {
      try {
        const rows = await db.query<{ key: string; value: string }>("SELECT * FROM settings WHERE key = 'last_sync_timestamp'");
        if (rows.length > 0) {
          setLastSyncTime(rows[0].value);
        }
      } catch (e) {
        console.warn("Failed to query last sync timestamp from SQLite:", e);
      }
    } else {
      setLastSyncTime(localStorage.getItem('fn_last_sync_timestamp') || '');
    }
  };

  // Debounced Auto-Sync Setup
  const syncTimeoutRef = useRef<any>(null);
  const syncInFlightRef = useRef(false);
  const syncAgainAfterCurrentRef = useRef(false);
  const tokenRef = useRef(token);
  const hasLocalChangesRef = useRef(false);
  const localChangeVersionRef = useRef(0);
  const lastAutoSyncAttemptRef = useRef(0);
  const lastPullAtRef = useRef(0);
  const lastTokenRefreshAtRef = useRef(0);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const refreshAuthToken = async (currentToken = tokenRef.current, opts: { force?: boolean } = {}): Promise<string> => {
    if (!currentToken) return '';

    // Tokens live for days (7d web / 180d mobile); don't burn a network round
    // trip on every background sync. A stale token still gets one forced
    // refresh-and-retry inside triggerSync before the session is declared dead.
    const now = Date.now();
    if (!opts.force && now - lastTokenRefreshAtRef.current < 10 * 60_000) {
      return currentToken;
    }

    try {
      const refreshUrl = new URL(`${getApiBaseUrl()}/api/auth/refresh`);
      refreshUrl.searchParams.set('client', getClientType());

      const res = await fetch(refreshUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (res.status === 401) {
        throw new AuthExpiredError();
      }

      if (!res.ok) {
        return currentToken;
      }

      const data = await res.json();
      lastTokenRefreshAtRef.current = now;
      if (data?.token) {
        tokenRef.current = data.token;
        setToken(data.token);
        localStorage.setItem('fn_token', data.token);
      }
      if (data?.user?.email) {
        setUserEmail(data.user.email);
        localStorage.setItem('fn_user_email', data.user.email);
      }

      return data?.token || currentToken;
    } catch (e) {
      if (isAuthExpiredError(e)) throw e;
      console.warn('Token refresh skipped:', e);
      return currentToken;
    }
  };

  const hasPendingLocalChanges = async () => {
    if (hasLocalChangesRef.current) return true;
    for (const table of SYNC_TABLES) {
      const rows = await db.query<any>(`SELECT * FROM ${table}`);
      if (rows.some(row => row?.is_dirty === 1 || row?.is_dirty === true)) {
        hasLocalChangesRef.current = true;
        return true;
      }
    }
    const settingsRows = await db.query<any>('SELECT * FROM settings');
    if (settingsRows.some(row => row?.is_dirty === 1 || row?.is_dirty === true)) {
      hasLocalChangesRef.current = true;
      return true;
    }
    return false;
  };

  const triggerAutoSync = async (options: { debounceMs?: number; ignoreInterval?: boolean } = {}) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const now = Date.now();
    if (!options.ignoreInterval && now - lastAutoSyncAttemptRef.current < 10_000) {
      return;
    }

    if (!(await hasPendingLocalChanges())) return;
    lastAutoSyncAttemptRef.current = now;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      triggerSync();
    }, options.debounceMs ?? 5000);
  };

  // Background pull: keeps this device current with edits made on other
  // devices. The protocol is a delta sync (changes since last_sync_timestamp),
  // so these calls are cheap; the throttle just avoids hammering on rapid
  // focus/visibility events. Runs silently - no spinner, no error flash.
  const triggerPullSync = (minIntervalMs = 60_000) => {
    if (!tokenRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (Date.now() - lastPullAtRef.current < minIntervalMs) return;
    triggerSync({ background: true });
  };

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Central change listener for all DB operations
  useEffect(() => {
    if (!token) return;
    const unsubscribe = db.onChange(() => {
      hasLocalChangesRef.current = true;
      localChangeVersionRef.current += 1;
      triggerAutoSync();
    });
    return unsubscribe;
  }, [token]);

  // Keep devices in step without manual syncing, while staying snappy:
  // - reconnect: push pending edits and pull whatever happened while offline
  // - focus/visibility: throttled background pull when returning to the app
  // - interval: slow heartbeat pull while the app stays open
  // All pulls are silent delta syncs and never block interaction.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      triggerAutoSync({ debounceMs: 1000, ignoreInterval: true });
      triggerPullSync(5_000);
    };

    const handleFocus = () => {
      triggerPullSync(60_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerPullSync(60_000);
    };

    // Heartbeat doubles as resume detection: Android freezes the app (and its
    // timers) in the background, so a tick that arrives far later than
    // scheduled means the app just returned to the foreground - pull promptly.
    const HEARTBEAT_MS = 20_000;
    let lastTickAt = Date.now();
    const heartbeat = setInterval(() => {
      const now = Date.now();
      const wasSuspended = now - lastTickAt > HEARTBEAT_MS * 3;
      lastTickAt = now;
      // Tauri's Android WebView reports document.visibilityState as 'hidden'
      // even while foregrounded; rely on suspension detection there instead.
      if (!isTauri() && document.visibilityState !== 'visible') return;
      triggerPullSync(wasSuspended ? 30_000 : 150_000);
    }, HEARTBEAT_MS);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Android delivers no focus/visibilitychange to the WebView on activity
    // resume; the Tauri shell emits this from the native Resumed event.
    let unlistenResume: (() => void) | undefined;
    let disposed = false;
    if (isTauri()) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => listen('app-resumed', () => triggerPullSync(30_000)))
        .then((unlisten) => {
          if (disposed) unlisten();
          else unlistenResume = unlisten;
        })
        .catch((e) => console.warn('Failed to attach app-resumed listener:', e));
    }

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      if (unlistenResume) unlistenResume();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  // Theme Toggle
  const toggleTheme = () => {
    const nextLight = !isLightTheme;
    setIsLightTheme(nextLight);
    document.body.classList.toggle('light-theme', nextLight);
    persistSettings({ app_theme_id: nextLight ? 1 : 0 });
  };

  // Auth logins
  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Please fill out all credentials');
      return;
    }

    setAuthLoading(true);
    try {
      const endpoint = mode === 'login' ? 'login' : 'register';
      const apiBaseUrl = getApiBaseUrl();

      const res = await fetch(`${apiBaseUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          client_type: getClientType(),
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setToken(data.token);
      setUserEmail(data.user.email);
      localStorage.setItem('fn_token', data.token);
      localStorage.setItem('fn_user_email', data.user.email);

      // Invalidate cache: prune previously synced data while preserving local guest offline modifications
      await db.invalidateCache(true);

      setAuthEmail('');
      setAuthPassword('');

      // Complete the first cloud sync before leaving the auth screen so mobile
      // users can see progress while a large account dataset is loading.
      setSyncStatus('syncing');
      await db.sync(data.token, apiBaseUrl);
      hasLocalChangesRef.current = false;
      localChangeVersionRef.current = 0;
      lastPullAtRef.current = Date.now();
      setSyncStatus('success');
      await refreshData();
      setActiveTab('log');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      console.error("Authentication failed:", e);
      setSyncStatus('error');
      setAuthError('Connection to API server failed: ' + (e?.message || String(e)));
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setAuthLoading(false);
    }
  };

  const clearSession = (preserveDirty: boolean) => {
    setToken('');
    tokenRef.current = '';
    setUserEmail('');
    localStorage.removeItem('fn_token');
    localStorage.removeItem('fn_user_email');
    localStorage.removeItem('fn_last_sync_timestamp');
    db.invalidateCache(preserveDirty).catch(e => console.warn("Failed to clear database on logout:", e));
  };

  const handleLogout = () => {
    clearSession(false);
  };

  const handleAuthExpired = () => {
    clearSession(true);
    setSyncStatus('error');
    triggerToast('Session expired. Sign in again to continue syncing.', 'error');
    setActiveTab('sync');
  };

  // Synchronize. Background mode runs silently (no spinner, no error flash)
  // and skips the post-sync UI refresh when the server had nothing new.
  const triggerSync = async (options: { background?: boolean } = {}) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    if (syncInFlightRef.current) {
      syncAgainAfterCurrentRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    const background = options.background === true;
    const syncedChangeVersion = localChangeVersionRef.current;
    if (!background) setSyncStatus('syncing');
    try {
      const apiBaseUrl = getApiBaseUrl();
      const refreshedToken = await refreshAuthToken(activeToken);

      let pulled: number | null = null;
      try {
        pulled = await db.sync(refreshedToken, apiBaseUrl);
      } catch (e) {
        if (!isAuthExpiredError(e)) throw e;
        // The throttled token may have gone stale; force one refresh and
        // retry before treating the session as expired.
        const forcedToken = await refreshAuthToken(tokenRef.current, { force: true });
        pulled = await db.sync(forcedToken, apiBaseUrl);
      }

      if (localChangeVersionRef.current === syncedChangeVersion) {
        hasLocalChangesRef.current = false;
      }
      lastPullAtRef.current = Date.now();
      if (!background) setSyncStatus('success');
      if (pulled !== 0) {
        await refreshData();
      } else {
        await loadLastSyncTime();
      }
      if (!background) setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      if (isAuthExpiredError(e)) {
        handleAuthExpired();
        return;
      }
      if (background) {
        console.warn('Background sync failed:', e);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    } finally {
      syncInFlightRef.current = false;
      if (syncAgainAfterCurrentRef.current && tokenRef.current) {
        syncAgainAfterCurrentRef.current = false;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          triggerSync();
        }, typeof navigator !== 'undefined' && navigator.onLine === false ? 5000 : 250);
      }
    }
  };

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const confirmImport = window.confirm(
      "Are you sure you want to import this FitNotes backup? This will wipe your current database and local data and replace it with the backup content."
    );
    if (!confirmImport) {
      e.target.value = '';
      return;
    }

    setImportStatus('importing');
    try {
      const apiBaseUrl = getApiBaseUrl();

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBaseUrl}/api/import-fitnotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import backup database');
      }

      // Success! Clear local cache keys
      const keysToClear = [
        'fn_categories',
        'fn_exercises',
        'fn_training_logs',
        'fn_body_weights',
        'fn_plates',
        'fn_barbells',
        'fn_workout_comments',
        'fn_workout_groups',
        'fn_workout_group_exercises',
        'fn_workout_routines',
        'fn_routines',
        'fn_routine_sections',
        'fn_routine_section_exercises',
        'fn_routine_section_exercise_sets',
        'fn_last_sync_timestamp'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));

      setImportStatus('success');
      
      // Perform full-history synchronization to pull all migrated records from server
      setSyncStatus('syncing');
      await db.sync(token, apiBaseUrl);
      hasLocalChangesRef.current = false;
      localChangeVersionRef.current = 0;
      lastPullAtRef.current = Date.now();
      setSyncStatus('success');
      await refreshData();
      setTimeout(() => setSyncStatus('idle'), 3000);

      setTimeout(() => setImportStatus('idle'), 5000);
    } catch (err: any) {
      console.error(err);
      setImportStatus('error');
      alert(`Import failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setImportStatus('idle'), 5000);
    } finally {
      e.target.value = '';
    }
  };

  const handleBackupDownload = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/export-fitnotes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate export database');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      a.download = `FitNotes_Backup_${timestamp}.fitnotes`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCsvDownload = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/export-csv`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to generate CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FitNotes_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      triggerToast(`CSV export failed: ${err.message || 'error'}`, 'error');
    }
  };

  // Log Mutators
  // Weighted sets PR by heavier weight at the same reps; bodyweight sets PR by max reps.
  const isNewPR = (exerciseId: string, typeId: number, weight: number | null, reps: number | null): boolean => {
    if (!settings.track_personal_records || !reps) return false;
    const isWeightedSet = typeHasWeight(typeId) && (weight ?? 0) > 0;

    if (isWeightedSet) {
      const priorBest = allLogs
        .filter(l => l.exercise_id === exerciseId && !l.is_deleted && l.reps === reps && (l.metric_weight ?? 0) > 0)
        .reduce((m, l) => Math.max(m, l.metric_weight as number), 0);
      return (weight as number) > priorBest;
    }

    if (!typeHasReps(typeId)) return false;
    const priorBestReps = allLogs
      .filter(l => l.exercise_id === exerciseId && !l.is_deleted && (l.metric_weight ?? 0) <= 0)
      .reduce((m, l) => Math.max(m, l.reps ?? 0), 0);
    return reps > priorBestReps;
  };

  const handleAddSet = async () => {
    if (!selectedExercise) return;
    const t = selectedExercise.exercise_type_id;
    const weight = typeHasWeight(t) ? (parseFloat(logWeight) || null) : null;
    const reps = typeHasReps(t) ? (parseInt(logReps) || null) : null;
    const distance = typeHasDistance(t) ? (logDistance ? (parseFloat(logDistance) * (settings.distance_unit === 2 ? 1.60934 : 1)) : null) : null;
    const duration = typeHasDuration(t) ? (parseInt(logDuration) || null) : null;
    const pr = isNewPR(selectedExercise.id, t, weight, reps);

    if (editingLog) {
      const updatedLog: TrainingLog = {
        ...editingLog,
        metric_weight: weight,
        reps,
        unit: userUnit === 'kg' ? 1 : 2,
        is_personal_record: pr,
        distance,
        duration_seconds: duration,
        comment: logComment || null,
      };
      await db.execute('UPDATE training_logs', [updatedLog]);
      setEditingLog(null);
      setLogComment('');
      await refreshData();
      triggerToast('Set updated.');
      return;
    }

    const newLog: TrainingLog = {
      id: uuidv4(),
      exercise_id: selectedExercise.id,
      date: selectedDate,
      metric_weight: weight,
      reps,
      unit: userUnit === 'kg' ? 1 : 2,
      is_personal_record: pr,
      is_complete: false,
      distance,
      duration_seconds: duration,
      comment: logComment || null,
    };

    await db.execute('INSERT INTO training_logs', [newLog]);
    if (newLog.date === selectedDateRef.current) {
      setCurrentLogs(prev => [...prev, newLog]);
    }
    setAllLogs(prev => [...prev.filter(l => l.id !== newLog.id), newLog]);
    setLogComment('');
    await refreshData(newLog.date);
    if (pr) triggerToast(`New PR! ${selectedExercise.name}`, 'success');
    if (settings.rest_timer_auto_start) {
      startRestTimer(selectedExercise.default_rest_time || settings.rest_timer_seconds);
    }
  };

  const handleSelectLogForEdit = (log: TrainingLog) => {
    const ex = exercises.find(x => x.id === log.exercise_id);
    if (!ex) return;
    setSelectedExercise(ex);
    setEditingLog(log);

    if (log.metric_weight !== null) {
      if (log.unit === 1 && userUnit === 'lbs') {
        setLogWeight(String(Math.round(log.metric_weight * 2.20462 * 10) / 10));
      } else if (log.unit === 2 && userUnit === 'kg') {
        setLogWeight(String(Math.round(log.metric_weight / 2.20462 * 10) / 10));
      } else {
        setLogWeight(String(log.metric_weight));
      }
    } else {
      setLogWeight('');
    }

    if (log.reps !== null) {
      setLogReps(String(log.reps));
    } else {
      setLogReps('');
    }

    if (log.distance !== null) {
      setLogDistance(String(settings.distance_unit === 2 ? Math.round((log.distance / 1.60934) * 1000) / 1000 : log.distance));
    } else {
      setLogDistance('');
    }

    if (log.duration_seconds !== null) {
      setLogDuration(String(log.duration_seconds));
    } else {
      setLogDuration('');
    }

    setLogComment(log.comment || '');

    // Focus the first relevant input
    setTimeout(() => {
      const wInput = document.getElementById('log-weight-input');
      const rInput = document.getElementById('log-reps-input');
      const dInput = document.getElementById('log-distance-input');
      const minInput = document.getElementById('log-duration-min-input');
      const target = wInput || rInput || dInput || minInput;
      if (target) {
        (target as HTMLInputElement).focus();
        (target as HTMLInputElement).select();
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setLogComment('');
  };

  // Fill the entry form from the most recent prior set of the selected exercise.
  const handleCopyPreviousSet = () => {
    if (!selectedExercise) return;
    const prior = allLogs
      .filter(l => l.exercise_id === selectedExercise.id && !l.is_deleted && l.date < selectedDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prior) { triggerToast('No previous set found.', 'info'); return; }
    if (prior.metric_weight != null) setLogWeight(String(prior.metric_weight));
    if (prior.reps != null) setLogReps(String(prior.reps));
    if (prior.distance != null) setLogDistance(String(settings.distance_unit === 2 ? Math.round((prior.distance / 1.60934) * 1000) / 1000 : prior.distance));
    if (prior.duration_seconds != null) setLogDuration(String(prior.duration_seconds));
  };

  // Clear all sets + superset groups for the selected date.
  const handleClearDay = () => {
    triggerConfirm('Clear Day', `Delete all sets logged on ${selectedDate}?`, async () => {
      for (const l of currentLogs) await db.execute('UPDATE training_logs', [{ ...l, is_deleted: true }]);
      const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
      for (const g of groups.filter(x => x.date === selectedDate && !x.is_deleted)) await db.execute('UPDATE workout_groups', [{ ...g, is_deleted: true }]);
      await refreshData();
      triggerToast('Day cleared.');
    }, { approveLabel: 'Delete', tone: 'danger' });
  };

  // Per-exercise-per-day comment.
  const saveExerciseComment = async (exerciseId: string, comment: string) => {
    const existing = exerciseComments.find(c => c.exercise_id === exerciseId && c.date === selectedDate);
    const rec: ExerciseComment = existing
      ? { ...existing, comment }
      : { id: uuidv4(), exercise_id: exerciseId, date: selectedDate, comment };
    await db.execute('INSERT INTO exercise_comments', [rec]);
    const recs = await db.query<ExerciseComment>('SELECT * FROM exercise_comments WHERE date = ?', [selectedDate]);
    setExerciseComments(recs);
  };

  const handleToggleComplete = async (log: TrainingLog) => {
    const updated = { ...log, is_complete: !log.is_complete };
    await db.execute('INSERT INTO training_logs', [updated]);
    await refreshData();
  };

  const handleMarkAllComplete = async () => {
    const uncompleted = currentLogs.filter(l => !l.is_complete);
    if (uncompleted.length === 0) return;

    for (const log of uncompleted) {
      const updated = { ...log, is_complete: true };
      await db.execute('INSERT INTO training_logs', [updated]);
    }
    await refreshData();
    triggerToast('All sets marked complete.');
  };

  const handleMarkExerciseComplete = async (exerciseId: string) => {
    const exLogs = currentLogs.filter(l => l.exercise_id === exerciseId && !l.is_complete);
    if (exLogs.length === 0) return;

    for (const log of exLogs) {
      const updated = { ...log, is_complete: true };
      await db.execute('INSERT INTO training_logs', [updated]);
    }
    await refreshData();
    triggerToast('All exercise sets marked complete.');
  };

  const handleDeleteSet = async (id: string) => {
    const target = currentLogs.find(x => x.id === id) || allLogs.find(x => x.id === id);
    if (target) {
      const deleted = { ...target, is_deleted: true };
      if (target.date === selectedDateRef.current) {
        setCurrentLogs(prev => prev.filter(l => l.id !== id));
        setSelectedLogIdsForGroup(prev => prev.filter(logId => logId !== id));
      }
      setAllLogs(prev => prev.map(l => l.id === id ? deleted : l));
      await db.execute('INSERT INTO training_logs', [deleted]);
      await refreshDateData(target.date);
    }
  };

  // Copy workout selector handler
  const handleCopyWorkoutConfirm = async (sourceDate: string) => {
    const targetDate = selectedDateRef.current;
    const sourceLogs = allLogs.filter(l => l.date === sourceDate && !l.is_deleted);
    if (sourceLogs.length === 0) {
      triggerToast('No active sets found for selected date!', 'error');
      return;
    }
    
    const sourceGroups = workoutGroups.filter(g => g.date === sourceDate && !g.is_deleted);
    const sourceGroupExs = groupExercises.filter(ge => ge.date === sourceDate && !ge.is_deleted);
    const sourceRoutineLinks = workoutRoutines.filter(wr => wr.date === sourceDate && !wr.is_deleted);
    const targetRoutineLinks = workoutRoutines.filter(wr => wr.date === targetDate && !wr.is_deleted);

    const groupIdMap: Record<string, string> = {};

    for (const wg of sourceGroups) {
      const newGroupId = uuidv4();
      groupIdMap[wg.id] = newGroupId;
      const newGroup = {
        ...wg,
        id: newGroupId,
        date: targetDate,
        last_modified: new Date().toISOString()
      };
      await db.execute('INSERT INTO workout_groups', [newGroup]);
    }

    for (const ge of sourceGroupExs) {
      const newGroupId = groupIdMap[ge.workout_group_id];
      if (newGroupId) {
        const newGe = {
          ...ge,
          id: uuidv4(),
          date: targetDate,
          workout_group_id: newGroupId,
          last_modified: new Date().toISOString()
        };
        await db.execute('INSERT INTO workout_group_exercises', [newGe]);
      }
    }

    for (const log of sourceLogs) {
      const newLog = {
        ...log,
        id: uuidv4(),
        date: targetDate,
        is_complete: false,
        is_personal_record: false,
        last_modified: new Date().toISOString()
      };
      await db.execute('INSERT INTO training_logs', [newLog]);
    }

    for (const wr of sourceRoutineLinks) {
      const duplicate = targetRoutineLinks.some(existing =>
        existing.routine_id === wr.routine_id &&
        (existing.routine_section_id ?? null) === (wr.routine_section_id ?? null)
      );
      if (duplicate) continue;

      const newRoutineLink: WorkoutRoutine = {
        ...wr,
        id: uuidv4(),
        date: targetDate,
        is_deleted: false,
      };
      await db.execute('INSERT INTO workout_routines', [newRoutineLink]);
    }

    setShowCopyWorkoutDrawer(false);
    await refreshData();
    triggerToast(`Successfully copied workout from ${sourceDate}.`);
  };

  // Start Routine with Populators
  const copyRoutineSectionSupersetsToWorkout = async (sectionId: string, sectionExerciseIds: string[]) => {
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const links = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    const templateGroups = groups.filter(g => g.routine_section_id === sectionId && !g.is_deleted);
    const importedExerciseIds = new Set(sectionExerciseIds);

    for (const templateGroup of templateGroups) {
      const templateLinks = links.filter(link =>
        link.workout_group_id === templateGroup.id &&
        link.routine_section_id === sectionId &&
        importedExerciseIds.has(link.exercise_id) &&
        !link.is_deleted
      );

      if (templateLinks.length < 2) continue;

      const newGroupId = uuidv4();
      const newGroup: WorkoutGroup = {
        id: newGroupId,
        name: templateGroup.name || 'Superset',
        date: selectedDate,
        routine_section_id: null,
        colour: templateGroup.colour,
        auto_jump_enabled: templateGroup.auto_jump_enabled,
        rest_timer_auto_start_enabled: templateGroup.rest_timer_auto_start_enabled
      };
      await db.execute('INSERT INTO workout_groups', [newGroup]);

      for (const templateLink of templateLinks) {
        const newLink: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: templateLink.exercise_id,
          date: selectedDate,
          routine_section_id: null,
          workout_group_id: newGroupId
        };
        await db.execute('INSERT INTO workout_group_exercises', [newLink]);
      }
    }
  };

  // Record that a routine (and optionally a specific workout-day split) was
  // loaded onto a date. Skips duplicates so re-importing the same split on the
  // same day doesn't inflate completion counts.
  const recordWorkoutRoutine = async (routineId: string, sectionId: string | null, date = selectedDateRef.current) => {
    const existing = await db.query<WorkoutRoutine>('SELECT * FROM workout_routines WHERE date = ?', [date]);
    const dup = existing.some(wr =>
      !wr.is_deleted && wr.routine_id === routineId && (wr.routine_section_id ?? null) === (sectionId ?? null)
    );
    if (dup) return;
    const link: WorkoutRoutine = {
      id: uuidv4(),
      date,
      routine_id: routineId,
      routine_section_id: sectionId,
    };
    await db.execute('INSERT INTO workout_routines', [link]);
    setWorkoutRoutines(prev => [...prev, link]);
  };

  const handleImportRoutinePopulated = async (
    routineId: string, 
    type: 'template' | 'last_workout' | 'one_rep_max', 
    percentage: number = 75,
    sectionId?: string
  ) => {
    const targetDate = selectedDateRef.current;
    const defaultUnit = userUnit === 'kg' ? 1 : 2;
    const findLastSessionLogs = (exerciseId: string) => {
      const pastExLogs = allLogs.filter(l =>
        l.exercise_id === exerciseId &&
        !l.is_deleted &&
        l.date < targetDate
      );

      if (pastExLogs.length === 0) return [];

      const uniqueDates = Array.from(new Set(pastExLogs.map(l => l.date)))
        .sort((a, b) => b.localeCompare(a));
      return pastExLogs.filter(l => l.date === uniqueDates[0]);
    };

    const insertLogFromSource = async (
      exerciseId: string,
      source: Pick<TrainingLog | RoutineSectionExerciseSet, 'metric_weight' | 'reps' | 'distance' | 'duration_seconds' | 'unit'>,
      overrides: Partial<TrainingLog> = {}
    ) => {
      const log: TrainingLog = {
        id: uuidv4(),
        exercise_id: exerciseId,
        date: targetDate,
        metric_weight: source.metric_weight,
        reps: source.reps,
        unit: source.unit ?? defaultUnit,
        is_personal_record: false,
        is_complete: false,
        distance: source.distance,
        duration_seconds: source.duration_seconds,
        ...overrides
      };
      await db.execute('INSERT INTO training_logs', [log]);
    };

    const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const routineSecs = sections.filter(s => s.routine_id === routineId && (!sectionId || s.id === sectionId) && !s.is_deleted).sort(bySortOrder);
    let totalSetsLogged = 0;

    for (const sec of routineSecs) {
      const exList = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
      const secExs = exList.filter(x => x.routine_section_id === sec.id && !x.is_deleted).sort(bySortOrder);
      const importedExerciseIds = secExs.map(se => se.exercise_id);
      let sectionSetsLogged = 0;

      for (const se of secExs) {
        const setList = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const exSets = setList.filter(x => x.routine_section_exercise_id === se.id && !x.is_deleted).sort(bySortOrder);
        const lastSessionLogs = type === 'template' ? [] : findLastSessionLogs(se.exercise_id);

        if (type === 'template') {
          for (const s of exSets) {
            await insertLogFromSource(se.exercise_id, s, { routine_section_exercise_set_id: s.id });
            sectionSetsLogged++;
            totalSetsLogged++;
          }
        } else if (type === 'last_workout') {
          if (lastSessionLogs.length > 0) {
            for (const lastLog of lastSessionLogs) {
              await insertLogFromSource(se.exercise_id, lastLog);
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          } else {
            for (const s of exSets) {
              await insertLogFromSource(se.exercise_id, s, { routine_section_exercise_set_id: s.id });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          }
        } else if (type === 'one_rep_max') {
          const highest1RM = getHighest1RM(se.exercise_id, targetDate);
          
          if (highest1RM > 0) {
            const targetWeight = highest1RM * (percentage / 100);
            const roundedWeight = Math.round(targetWeight / 2.5) * 2.5;
            const usingTemplateSets = exSets.length > 0;
            const sourceSets = usingTemplateSets ? exSets : lastSessionLogs;

            for (const s of sourceSets) {
              await insertLogFromSource(se.exercise_id, s, {
                metric_weight: roundedWeight,
                routine_section_exercise_set_id: usingTemplateSets ? s.id : undefined
              });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          } else {
            for (const s of exSets) {
              await insertLogFromSource(se.exercise_id, s, { routine_section_exercise_set_id: s.id });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          }
        }
      }

      if (sectionSetsLogged > 0) {
        await copyRoutineSectionSupersetsToWorkout(sec.id, importedExerciseIds);
        await recordWorkoutRoutine(routineId, sec.id, targetDate);
      }
    }

    setShowRoutineImportModal(false);
    setActiveRoutineForPopulate(null);
    setActiveSectionForPopulate(null);
    await refreshData();
    if (totalSetsLogged > 0) {
      triggerToast(`Routine loaded using ${type === 'one_rep_max' ? `${percentage}% 1RM` : type === 'last_workout' ? 'last session' : 'template defaults'}.`);
    } else {
      triggerToast('No routine sets were logged. Add template sets or log this exercise once before using history-based loading.', 'error');
    }
  };

  // Bulk Edit / Mutation Handlers
  const handleBulkDelete = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target) {
        const deleted = { ...target, is_deleted: true };
        await db.execute('INSERT INTO training_logs', [deleted]);
      }
    }
    setSelectedLogIdsForGroup([]);
    await refreshData();
    triggerToast('Selected sets deleted.');
  };

  const handleBulkMoveConfirm = async (targetDate: string) => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target) {
        const moved = { ...target, date: targetDate };
        await db.execute('INSERT INTO training_logs', [moved]);
      }
    }
    setSelectedLogIdsForGroup([]);
    setShowBulkMoveModal(false);
    await refreshData();
    triggerToast(`Selected sets moved to ${targetDate}.`);
  };

  const handleBulkIncrementWeight = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target && target.metric_weight !== null) {
        const currentWeight = target.metric_weight || 0;
        const updated = { ...target, metric_weight: currentWeight + 5 };
        await db.execute('INSERT INTO training_logs', [updated]);
      }
    }
    await refreshData();
    triggerToast('Incremented weights of selected sets by 5.');
  };

  const handleBulkIncrementReps = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target && target.reps !== null) {
        const currentReps = target.reps || 0;
        const updated = { ...target, reps: currentReps + 2 };
        await db.execute('INSERT INTO training_logs', [updated]);
      }
    }
    await refreshData();
    triggerToast('Incremented reps of selected sets by 2.');
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

  // 7 Dynamic Exercise Types formatter
  const formatLogValue = (log: TrainingLog, typeId: number | string) => {
    const id = Number(typeId);
    const hasWeightValue = log.metric_weight !== null && Number(log.metric_weight) > 0;
    const weightStr = hasWeightValue ? `${displayWeight(log.metric_weight, log.unit)}` : '';
    const repsStr = log.reps !== null ? `${log.reps} reps` : '';
    const distStr = log.distance !== null
      ? (settings.distance_unit === 2 ? `${Math.round((log.distance / 1.60934) * 100) / 100} mi` : `${log.distance} km`)
      : '';
    const durStr = log.duration_seconds !== null ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s` : '';
    const distanceTimeStr = distStr && durStr ? `${distStr} in ${durStr}` : distStr || durStr;

    switch (id) {
      case 0: // Weight & Reps
        if (!hasWeightValue && repsStr) return repsStr;
        return `${weightStr} x ${repsStr}`;
      case 1: // Distance & Time (FitNotes Android/Cardio)
        return distanceTimeStr;
      case 2: // Reps Only
        return `${repsStr}`;
      case 3: // Distance & Time
        return distanceTimeStr;
      case 4: // Distance Only
        return `${distStr}`;
      case 5: // Time Only
        return `${durStr}`;
      case 6: // Weight & Distance
        return `${weightStr} for ${distStr}`;
      case 7: // Weight & Time
        return `${weightStr} for ${durStr}`;
      default:
        return `${weightStr} x ${repsStr}`;
    }
  };

  // Workout comment mutator
  const handleSaveComment = async () => {
    const commentObj = {
      id: uuidv4(),
      date: selectedDate,
      comment: workoutComment
    };
    await db.execute('INSERT INTO workout_comments', [commentObj]);
    triggerToast('Workout comment saved!');
  };

  // Build a shareable text summary of the selected day and share/copy it.
  const shareWorkout = async () => {
    const lines: string[] = [`FitNotes - ${selectedDate}`, ''];
    const exIds = Array.from(new Set(currentLogs.map(l => l.exercise_id)));
    let totalVol = 0, totalSets = 0;
    for (const exId of exIds) {
      const ex = exercises.find(e => e.id === exId);
      if (!ex) continue;
      lines.push(ex.name);
      currentLogs.filter(l => l.exercise_id === exId).forEach((l, i) => {
        lines.push(`  ${i + 1}. ${formatLogValue(l, ex.exercise_type_id)}${l.is_personal_record ? ' (PR)' : ''}`);
        totalVol += (l.metric_weight ?? 0) * (l.reps ?? 0);
        totalSets += 1;
      });
    }
    if (workoutComment) lines.push('', `Note: ${workoutComment}`);
    lines.push('', `Total: ${totalSets} sets, ${Math.round(totalVol)} ${userUnit} volume`);
    const text = lines.join('\n');
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: `Workout ${selectedDate}`, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        triggerToast('Workout summary copied to clipboard.');
      }
    } catch { /* user cancelled */ }
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleToggleExerciseFavourite = async (ex: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = !ex.is_favourite;
    await db.execute('UPDATE exercises', [{ ...ex, is_favourite: isFav }]);
    await refreshData();
    triggerToast(ex.name + (isFav ? ' added to favorites.' : ' removed from favorites.'));
  };

  // Populate the edit-exercise modal fields and open it.
  const openExerciseEditor = (ex: Exercise) => {
    setEditingExercise(ex);
    setEditExName(ex.name);
    setEditExCategory(ex.category_id || '');
    setEditExType(ex.exercise_type_id.toString());
    setEditExNotes(ex.notes || '');
    setEditExWeightIncrement(ex.weight_increment?.toString() || '2.5');
    setEditExDefaultRestTime(ex.default_rest_time?.toString() || '90');
    setEditExWeightUnit(ex.weight_unit_id?.toString() || '1');
    setEditExIsFavourite(ex.is_favourite);
    setShowEditExModal(true);
  };

  // Exercise mutator (Allows Category Assignments)
  const handleCreateExercise = async () => {
    if (!newExName) return;
    const record: Exercise = {
      id: uuidv4(),
      name: newExName,
      category_id: newExCategory || null,
      exercise_type_id: parseInt(newExType),
      is_favourite: false,
      notes: newExNotes || undefined
    };

    await db.execute('INSERT INTO exercises', [record]);
    setNewExName('');
    setNewExNotes('');
    await refreshData();
    triggerToast('Custom Exercise successfully added!');
  };

  // Category mutator (Manage custom categories)
  const handleCreateCategory = async () => {
    if (!newCatName) return;
    
    const colourVal = hexToSignedArgb(newCatColor);

    const record: Category = {
      id: uuidv4(),
      name: newCatName,
      colour: colourVal,
      sort_order: categories.length + 1
    };

    await db.execute('INSERT INTO categories', [record]);
    setNewCatName('');
    setShowCatModal(false);
    await refreshData();
    triggerToast('Category created successfully!');
  };

  // Category Updator and Soft-Deletor
  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCatName) return;
    
    const colourVal = hexToSignedArgb(editingCatColor);

    const updated = {
      ...editingCategory,
      name: editingCatName,
      colour: colourVal
    };

    await db.execute('INSERT INTO categories', [updated]);
    setEditingCategory(null);
    setShowManageCatsModal(false);
    await refreshData();
    triggerToast('Category updated successfully!');
  };

  const handleDeleteCategory = async (id: string) => {
    triggerConfirm(
      'Delete Category',
      'Are you sure you want to delete this category? Exercises inside will become uncategorized.',
      async () => {
        const cats = await db.query<Category>('SELECT * FROM categories');
        const target = cats.find(x => x.id === id);
        if (target) {
          const updated = { ...target, is_deleted: true };
          await db.execute('INSERT INTO categories', [updated]);
          await refreshData();
          triggerToast('Category deleted.');
        }
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  // Exercise Updator and Soft-Deletor
  const handleUpdateExercise = async () => {
    if (!editingExercise || !editExName) return;
    const newType = parseInt(editExType);

    const doSave = async () => {
      const updated: Exercise = {
        ...editingExercise,
        name: editExName,
        category_id: editExCategory || null,
        exercise_type_id: newType,
        notes: editExNotes || undefined,
        weight_increment: parseFloat(editExWeightIncrement) || undefined,
        default_rest_time: parseInt(editExDefaultRestTime) || undefined,
        weight_unit_id: parseInt(editExWeightUnit) || undefined,
        is_favourite: editExIsFavourite,
      };
      await db.execute('INSERT INTO exercises', [updated]);
      setShowEditExModal(false);
      setEditingExercise(null);
      await refreshData();
      triggerToast('Exercise updated successfully!');
    };

    // Warn if changing the exercise type while logged sets exist — incompatible
    // fields (e.g. reps when switching to a distance type) won't display.
    const typeChanged = newType !== editingExercise.exercise_type_id;
    const hasLogs = allLogs.some(l => l.exercise_id === editingExercise.id && !l.is_deleted);
    if (typeChanged && hasLogs) {
      triggerConfirm(
        'Change Exercise Type',
        'This exercise has logged sets. Changing its type may hide values that no longer apply. Continue?',
        () => { doSave(); },
        { approveLabel: 'Save Changes' },
      );
    } else {
      await doSave();
    }
  };

  const handleDeleteExercise = async (id: string) => {
    triggerConfirm(
      'Delete Exercise',
      "Are you sure you want to delete this exercise? Today's logged sets will be retained but the exercise will be hidden from the catalog.",
      async () => {
        const exs = await db.query<Exercise>('SELECT * FROM exercises');
        const target = exs.find(x => x.id === id);
        if (target) {
          const updated = { ...target, is_deleted: true };
          await db.execute('INSERT INTO exercises', [updated]);
          setShowEditExModal(false);
          setEditingExercise(null);
          await refreshData();
          triggerToast('Exercise deleted.');
        }
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  // Active workout supersets linker
  const handleCalendarDayClick = async (dateStr: string) => {
    setPreviewDate(dateStr);
    const logsForDate = allLogs.filter(l => l.date === dateStr && !l.is_deleted);
    setPreviewLogs(logsForDate);
    
    // Fetch comment for this date!
    const comments = await db.query<WorkoutComment>('SELECT * FROM workout_comments WHERE date = ?', [dateStr]);
    if (comments.length > 0) {
      setPreviewComment(comments[0].comment);
    } else {
      setPreviewComment('');
    }
    
    setShowCalendarPreviewModal(true);
  };


  const handleCreateWorkoutSuperset = async () => {
    if (selectedExIdsForSuperset.length === 0) {
      triggerToast('Please select at least 1 exercise!', 'error');
      return;
    }

    const colourVal = hexToSignedArgb(supersetColor);

    let groupId = targetSupersetGroupId;

    if (!groupId) {
      if (selectedExIdsForSuperset.length < 2) {
        triggerToast('Please select at least 2 exercises to create a new superset!', 'error');
        return;
      }
      groupId = uuidv4();
      const newGroup: WorkoutGroup = {
        id: groupId,
        name: supersetName || 'Superset',
        date: selectedDate,
        colour: colourVal,
        auto_jump_enabled: true,
        rest_timer_auto_start_enabled: false
      };
      await db.execute('INSERT INTO workout_groups', [newGroup]);
    } else {
      const existing = workoutGroups.find(g => g.id === groupId);
      if (existing) {
        const updated = {
          ...existing,
          name: supersetName || existing.name,
          colour: colourVal
        };
        await db.execute('UPDATE workout_groups', [updated]);
      }
    }

    for (const exId of selectedExIdsForSuperset) {
      const alreadyLinked = groupExercises.some(
        ge => ge.workout_group_id === groupId && ge.exercise_id === exId && ge.date === selectedDate && !ge.is_deleted
      );
      if (!alreadyLinked) {
        const link: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: exId,
          date: selectedDate,
          workout_group_id: groupId
        };
        await db.execute('INSERT INTO workout_group_exercises', [link]);
      }
    }

    setSelectedExIdsForSuperset([]);
    setSupersetName('Superset');
    setTargetSupersetGroupId('');
    setShowSupersetManagerModal(false);
    await refreshData();
    triggerToast(targetSupersetGroupId ? 'Exercises added to superset!' : 'Superset created successfully!');
  };

  // Supersets & Workout Groups Manager
  const handleCreateSuperset = async () => {
    if (selectedLogIdsForGroup.length < 2) {
      triggerToast('Please select at least 2 exercise logs to form a superset!', 'error');
      return;
    }

    const groupId = uuidv4();
    const newGroup: WorkoutGroup = {
      id: groupId,
      name: 'Superset Group',
      date: selectedDate,
      colour: hexToSignedArgb('#ef4444'),
      auto_jump_enabled: false,
      rest_timer_auto_start_enabled: false
    };

    await db.execute('INSERT INTO workout_groups', [newGroup]);

    for (const logId of selectedLogIdsForGroup) {
      const log = currentLogs.find(x => x.id === logId);
      if (log) {
        const link: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: log.exercise_id,
          date: selectedDate,
          workout_group_id: groupId
        };
        await db.execute('INSERT INTO workout_group_exercises', [link]);
      }
    }

    setSelectedLogIdsForGroup([]);
    await refreshData();
    triggerToast('Superset created successfully!');
  };

  const handleClearGroup = async (groupId: string) => {
    // Soft delete workout group
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const links = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    
    const targetGroup = groups.find(x => x.id === groupId);
    if (targetGroup) {
      await db.execute('INSERT INTO workout_groups', [{ ...targetGroup, is_deleted: true }]);
    }
    const targetLinks = links.filter(x => x.workout_group_id === groupId);
    for (const link of targetLinks) {
      await db.execute('INSERT INTO workout_group_exercises', [{ ...link, is_deleted: true }]);
    }

    await refreshData();
    triggerToast('Superset cleared.');
  };

  const handleCreateRoutineSuperset = async (sectionId: string, exerciseIds: string[]) => {
    if (exerciseIds.length < 2) {
      triggerToast('Please select at least 2 exercises to create a superset!', 'error');
      return;
    }

    const colourVal = hexToSignedArgb(supersetColor);

    const groupId = uuidv4();
    const newGroup: WorkoutGroup = {
      id: groupId,
      name: `Superset`,
      date: '',
      routine_section_id: sectionId,
      colour: colourVal,
      auto_jump_enabled: true,
      rest_timer_auto_start_enabled: false
    };

    await db.execute('INSERT INTO workout_groups', [newGroup]);

    for (const exId of exerciseIds) {
      const link: WorkoutGroupExercise = {
        id: uuidv4(),
        exercise_id: exId,
        date: '',
        routine_section_id: sectionId,
        workout_group_id: groupId
      };
      await db.execute('INSERT INTO workout_group_exercises', [link]);
    }

    await refreshData();
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Routine superset created successfully!');
  };

  const handleClearRoutineGroup = async (groupId: string) => {
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const links = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    
    const targetGroup = groups.find(x => x.id === groupId);
    if (targetGroup) {
      await db.execute('INSERT INTO workout_groups', [{ ...targetGroup, is_deleted: true }]);
    }
    const targetLinks = links.filter(x => x.workout_group_id === groupId);
    for (const link of targetLinks) {
      await db.execute('INSERT INTO workout_group_exercises', [{ ...link, is_deleted: true }]);
    }

    await refreshData();
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Routine superset cleared.');
  };

  // Routine Template Builder
  const handleAddExToRoutineCreator = () => {
    if (!selectedExForRoutine) return;
    setRoutineCreatorExercises([
      ...routineCreatorExercises,
      {
        exercise_id: selectedExForRoutine,
        weight: '',
        reps: '',
        sort_order: routineCreatorExercises.length + 1
      }
    ]);
  };

  const handleCreateRoutineTemplate = async () => {
    if (!newRoutineName) {
      triggerToast('Please enter a routine template name!', 'error');
      return;
    }

    const routineId = uuidv4();
    const newRoutine: Routine = {
      id: routineId,
      name: newRoutineName,
      notes: newRoutineNotes || undefined
    };

    await db.execute('INSERT INTO routines', [newRoutine]);

    const sectionId = uuidv4();
    const newSection: RoutineSection = {
      id: sectionId,
      routine_id: routineId,
      name: 'Default Sets',
      sort_order: 1
    };
    await db.execute('INSERT INTO routine_sections', [newSection]);

    // Group items by exercise to map correct structure
    for (const item of routineCreatorExercises) {
      const rseId = uuidv4();
      const newRse: RoutineSectionExercise = {
        id: rseId,
        routine_section_id: sectionId,
        exercise_id: item.exercise_id,
        sort_order: item.sort_order,
        populate_sets_type: 1
      };
      await db.execute('INSERT INTO routine_section_exercises', [newRse]);

      const hasTemplateSet = item.weight.trim() !== '' || item.reps.trim() !== '';
      if (hasTemplateSet) {
        const rsesId = uuidv4();
        const newRses: RoutineSectionExerciseSet = {
          id: rsesId,
          routine_section_exercise_id: rseId,
          metric_weight: item.weight.trim() === '' ? null : parseFloat(item.weight),
          reps: item.reps.trim() === '' ? null : parseInt(item.reps),
          sort_order: 1,
          distance: null,
          duration_seconds: null,
          unit: userUnit === 'kg' ? 1 : 2
        };
        await db.execute('INSERT INTO routine_section_exercise_sets', [newRses]);
      }
    }

    setNewRoutineName('');
    setNewRoutineNotes('');
    setRoutineCreatorExercises([]);
    setShowCreateRoutineModal(false);
    await refreshData();
    triggerToast('Routine template created successfully!');
  };

  const handleDeleteRoutine = async (routineId: string) => {
    const target = routines.find(r => r.id === routineId);
    if (!target) return;

    triggerConfirm(
      'Delete routine?',
      `Delete "${target.name}" and all of its workout days, template sets, and routine supersets?`,
      async () => {
        const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
        const sectionsToDelete = allSections.filter(section => section.routine_id === routineId);
        const sectionIds = sectionsToDelete.map(section => section.id);

        const allSectionExercises = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
        const sectionExercisesToDelete = allSectionExercises.filter(se => sectionIds.includes(se.routine_section_id));
        const sectionExerciseIds = sectionExercisesToDelete.map(se => se.id);

        const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const setsToDelete = allSets.filter(set => sectionExerciseIds.includes(set.routine_section_exercise_id));

        const allGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
        const groupsToDelete = allGroups.filter(group => group.routine_section_id && sectionIds.includes(group.routine_section_id));
        const groupIds = groupsToDelete.map(group => group.id);

        const allGroupExercises = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
        const groupExercisesToDelete = allGroupExercises.filter(link =>
          groupIds.includes(link.workout_group_id) ||
          (link.routine_section_id !== undefined && link.routine_section_id !== null && sectionIds.includes(link.routine_section_id))
        );

        await db.execute('INSERT INTO routines', [{ ...target, is_deleted: true }]);
        for (const section of sectionsToDelete) {
          await db.execute('INSERT INTO routine_sections', [{ ...section, is_deleted: true }]);
        }
        for (const sectionExercise of sectionExercisesToDelete) {
          await db.execute('INSERT INTO routine_section_exercises', [{ ...sectionExercise, is_deleted: true }]);
        }
        for (const set of setsToDelete) {
          await db.execute('INSERT INTO routine_section_exercise_sets', [{ ...set, is_deleted: true }]);
        }
        for (const group of groupsToDelete) {
          await db.execute('INSERT INTO workout_groups', [{ ...group, is_deleted: true }]);
        }
        for (const groupExercise of groupExercisesToDelete) {
          await db.execute('INSERT INTO workout_group_exercises', [{ ...groupExercise, is_deleted: true }]);
        }

        if (editingRoutine?.id === routineId) {
          setEditingRoutine(null);
          setActiveTab('routines');
        }
        await refreshData();
        triggerToast('Routine deleted.');
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  // Import / Load Routine template into current daily logs
  const handleImportRoutine = async (routineId: string) => {
    const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const routineSecs = sections.filter(s => s.routine_id === routineId && !s.is_deleted).sort(bySortOrder);

    for (const sec of routineSecs) {
      const exList = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
      const secExs = exList.filter(x => x.routine_section_id === sec.id && !x.is_deleted).sort(bySortOrder);
      const importedExerciseIds = secExs.map(se => se.exercise_id);

      for (const se of secExs) {
        const setList = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const exSets = setList.filter(x => x.routine_section_exercise_id === se.id && !x.is_deleted).sort(bySortOrder);

        for (const s of exSets) {
          const log: TrainingLog = {
            id: uuidv4(),
            exercise_id: se.exercise_id,
            date: selectedDate,
            metric_weight: s.metric_weight,
            reps: s.reps,
            unit: userUnit === 'kg' ? 1 : 2,
            is_personal_record: false,
            is_complete: false,
            distance: s.distance,
            duration_seconds: s.duration_seconds
          };
          await db.execute('INSERT INTO training_logs', [log]);
        }
      }

      await copyRoutineSectionSupersetsToWorkout(sec.id, importedExerciseIds);
      await recordWorkoutRoutine(routineId, sec.id);
    }

    setShowRoutineImportModal(false);
    await refreshData();
    triggerToast('Routine templates loaded successfully!');
  };

  // Routine Day Editor loaders and mutators
  const loadEditorData = async (routineId: string) => {
    const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections WHERE routine_id = ? ORDER BY sort_order', [routineId]);
    const activeSections = allSections.filter(section => !section.is_deleted).sort(bySortOrder);
    setEditorSections(activeSections);

    const allSecExs = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises ORDER BY sort_order');
    const activeSecIds = activeSections.map(s => s.id);
    const filteredSecExs = allSecExs.filter(se => activeSecIds.includes(se.routine_section_id) && !se.is_deleted).sort(bySortOrder);
    setEditorSectionExercises(filteredSecExs);

    const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets ORDER BY sort_order');
    const activeSecExIds = filteredSecExs.map(se => se.id);
    const filteredSets = allSets.filter(s => activeSecExIds.includes(s.routine_section_exercise_id) && !s.is_deleted).sort(bySortOrder);
    setEditorExerciseSets(filteredSets);
  };

  useEffect(() => {
    if (editingRoutine && activeTab === 'routine-editor') {
      loadEditorData(editingRoutine.id);
    }
  }, [editingRoutine, activeTab]);

  const handleAddDayToRoutine = async () => {
    if (!editingRoutine) return;
    const newSection: RoutineSection = {
      id: uuidv4(),
      routine_id: editingRoutine.id,
      name: `Day ${editorSections.length + 1}`,
      sort_order: editorSections.length + 1
    };
    await db.execute('INSERT INTO routine_sections', [newSection]);
    await loadEditorData(editingRoutine.id);
    triggerToast('Workout day added to template.');
  };

  // Open the "add exercise to section" modal targeting a section.
  const openAddExerciseToSection = (sectionId: string) => {
    setEditorAddExerciseTargetSectionId(sectionId);
    setEditorExSearchQuery('');
    setEditorExSelectedCategory(null);
    setShowAddExToSectionModal(true);
  };

  // Open the "import past workout" modal, preloading recent logged dates.
  const openPastImporter = async (sectionId: string) => {
    setPastImporterTargetSectionId(sectionId);
    const dates = await db.query<{ date: string }>('SELECT DISTINCT date FROM training_logs WHERE is_deleted = 0 ORDER BY date DESC LIMIT 5');
    setPastLoggedDates(dates.map(d => d.date));
    setPastImporterDate(dates.length > 0 ? dates[0].date : getLocalDateString());
    setShowPastImporterModal(true);
  };

  const [editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId] = useState<string | null>(null);
  
  const handleAddExerciseToSection = async (sectionId: string, exerciseId: string) => {
    const secExs = editorSectionExercises.filter(se => se.routine_section_id === sectionId);
    const newRseId = uuidv4();
    const newRse: RoutineSectionExercise = {
      id: newRseId,
      routine_section_id: sectionId,
      exercise_id: exerciseId,
      sort_order: secExs.length + 1,
      populate_sets_type: 1
    };
    await db.execute('INSERT INTO routine_section_exercises', [newRse]);
    
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Exercise added to template.');
  };

  const handleDeleteExerciseFromSection = async (rseId: string) => {
    await db.execute('DELETE FROM routine_section_exercises WHERE id = ?', [rseId]);
    await db.execute('DELETE FROM routine_section_exercise_sets WHERE routine_section_exercise_id = ?', [rseId]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Exercise removed from template.');
  };

  const handleAddSetToTemplateExercise = async (rseId: string) => {
    const exSets = editorExerciseSets.filter(s => s.routine_section_exercise_id === rseId);
    const lastSet = exSets[exSets.length - 1];
    const newSet: RoutineSectionExerciseSet = {
      id: uuidv4(),
      routine_section_exercise_id: rseId,
      metric_weight: lastSet?.metric_weight ?? 60,
      reps: lastSet?.reps ?? 10,
      sort_order: exSets.length + 1,
      distance: lastSet?.distance ?? null,
      duration_seconds: lastSet?.duration_seconds ?? null,
      unit: lastSet?.unit ?? (userUnit === 'kg' ? 1 : 2)
    };
    await db.execute('INSERT INTO routine_section_exercise_sets', [newSet]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set added to template exercise.');
  };

  const handleDeleteSetFromTemplateExercise = async (setId: string) => {
    await db.execute('DELETE FROM routine_section_exercise_sets WHERE id = ?', [setId]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set deleted from template exercise.');
  };

  const handleUpdateTemplateSetValues = async (setId: string, values: Partial<Pick<RoutineSectionExerciseSet, 'metric_weight' | 'reps' | 'distance' | 'duration_seconds'>>) => {
    const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
    const target = allSets.find(s => s.id === setId);
    if (target) {
      const updated = {
        ...target,
        ...values
      };
      await db.execute('UPDATE routine_section_exercise_sets', [updated]);
      if (editingRoutine) {
        await loadEditorData(editingRoutine.id);
      }
    }
  };

  const handleUpdateSectionName = async (sectionId: string, name: string) => {
    const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const target = allSections.find(s => s.id === sectionId);
    if (target) {
      const updated = {
        ...target,
        name: name
      };
      await db.execute('UPDATE routine_sections', [updated]);
      if (editingRoutine) {
        await loadEditorData(editingRoutine.id);
      }
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    await db.execute('DELETE FROM routine_sections WHERE id = ?', [sectionId]);
    const secExs = editorSectionExercises.filter(se => se.routine_section_id === sectionId);
    for (const se of secExs) {
      await db.execute('DELETE FROM routine_section_exercises WHERE id = ?', [se.id]);
      await db.execute('DELETE FROM routine_section_exercise_sets WHERE routine_section_exercise_id = ?', [se.id]);
    }
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Workout day deleted.');
  };

  const handleAddAllSectionLogs = async (sectionId: string) => {
    const secExs = editorSectionExercises.filter(se => se.routine_section_id === sectionId && !se.is_deleted).sort(bySortOrder);
    const importedExerciseIds = secExs.map(se => se.exercise_id);
    let setsLogged = 0;
    
    for (const se of secExs) {
      const exSets = editorExerciseSets.filter(s => s.routine_section_exercise_id === se.id && !s.is_deleted).sort(bySortOrder);
      for (const s of exSets) {
        const log: TrainingLog = {
          id: uuidv4(),
          exercise_id: se.exercise_id,
          date: selectedDate,
          metric_weight: s.metric_weight,
          reps: s.reps,
          unit: userUnit === 'kg' ? 1 : 2,
          is_personal_record: false,
          is_complete: false,
          distance: s.distance,
          duration_seconds: s.duration_seconds
        };
        await db.execute('INSERT INTO training_logs', [log]);
        setsLogged++;
      }
    }

    await copyRoutineSectionSupersetsToWorkout(sectionId, importedExerciseIds);
    if (editingRoutine) {
      await recordWorkoutRoutine(editingRoutine.id, sectionId);
    }

    await refreshData();
    triggerToast(`Logged all ${setsLogged} sets from this day template into today's log.`);
    setActiveTab('log');
  };

  const [showPastImporterModal, setShowPastImporterModal] = useState(false);
  const [pastImporterTargetSectionId, setPastImporterTargetSectionId] = useState<string | null>(null);
  const [pastImporterDate, setPastImporterDate] = useState('');
  
  const handleImportPastLogsToSection = async (sectionId: string, pastDate: string) => {
    if (!pastDate) {
      triggerToast('Please select a target date.', 'error');
      return;
    }
    
    const pastLogs = await db.query<TrainingLog>('SELECT * FROM training_logs WHERE date = ? AND is_deleted = 0', [pastDate]);
    if (pastLogs.length === 0) {
      triggerToast('No sets found logged on ' + pastDate, 'error');
      return;
    }
    
    const logsByEx: Record<string, TrainingLog[]> = {};
    for (const log of pastLogs) {
      if (!logsByEx[log.exercise_id]) {
        logsByEx[log.exercise_id] = [];
      }
      logsByEx[log.exercise_id].push(log);
    }
    
    let exercisesAdded = 0;
    for (const [exId, logs] of Object.entries(logsByEx)) {
      const newRseId = uuidv4();
      const newRse: RoutineSectionExercise = {
        id: newRseId,
        routine_section_id: sectionId,
        exercise_id: exId,
        sort_order: ++exercisesAdded,
        populate_sets_type: 1
      };
      await db.execute('INSERT INTO routine_section_exercises', [newRse]);
      
      let setOrder = 0;
      for (const log of logs) {
        const newRses: RoutineSectionExerciseSet = {
          id: uuidv4(),
          routine_section_exercise_id: newRseId,
          metric_weight: log.metric_weight,
          reps: log.reps,
          sort_order: ++setOrder,
          distance: log.distance,
          duration_seconds: log.duration_seconds,
          unit: log.unit
        };
        await db.execute('INSERT INTO routine_section_exercise_sets', [newRses]);
      }
    }
    
    setShowPastImporterModal(false);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast(`Successfully imported exercises from ${pastDate} into day template.`);
  };

  // Withings Integration States
  const [withingsConnected, setWithingsConnected] = useState(false);
  const [withingsLastSync, setWithingsLastSync] = useState<string | null>(null);
  const [withingsSyncing, setWithingsSyncing] = useState(false);

  const fetchWithingsStatus = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWithingsConnected(!!data.connected);
        setWithingsLastSync(data.last_sync || null);
      }
    } catch (e) {
      console.warn("Failed to fetch Withings status:", e);
    }
  };

  const connectWithings = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/auth-url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to get authorization URL");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      triggerToast("Failed to initiate Withings connection", "error");
    }
  };

  const disconnectWithings = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWithingsConnected(false);
        setWithingsLastSync(null);
        triggerToast("Withings account disconnected successfully!");
      } else {
        throw new Error();
      }
    } catch (e) {
      triggerToast("Failed to disconnect Withings account", "error");
    }
  };

  const syncWithings = async () => {
    if (!token) return;
    setWithingsSyncing(true);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to sync weight logs");
      }
      const data = await res.json();
      triggerToast(`Successfully pulled ${data.records_pulled} weight records from Withings!`);
      await triggerSync();
      await fetchWithingsStatus();
    } catch (e: any) {
      triggerToast(e.message || "Failed to sync weights", "error");
    } finally {
      setWithingsSyncing(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('withings_connected') === 'true') {
      triggerToast("Withings account connected successfully!");
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      triggerSync();
      fetchWithingsStatus();
    } else if (params.get('withings_error')) {
      const err = params.get('withings_error');
      triggerToast(`Withings connection failed: ${err}`, "error");
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [token]);

  // OIDC return, shared by both transports: the web flow lands back on the
  // SPA with query params; the mobile flow returns via the fitnotes://oidc
  // deep link with the same params.
  const completeOidcAuth = (params: URLSearchParams): boolean => {
    const oidcToken = params.get('oidc_token');
    const oidcError = params.get('oidc_error');
    const oidcLinked = params.get('oidc') === 'linked';
    if (!oidcToken && !oidcError && !oidcLinked) return false;

    if (oidcError) {
      triggerToast(`Single sign-on failed: ${oidcError}`, 'error');
      return true;
    }
    if (oidcLinked) {
      triggerToast('Single sign-on identity linked to your account!');
      return true;
    }
    if (oidcToken) {
      const email = params.get('oidc_email') || '';
      (async () => {
        tokenRef.current = oidcToken;
        setToken(oidcToken);
        localStorage.setItem('fn_token', oidcToken);
        if (email) {
          setUserEmail(email);
          localStorage.setItem('fn_user_email', email);
        }
        await db.invalidateCache(true);
        try {
          setSyncStatus('syncing');
          await db.sync(oidcToken, getApiBaseUrl());
          hasLocalChangesRef.current = false;
          localChangeVersionRef.current = 0;
          lastPullAtRef.current = Date.now();
          setSyncStatus('success');
          await refreshData();
          setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (e) {
          console.warn('OIDC initial sync failed:', e);
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
        triggerToast('Signed in with single sign-on!');
      })();
    }
    return true;
  };

  // Web transport: query params on the SPA URL (mirrors the Withings flow).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (completeOidcAuth(params)) {
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Mobile transport: deep links delivered by the OS after the system-browser
  // sign-in. Covers both a running app (onOpenUrl) and a cold start by the
  // link itself (getCurrent); the handled-set dedupes overlap between them.
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const handled = new Set<string>();

    const handleUrls = (urls: string[] | null | undefined) => {
      for (const raw of urls ?? []) {
        if (!raw || handled.has(raw)) continue;
        handled.add(raw);
        try {
          const u = new URL(raw);
          if (u.protocol !== 'fitnotes:') continue;
          completeOidcAuth(u.searchParams);
        } catch (e) {
          console.warn('Ignoring malformed deep link:', raw, e);
        }
      }
    };

    import('@tauri-apps/plugin-deep-link')
      .then(async ({ onOpenUrl, getCurrent }) => {
        handleUrls(await getCurrent().catch(() => null));
        const un = await onOpenUrl(handleUrls);
        if (disposed) un();
        else unlisten = un;
      })
      .catch((e) => console.warn('Deep link listener unavailable:', e));

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  // Bodyweight Logger
  const [newWeight, setNewWeight] = useState('75');
  const [newFat, setNewFat] = useState('15');

  // Goals + Measurements data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measurementRecords, setMeasurementRecords] = useState<MeasurementRecord[]>([]);

  // Per-exercise history drawer (null = closed)
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);
  const handleAddWeight = async () => {
    const parsedWeight = parseFloat(newWeight);
    const measuredAt = new Date();
    const selectedDay = new Date(`${selectedDate}T00:00:00`);
    if (!Number.isNaN(selectedDay.getTime())) {
      measuredAt.setFullYear(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
    }
    const record: BodyWeight = {
      id: uuidv4(),
      date: selectedDate,
      measured_at: measuredAt.toISOString(),
      body_weight_metric: userUnit === 'lbs' ? lbsToKg(parsedWeight) : parsedWeight,
      body_fat: newFat ? parseFloat(newFat) : null
    };
    await db.execute('INSERT INTO body_weights', [record]);
    await refreshData();
    triggerToast('Weight logged successfully!');
  };

  // ---- Goals ----
  const saveGoal = async (goal: Goal) => {
    await db.execute('INSERT INTO goals', [goal]);
    await refreshData();
    triggerToast('Goal saved!');
  };

  const deleteGoal = async (id: string) => {
    const existing = goals.find(g => g.id === id);
    if (existing) await db.execute('UPDATE goals', [{ ...existing, is_deleted: true }]);
    await refreshData();
    triggerToast('Goal deleted.');
  };

  // ---- Measurements ----
  const loadMeasurementRecords = async (measurementId: string) => {
    const recs = await db.query<MeasurementRecord>('SELECT * FROM measurement_records WHERE measurement_id = ?', [measurementId]);
    setMeasurementRecords(recs);
  };

  const saveMeasurement = async (m: Measurement) => {
    await db.execute('INSERT INTO measurements', [m]);
    await refreshData();
    triggerToast('Measurement saved!');
  };

  const deleteMeasurement = async (id: string) => {
    const existing = measurements.find(m => m.id === id);
    if (existing) await db.execute('UPDATE measurements', [{ ...existing, is_deleted: true }]);
    await refreshData();
    triggerToast('Measurement deleted.');
  };

  const saveMeasurementRecord = async (rec: MeasurementRecord) => {
    // Ensure the parent measurement is persisted before its record so the FK
    // holds locally and on sync (default measurements may still be virtual).
    const parent = measurements.find(m => m.id === rec.measurement_id);
    if (parent) await db.execute('INSERT INTO measurements', [parent]);
    await db.execute('INSERT INTO measurement_records', [rec]);
    await loadMeasurementRecords(rec.measurement_id);
    triggerToast('Record logged!');
  };

  const deleteMeasurementRecord = async (id: string) => {
    const existing = measurementRecords.find(r => r.id === id);
    if (existing) {
      await db.execute('UPDATE measurement_records', [{ ...existing, is_deleted: true }]);
      await loadMeasurementRecords(existing.measurement_id);
    }
    triggerToast('Record deleted.');
  };

  // Plate Calculator Solver (Premium plate load drawings)
  const calculatePlatesSolver = (target: number) => {
    const barWeight = userUnit === 'kg' ? 20 : 45;
    const targetSides = (target - barWeight) / 2;
    if (targetSides <= 0) {
      setCalculatedPlates([]);
      return;
    }

    const availablePlates = userUnit === 'kg' ? [
      { weight: 20, color: '#ef4444' }, // Red
      { weight: 15, color: '#3b82f6' }, // Blue
      { weight: 10, color: '#10b981' }, // Green
      { weight: 5, color: '#f59e0b' },  // Yellow
      { weight: 2.5, color: '#94a3b8' } // Silver/Grey
    ] : [
      { weight: 45, color: '#ef4444' }, // Red
      { weight: 35, color: '#3b82f6' }, // Blue
      { weight: 25, color: '#10b981' }, // Green
      { weight: 10, color: '#f59e0b' }, // Yellow
      { weight: 5, color: '#94a3b8' },  // Silver/Grey
      { weight: 2.5, color: '#a855f7' } // Purple
    ];

    let remainder = targetSides;
    const result: Array<{ weight: number; count: number; color: string }> = [];

    for (const plate of availablePlates) {
      const count = Math.floor(remainder / plate.weight);
      if (count > 0) {
        result.push({ weight: plate.weight, count, color: plate.color });
        remainder -= count * plate.weight;
      }
    }
    setCalculatedPlates(result);
  };

  useEffect(() => {
    calculatePlatesSolver(plateCalcTarget);
  }, [plateCalcTarget, userUnit]);

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
    showRoutineImportModal, setShowRoutineImportModal, showCreateRoutineModal, setShowCreateRoutineModal,
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory, selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    pastLoggedDates, setPastLoggedDates, workoutGroups, setWorkoutGroups, groupExercises, setGroupExercises,
    workoutRoutines, setWorkoutRoutines, recordWorkoutRoutine,
    selectedLogIdsForGroup, setSelectedLogIdsForGroup, newExName, setNewExName, newExCategory, setNewExCategory,
    newExType, setNewExType, newExNotes, setNewExNotes, showCatModal, setShowCatModal, newCatName, setNewCatName,
    newCatColor, setNewCatColor, selectedExercise, setSelectedExercise, logWeight, setLogWeight, logReps, setLogReps,
    logDistance, setLogDistance, logDuration, setLogDuration, showPlateCalc, setShowPlateCalc, plateCalcTarget, setPlateCalcTarget,
    calculatedPlates, setCalculatedPlates, analyticExerciseId, setAnalyticExerciseId, analyticMetric, setAnalyticMetric,
    newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes, routineCreatorExercises, setRoutineCreatorExercises,
    selectedExForRoutine, setSelectedExForRoutine, showManageCatsModal, setShowManageCatsModal, editingCategory, setEditingCategory,
    editingCatName, setEditingCatName, editingCatColor, setEditingCatColor, showEditExModal, setShowEditExModal,
    showCommandPalette, setShowCommandPalette, showShortcutsHelp, setShowShortcutsHelp, editingExercise, setEditingExercise, editExName, setEditExName,
    editExCategory, setEditExCategory, editExType, setEditExType, editExNotes, setEditExNotes, editExWeightIncrement, setEditExWeightIncrement,
    editExDefaultRestTime, setEditExDefaultRestTime, editExWeightUnit, setEditExWeightUnit, editExIsFavourite, setEditExIsFavourite,
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
    logComment, setLogComment, handleCopyPreviousSet, handleClearDay, shareWorkout,
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
    handleCreateExercise, handleCreateCategory, handleUpdateCategory, handleDeleteCategory, handleUpdateExercise, handleDeleteExercise,
    handleCalendarDayClick, handlePrevMonth, handleNextMonth, handleCreateWorkoutSuperset, handleCreateSuperset, handleClearGroup,
    handleCreateRoutineSuperset, handleClearRoutineGroup, handleAddExToRoutineCreator, handleCreateRoutineTemplate, handleDeleteRoutine, handleImportRoutine,
    loadEditorData, handleAddDayToRoutine, openAddExerciseToSection, openPastImporter, handleAddExerciseToSection, handleDeleteExerciseFromSection,
    handleAddSetToTemplateExercise, handleDeleteSetFromTemplateExercise, handleUpdateTemplateSetValues, handleUpdateSectionName, handleDeleteSection,
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
