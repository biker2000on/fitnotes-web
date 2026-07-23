// Exercises + categories slice: catalog CRUD, category management, the edit
// exercise modal (incl. guidance editor), favourites, and exercise merging.
// Code moved verbatim from FitNotesStore.tsx.
import { useState, type MouseEvent, type MutableRefObject } from 'react';
import { db } from '../../storage/db';
import { uuidv4 } from '../../lib/uuid';
import { hexToSignedArgb } from '../../lib/colors';
import { getApiBaseUrl } from './shared';
import type { Category, Exercise } from '../../types';
import type { LateDeps, TriggerToast, TriggerConfirm } from './types';

export interface ExercisesSliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  triggerConfirm: TriggerConfirm;
  triggerSync: (options?: { background?: boolean }) => Promise<void>;
  refreshAuthToken: (currentToken?: string, opts?: { force?: boolean }) => Promise<string>;
  tokenRef: MutableRefObject<string>;
}

export function useExercisesSlice(deps: ExercisesSliceDeps) {
  const { late, triggerToast, triggerConfirm, triggerSync, refreshAuthToken, tokenRef } = deps;

  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Exercise creation form
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState('');
  const [newExType, setNewExType] = useState('0'); // 0: Weight & Reps
  const [newExNotes, setNewExNotes] = useState('');

  // Category creation form
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Manage Categories modal states
  const [showManageCatsModal, setShowManageCatsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState('#6366f1');

  // Edit Exercise modal states
  const [showEditExModal, setShowEditExModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExCategory, setEditExCategory] = useState('');
  const [editExType, setEditExType] = useState('1');
  const [editExNotes, setEditExNotes] = useState('');
  const [editExWeightIncrement, setEditExWeightIncrement] = useState('2.5');
  const [editExDefaultRestTime, setEditExDefaultRestTime] = useState('90');
  const [editExWeightUnit, setEditExWeightUnit] = useState('1');
  const [editExIsFavourite, setEditExIsFavourite] = useState(false);
  const [editExGuidance, setEditExGuidance] = useState({
    aliases: '', instructions: '', video_url: '', equipment: '', primary_muscles: '',
    secondary_muscles: '', regressions: '', progressions: '', substitutions: '',
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleToggleExerciseFavourite = async (ex: Exercise, e: MouseEvent) => {
    e.stopPropagation();
    const isFav = !ex.is_favourite;
    await db.execute('UPDATE exercises', [{ ...ex, is_favourite: isFav }]);
    await late.refreshData();
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
    setEditExGuidance({
      aliases: ex.aliases || '', instructions: ex.instructions || '', video_url: ex.video_url || '',
      equipment: ex.equipment || '', primary_muscles: ex.primary_muscles || '',
      secondary_muscles: ex.secondary_muscles || '',
      regressions: ex.regressions || '', progressions: ex.progressions || '', substitutions: ex.substitutions || '',
    });
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
    await late.refreshData();
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
    await late.refreshData();
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
    await late.refreshData();
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
          await late.refreshData();
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
        aliases: editExGuidance.aliases || null,
        instructions: editExGuidance.instructions || null,
        video_url: editExGuidance.video_url || null,
        equipment: editExGuidance.equipment || null,
        primary_muscles: editExGuidance.primary_muscles || null,
        secondary_muscles: editExGuidance.secondary_muscles || null,
        regressions: editExGuidance.regressions || null,
        progressions: editExGuidance.progressions || null,
        substitutions: editExGuidance.substitutions || null,
      };
      await db.execute('INSERT INTO exercises', [updated]);
      setShowEditExModal(false);
      setEditingExercise(null);
      await late.refreshData();
      triggerToast('Exercise updated successfully!');
    };

    // Warn if changing the exercise type while logged sets exist — incompatible
    // fields (e.g. reps when switching to a distance type) won't display.
    const typeChanged = newType !== editingExercise.exercise_type_id;
    const hasLogs = late.allLogs.some(l => l.exercise_id === editingExercise.id && !l.is_deleted);
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
          await late.refreshData();
          triggerToast('Exercise deleted.');
        }
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  const handleMergeExercises = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) {
      triggerToast('Choose two different exercises.', 'error');
      return false;
    }
    if (!tokenRef.current) {
      triggerToast('Sign in before merging exercises.', 'error');
      return false;
    }

    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    // Older browser installs retain the built-in `e-*` catalog after the
    // user's server catalog is pulled. Those records are intentionally never
    // synced, so consolidate them locally instead of submitting an invalid ID
    // to the UUID-only merge endpoint.
    if (!isUuid(sourceId)) {
      const source = exercises.find(ex => ex.id === sourceId);
      const target = exercises.find(ex => ex.id === targetId);
      if (!source || !target) {
        triggerToast('One of the exercises is no longer available.', 'error');
        return false;
      }

      const aliasParts = [target.aliases, source.name, source.aliases]
        .flatMap(value => (value || '').split(','))
        .map(value => value.trim())
        .filter(Boolean);
      const aliases = [...new Set(aliasParts)].join(', ');
      const guidanceFields = ['notes', 'instructions', 'video_url', 'equipment', 'primary_muscles', 'secondary_muscles', 'regressions', 'progressions', 'substitutions'] as const;
      const mergedTarget: Exercise = {
        ...target,
        aliases,
        is_favourite: target.is_favourite || source.is_favourite,
        weight_increment: target.weight_increment ?? source.weight_increment,
        default_rest_time: target.default_rest_time ?? source.default_rest_time,
        weight_unit_id: target.weight_unit_id ?? source.weight_unit_id,
      };
      for (const field of guidanceFields) {
        if (!mergedTarget[field] && source[field]) mergedTarget[field] = source[field];
      }
      await db.execute('UPDATE exercises', [mergedTarget]);

      const referenceTables = [
        'training_logs', 'routine_section_exercises', 'workout_group_exercises',
        'goals', 'barbells', 'exercise_comments', 'graph_favourites',
      ];
      for (const table of referenceTables) {
        const rows = await db.query<any>(`SELECT * FROM ${table}`);
        for (const row of rows.filter(item => item.exercise_id === sourceId)) {
          await db.execute(`UPDATE ${table}`, [{ ...row, exercise_id: targetId }]);
        }
      }

      await db.execute('UPDATE exercises', [{ ...source, is_deleted: true }]);
      await triggerSync();
      await late.refreshData();
      triggerToast('Exercise history, routines, goals and aliases merged.');
      return true;
    }

    if (!isUuid(targetId)) {
      triggerToast('Keep the server-backed exercise record when merging.', 'error');
      return false;
    }

    // Push pending offline edits first so the server performs the merge against
    // the complete dataset, then pull the moved references and tombstone.
    await triggerSync();
    const activeToken = await refreshAuthToken(tokenRef.current);
    const response = await fetch(`${getApiBaseUrl()}/api/exercises/merge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${activeToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      triggerToast(detail.error || 'Exercise merge failed.', 'error');
      return false;
    }
    await triggerSync();
    await late.refreshData();
    triggerToast('Exercise history, routines, goals and aliases merged.');
    return true;
  };

  return {
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
  };
}
