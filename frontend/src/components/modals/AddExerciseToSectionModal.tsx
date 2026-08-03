// AddExerciseToSectionModal.tsx - Add / switch an exercise in a routine section.
// Rendering is delegated to the shared ExercisePicker so this matches the
// workout log picker exactly; this file only supplies the routine-specific
// wiring and the rules for which exercises are unavailable.
import { intColorToHex } from '../../lib/colors';
import { useFitNotesStore } from '../../store/FitNotesStore';
import { ExercisePicker, type PickerExercise, type PickerItemState } from '../ExercisePicker';

export function AddExerciseToSectionModal() {
  const {
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory, editorAddExerciseTargetSectionId, editorExercisePickerMode,
    editorSwitchTargetSectionExerciseId, handleAddExerciseToSection, handleSwitchRoutineSectionExercise,
    isAddingExerciseToSection, isSwitchingRoutineSectionExercise, editorSectionExercises, exercises, categories,
  } = useFitNotesStore();

  const switchTarget = editorSectionExercises.find(item => item.id === editorSwitchTargetSectionExerciseId);
  const isSwitching = editorExercisePickerMode === 'switch';
  const targetSectionId = isSwitching ? switchTarget?.routine_section_id : editorAddExerciseTargetSectionId;

  if (!showAddExToSectionModal || !targetSectionId || (isSwitching && !switchTarget)) return null;

  const isSaving = isAddingExerciseToSection || isSwitchingRoutineSectionExercise;

  const getItemState = (ex: PickerExercise): PickerItemState => {
    if (isSaving) return { disabled: true, reason: 'Saving' };
    if (isSwitching && switchTarget?.exercise_id === ex.id) {
      return { disabled: true, reason: 'Current' };
    }
    const alreadyInSection = editorSectionExercises.some(item =>
      item.id !== switchTarget?.id
      && !item.is_deleted
      && item.routine_section_id === targetSectionId
      && item.exercise_id === ex.id,
    );
    if (alreadyInSection) return { disabled: true, reason: 'Already added' };
    return {};
  };

  return (
    <ExercisePicker
      isOpen
      onClose={() => setShowAddExToSectionModal(false)}
      title={isSwitching ? 'Switch Routine Exercise' : 'Select Exercise to Add'}
      exercises={exercises}
      categories={categories}
      intColorToHex={intColorToHex}
      searchQuery={editorExSearchQuery}
      onSearchChange={setEditorExSearchQuery}
      showCategoryFilter
      selectedCategoryId={editorExSelectedCategory}
      onSelectCategory={setEditorExSelectedCategory}
      getItemState={getItemState}
      onSelectExercise={async (ex) => {
        const completed = isSwitching
          ? await handleSwitchRoutineSectionExercise(switchTarget!.id, ex.id)
          : await handleAddExerciseToSection(targetSectionId, ex.id);
        if (completed) setShowAddExToSectionModal(false);
      }}
    />
  );
}
