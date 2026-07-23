// Routines slice: routine templates (CRUD, copy/versioning), the routine
// editor (days, exercises, template sets), routine supersets, and loading /
// populating routines into the workout log. Code moved verbatim from
// FitNotesStore.tsx.
import { useState, useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react';
import { db } from '../../storage/db';
import { uuidv4 } from '../../lib/uuid';
import { getLocalDateString } from '../../lib/date';
import { hexToSignedArgb } from '../../lib/colors';
import { bySortOrder, type TabId } from './shared';
import type {
  Exercise, TrainingLog, Routine, RoutineSection, RoutineSectionExercise,
  RoutineSectionExerciseSet, WorkoutGroup, WorkoutGroupExercise,
} from '../../types';
import { POPULATE_SETS_TYPE } from '../../types';
import type { LateDeps, TriggerToast, TriggerConfirm } from './types';

export interface RoutinesSliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  triggerConfirm: TriggerConfirm;
  activeTab: TabId;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
  selectedDate: string;
  selectedDateRef: MutableRefObject<string>;
  userUnit: 'kg' | 'lbs';
  exercises: Exercise[];
  allLogs: TrainingLog[];
  workoutGroups: WorkoutGroup[];
  supersetName: string;
  supersetColor: string;
  getHighest1RM: (exerciseId: string, beforeDate?: string) => number;
  recordWorkoutRoutine: (routineId: string, sectionId: string | null, date?: string) => Promise<void>;
}

export function useRoutinesSlice(deps: RoutinesSliceDeps) {
  const {
    late, triggerToast, triggerConfirm, activeTab, setActiveTab,
    selectedDate, selectedDateRef, userUnit, exercises, allLogs,
    workoutGroups, supersetName, supersetColor, getHighest1RM, recordWorkoutRoutine,
  } = deps;

  // Routine Editor modular states
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editorSections, setEditorSections] = useState<RoutineSection[]>([]);
  const [editorSectionExercises, setEditorSectionExercises] = useState<RoutineSectionExercise[]>([]);
  const [editorExerciseSets, setEditorExerciseSets] = useState<RoutineSectionExerciseSet[]>([]);

  // Routines State
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRoutineImportModal, setShowRoutineImportModal] = useState(false);
  const [showCreateRoutineModal, setShowCreateRoutineModal] = useState(false);
  const [showAddExToSectionModal, setShowAddExToSectionModal] = useState(false);
  const [editorExSearchQuery, setEditorExSearchQuery] = useState('');
  const [editorExSelectedCategory, setEditorExSelectedCategory] = useState<string | null>(null);
  const [selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset] = useState<string[]>([]);
  const [pastLoggedDates, setPastLoggedDates] = useState<string[]>([]);

  // Routine templates creation states
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineNotes, setNewRoutineNotes] = useState('');
  const [newRoutineCategory, setNewRoutineCategory] = useState('');

  const [activeRoutineForPopulate, setActiveRoutineForPopulate] = useState<Routine | null>(null);
  const [activeSectionForPopulate, setActiveSectionForPopulate] = useState<RoutineSection | null>(null);

  const [editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId] = useState<string | null>(null);

  const [showPastImporterModal, setShowPastImporterModal] = useState(false);
  const [pastImporterTargetSectionId, setPastImporterTargetSectionId] = useState<string | null>(null);
  const [pastImporterDate, setPastImporterDate] = useState('');

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
    const routine = routines.find(r => r.id === routineId);
    const activeWeek = Math.max(1, routine?.current_week ?? 1);
    const routineSecs = sections.filter(s =>
      s.routine_id === routineId && !s.is_deleted &&
      (sectionId ? s.id === sectionId : (s.week_number ?? 1) === activeWeek)
    ).sort(bySortOrder);
    let totalSetsLogged = 0;

    for (const sec of routineSecs) {
      const exList = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
      const secExs = exList.filter(x => x.routine_section_id === sec.id && !x.is_deleted).sort(bySortOrder);
      const importedExerciseIds = secExs.map(se => se.exercise_id);
      let sectionSetsLogged = 0;

      for (const se of secExs) {
        const setList = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const exSets = setList.filter(x => x.routine_section_exercise_id === se.id && !x.is_deleted).sort(bySortOrder);
        const lastSessionLogs = findLastSessionLogs(se.exercise_id);
        const shouldProgress = Boolean(
          se.progression_enabled && exSets.length > 0 && lastSessionLogs.length > 0 &&
          exSets.every((s, i) => {
            const prior = lastSessionLogs[i] ?? lastSessionLogs[lastSessionLogs.length - 1];
            const repTarget = s.max_reps ?? s.reps;
            return prior?.is_complete && (repTarget == null || (prior.reps ?? 0) >= repTarget) &&
              (s.target_rir == null || (prior.rir ?? -1) >= s.target_rir);
          })
        );

        // One empty set so the exercise still shows up in the workout to log against
        // (matches the reference app's "Log All" placeholder for don't-populate exercises).
        const insertPlaceholderSet = async () => {
          await insertLogFromSource(se.exercise_id, {
            metric_weight: null, reps: null, distance: null, duration_seconds: null, unit: defaultUnit,
          });
          sectionSetsLogged++;
          totalSetsLogged++;
        };

        // Predefined sets: a filled field is used verbatim; a blank field is carried
        // over from the same-position set of the exercise's previous workout.
        const insertPredefinedSets = async () => {
          for (let i = 0; i < exSets.length; i++) {
            const s = exSets[i];
            const inherit = lastSessionLogs[i] ?? lastSessionLogs[lastSessionLogs.length - 1];
            const baseWeight = s.metric_weight ?? inherit?.metric_weight ?? null;
            const baseReps = s.reps ?? s.min_reps ?? inherit?.reps ?? null;
            const progressedWeight = shouldProgress && baseWeight != null
              ? baseWeight + (se.progression_increment ?? exercises.find(ex => ex.id === se.exercise_id)?.weight_increment ?? 2.5)
              : baseWeight;
            const progressedReps = shouldProgress && baseWeight == null && baseReps != null
              ? Math.min(s.max_reps ?? Number.MAX_SAFE_INTEGER, baseReps + (se.progression_reps_step ?? 1))
              : baseReps;
            await insertLogFromSource(se.exercise_id, {
              metric_weight: progressedWeight,
              reps: progressedReps,
              distance: s.distance ?? inherit?.distance ?? null,
              duration_seconds: s.duration_seconds ?? inherit?.duration_seconds ?? null,
              unit: s.unit ?? defaultUnit,
            }, {
              routine_section_exercise_set_id: s.id,
              set_type: s.set_type || 'working',
              rir: s.target_rir ?? null,
            });
            sectionSetsLogged++;
            totalSetsLogged++;
          }
        };

        const insertLastSessionSets = async () => {
          for (const lastLog of lastSessionLogs) {
            await insertLogFromSource(se.exercise_id, lastLog);
            sectionSetsLogged++;
            totalSetsLogged++;
          }
        };

        if (type === 'template') {
          // Honor each exercise's configured populate_sets_type.
          const populateType = se.populate_sets_type ?? POPULATE_SETS_TYPE.PREDEFINED_SETS;
          if (populateType === POPULATE_SETS_TYPE.NONE) {
            await insertPlaceholderSet();
          } else if (populateType === POPULATE_SETS_TYPE.COPY_PREVIOUS_WORKOUT) {
            if (lastSessionLogs.length > 0) await insertLastSessionSets();
            else if (exSets.length > 0) await insertPredefinedSets();
            else await insertPlaceholderSet();
          } else {
            if (exSets.length > 0) await insertPredefinedSets();
            else if (lastSessionLogs.length > 0) await insertLastSessionSets();
            else await insertPlaceholderSet();
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
    await late.refreshData();
    if (totalSetsLogged > 0) {
      triggerToast(`Routine loaded using ${type === 'one_rep_max' ? `${percentage}% 1RM` : type === 'last_workout' ? 'last session' : 'routine set types'}.`);
    } else {
      triggerToast('No routine sets were logged. Add template sets or log this exercise once before using history-based loading.', 'error');
    }
  };

  const handleCreateRoutineSuperset = async (sectionId: string, exerciseIds: string[], name = supersetName) => {
    if (exerciseIds.length < 2) {
      triggerToast('Please select at least 2 exercises to create a superset!', 'error');
      return;
    }

    const colourVal = hexToSignedArgb(supersetColor);

    const groupId = uuidv4();
    const newGroup: WorkoutGroup = {
      id: groupId,
      name: name.trim() || 'Superset',
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

    await late.refreshData();
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Routine superset created successfully!');
  };

  const handleUpdateRoutineGroupName = async (groupId: string, name: string) => {
    const group = workoutGroups.find(g => g.id === groupId && !g.is_deleted);
    const next = name.trim();
    if (!group || !next || next === group.name) return;
    await db.execute('UPDATE workout_groups', [{ ...group, name: next }]);
    await late.refreshData();
    triggerToast('Superset name updated.');
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

    await late.refreshData();
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Routine superset cleared.');
  };

  // Create a routine from just a name + notes, then land in the editor to add
  // workout days and exercises — the reference app's flow (fragment_routine_create
  // is only those two fields; structure is built afterwards in the routine view).
  const handleCreateRoutineTemplate = async () => {
    if (!newRoutineName) {
      triggerToast('Please enter a routine template name!', 'error');
      return;
    }

    const newRoutine: Routine = {
      id: uuidv4(),
      name: newRoutineName,
      notes: newRoutineNotes || undefined,
      category: newRoutineCategory.trim() || null,
      version: 1,
      program_weeks: 1,
      current_week: 1,
      is_archived: false,
    };
    await db.execute('INSERT INTO routines', [newRoutine]);

    // Start with one empty day so the editor opens ready for exercises.
    const newSection: RoutineSection = {
      id: uuidv4(),
      routine_id: newRoutine.id,
      name: 'Day 1',
      sort_order: 1,
      week_number: 1,
    };
    await db.execute('INSERT INTO routine_sections', [newSection]);

    setNewRoutineName('');
    setNewRoutineNotes('');
    setNewRoutineCategory('');
    setShowCreateRoutineModal(false);
    await late.refreshData();
    setEditingRoutine(newRoutine);
    setActiveTab('routine-editor');
    triggerToast('Routine created — add workout days and exercises.');
  };

  // Set or clear a routine's grouping category (empty string clears it).
  const handleUpdateRoutineCategory = async (routineId: string, category: string) => {
    const target = routines.find(r => r.id === routineId);
    if (!target) return;
    const trimmed = category.trim();
    if ((target.category ?? '') === trimmed) return;
    const updated: Routine = { ...target, category: trimmed || null };
    await db.execute('UPDATE routines', [updated]);
    if (editingRoutine?.id === routineId) setEditingRoutine(updated);
    await late.refreshData();
  };

  // Update the routine metadata shown at the top of the template editor.
  // Keeping editingRoutine in sync prevents the header from reverting to the
  // previous value while the local database refreshes and syncs upstream.
  const handleUpdateRoutineDetails = async (
    routineId: string,
    details: Partial<Pick<Routine, 'name' | 'notes' | 'version' | 'program_weeks' | 'current_week' | 'start_date' | 'is_archived'>>,
  ) => {
    const target = editingRoutine?.id === routineId
      ? editingRoutine
      : routines.find(r => r.id === routineId);
    if (!target) return;

    const name = details.name !== undefined ? details.name.trim() : target.name;
    if (!name) {
      triggerToast('Routine name cannot be empty.', 'error');
      return;
    }

    const notes = details.notes !== undefined ? details.notes.trim() : target.notes;
    const updated: Routine = {
      ...target, ...details, name, notes: notes || undefined,
      version: Math.max(1, details.version ?? target.version ?? 1),
      program_weeks: Math.max(1, details.program_weeks ?? target.program_weeks ?? 1),
      current_week: Math.min(
        Math.max(1, details.current_week ?? target.current_week ?? 1),
        Math.max(1, details.program_weeks ?? target.program_weeks ?? 1),
      ),
    };

    await db.execute('UPDATE routines', [updated]);
    setEditingRoutine(updated);
    setRoutines(current => current.map(r => r.id === routineId ? updated : r));
    await late.refreshData();
    triggerToast('Routine details saved.');
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
        await late.refreshData();
        triggerToast('Routine deleted.');
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  // Duplicate a routine template with all of its days, exercises, predefined
  // sets, and routine supersets (mirrors the reference app's "Copy Routine").
  const copyRoutine = async (routineId: string, asVersion: boolean) => {
    const source = routines.find(r => r.id === routineId);
    if (!source) return;

    const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const sections = allSections.filter(s => s.routine_id === routineId && !s.is_deleted);
    const sectionIds = sections.map(s => s.id);

    const allSecExs = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const secExs = allSecExs.filter(se => sectionIds.includes(se.routine_section_id) && !se.is_deleted);
    const secExIds = secExs.map(se => se.id);

    const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
    const sets = allSets.filter(s => secExIds.includes(s.routine_section_exercise_id) && !s.is_deleted);

    const allGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const groups = allGroups.filter(g => g.routine_section_id && sectionIds.includes(g.routine_section_id) && !g.is_deleted);
    const groupIds = groups.map(g => g.id);

    const allGroupExs = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    const groupExs = allGroupExs.filter(ge => groupIds.includes(ge.workout_group_id) && !ge.is_deleted);

    const newRoutineId = uuidv4();
    const nextVersion = (source.version ?? 1) + 1;
    const newName = asVersion ? `${source.name.replace(/ v\d+$/i, '')} v${nextVersion}` : `${source.name} (Copy)`;
    await db.execute('INSERT INTO routines', [{ ...source, id: newRoutineId, name: newName, version: asVersion ? nextVersion : 1, is_archived: false }]);

    const sectionIdMap = new Map<string, string>();
    for (const section of sections) {
      const newId = uuidv4();
      sectionIdMap.set(section.id, newId);
      await db.execute('INSERT INTO routine_sections', [{ ...section, id: newId, routine_id: newRoutineId }]);
    }

    const secExIdMap = new Map<string, string>();
    for (const se of secExs) {
      const newId = uuidv4();
      secExIdMap.set(se.id, newId);
      await db.execute('INSERT INTO routine_section_exercises', [{ ...se, id: newId, routine_section_id: sectionIdMap.get(se.routine_section_id)! }]);
    }

    for (const set of sets) {
      await db.execute('INSERT INTO routine_section_exercise_sets', [{ ...set, id: uuidv4(), routine_section_exercise_id: secExIdMap.get(set.routine_section_exercise_id)! }]);
    }

    const groupIdMap = new Map<string, string>();
    for (const group of groups) {
      const newId = uuidv4();
      groupIdMap.set(group.id, newId);
      await db.execute('INSERT INTO workout_groups', [{ ...group, id: newId, routine_section_id: sectionIdMap.get(group.routine_section_id!)! }]);
    }

    for (const ge of groupExs) {
      await db.execute('INSERT INTO workout_group_exercises', [{
        ...ge,
        id: uuidv4(),
        workout_group_id: groupIdMap.get(ge.workout_group_id)!,
        routine_section_id: ge.routine_section_id ? sectionIdMap.get(ge.routine_section_id) ?? null : null,
      }]);
    }

    await late.refreshData();
    triggerToast(asVersion ? `Created program version ${nextVersion}.` : `Copied routine as "${newName}".`);
  };

  const handleCopyRoutine = (routineId: string) => copyRoutine(routineId, false);
  const handleCreateRoutineVersion = (routineId: string) => copyRoutine(routineId, true);

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
    await late.refreshData();
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
      sort_order: editorSections.length + 1,
      week_number: editingRoutine.current_week ?? 1,
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

  const handleAddExerciseToSection = async (sectionId: string, exerciseId: string) => {
    const secExs = editorSectionExercises.filter(se => se.routine_section_id === sectionId);
    const newRseId = uuidv4();
    const newRse: RoutineSectionExercise = {
      id: newRseId,
      routine_section_id: sectionId,
      exercise_id: exerciseId,
      sort_order: secExs.length + 1,
      populate_sets_type: 1
      ,progression_enabled: false,
      progression_increment: null,
      progression_reps_step: 1,
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
    // New sets copy the previous set; the first set starts blank (blank fields
    // carry over from the previous workout when the routine is loaded).
    const newSet: RoutineSectionExerciseSet = {
      id: uuidv4(),
      routine_section_exercise_id: rseId,
      metric_weight: lastSet?.metric_weight ?? null,
      reps: lastSet?.reps ?? null,
      sort_order: exSets.length + 1,
      distance: lastSet?.distance ?? null,
      duration_seconds: lastSet?.duration_seconds ?? null,
      unit: lastSet?.unit ?? (userUnit === 'kg' ? 1 : 2)
      ,min_reps: lastSet?.min_reps ?? null,
      max_reps: lastSet?.max_reps ?? null,
      set_type: lastSet?.set_type ?? 'working',
      target_rir: lastSet?.target_rir ?? null,
      tempo: lastSet?.tempo ?? null,
      notes: lastSet?.notes ?? null,
    };
    await db.execute('INSERT INTO routine_section_exercise_sets', [newSet]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set added to template exercise.');
  };

  // Change how an exercise's sets are populated when its routine is loaded
  // (0 = don't populate, 1 = predefined sets, 2 = copy previous workout).
  const handleUpdatePopulateSetsType = async (rseId: string, populateSetsType: number) => {
    const allSecExs = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const target = allSecExs.find(se => se.id === rseId);
    if (!target) return;
    await db.execute('UPDATE routine_section_exercises', [{ ...target, populate_sets_type: populateSetsType }]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
  };

  const handleDeleteSetFromTemplateExercise = async (setId: string) => {
    await db.execute('DELETE FROM routine_section_exercise_sets WHERE id = ?', [setId]);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set deleted from template exercise.');
  };

  const handleUpdateTemplateSetValues = async (setId: string, values: Partial<Pick<RoutineSectionExerciseSet, 'metric_weight' | 'reps' | 'distance' | 'duration_seconds' | 'min_reps' | 'max_reps' | 'set_type' | 'target_rir' | 'tempo' | 'notes'>>) => {
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

  const handleUpdateRoutineSectionExercise = async (rseId: string, values: Partial<RoutineSectionExercise>) => {
    const target = editorSectionExercises.find(se => se.id === rseId);
    if (!target) return;
    await db.execute('UPDATE routine_section_exercises', [{ ...target, ...values }]);
    if (editingRoutine) await loadEditorData(editingRoutine.id);
  };

  const handleUpdateSectionSchedule = async (sectionId: string, values: Partial<Pick<RoutineSection, 'week_number' | 'day_of_week' | 'phase'>>) => {
    const target = editorSections.find(section => section.id === sectionId);
    if (!target) return;
    await db.execute('UPDATE routine_sections', [{ ...target, ...values }]);
    if (editingRoutine) await loadEditorData(editingRoutine.id);
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
    if (!editingRoutine) return;
    // Route through the shared populate path so each exercise's populate_sets_type
    // (predefined / copy previous / none) is honored.
    await handleImportRoutinePopulated(editingRoutine.id, 'template', 75, sectionId);
    setActiveTab('log');
  };

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

  return {
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
  };
}
