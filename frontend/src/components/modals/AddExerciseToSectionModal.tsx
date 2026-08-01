// AddExerciseToSectionModal.tsx - Add Exercise to Routine Section Modal.
import { Dumbbell } from 'lucide-react';
import { intColorToHex } from '../../lib/colors';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function AddExerciseToSectionModal() {
  const {
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory, editorAddExerciseTargetSectionId, editorExercisePickerMode,
    editorSwitchTargetSectionExerciseId, handleAddExerciseToSection, handleSwitchRoutineSectionExercise,
    isAddingExerciseToSection, isSwitchingRoutineSectionExercise, editorSectionExercises, exercises, categories,
  } = useFitNotesStore();

  const switchTarget = editorSectionExercises.find(item => item.id === editorSwitchTargetSectionExerciseId);
  const targetSectionId = editorExercisePickerMode === 'switch'
    ? switchTarget?.routine_section_id
    : editorAddExerciseTargetSectionId;

  if (!showAddExToSectionModal || !targetSectionId || (editorExercisePickerMode === 'switch' && !switchTarget)) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowAddExToSectionModal(false)}>
      <div className="modal-content mobile-modal-content" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Dumbbell size={20} color="var(--primary)" /> {editorExercisePickerMode === 'switch' ? 'Switch Routine Exercise' : 'Select Exercise to Add'}
          </h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowAddExToSectionModal(false)}>Close</button>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '16px', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Search exercises by name..."
            value={editorExSearchQuery}
            onChange={e => setEditorExSearchQuery(e.target.value)}
            style={{ fontSize: '14px', padding: '10px 14px' }}
          />
        </div>

        {/* Category Filter Pills */}
        <div className="category-pill-row">
          <button
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '20px',
              backgroundColor: editorExSelectedCategory === null ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
              color: editorExSelectedCategory === null ? 'white' : 'var(--text-primary-dark)',
              border: '1px solid var(--border-dark)'
            }}
            onClick={() => setEditorExSelectedCategory(null)}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '20px',
                backgroundColor: editorExSelectedCategory === cat.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                color: editorExSelectedCategory === cat.id ? 'white' : 'var(--text-primary-dark)',
                border: '1px solid var(--border-dark)'
              }}
              onClick={() => setEditorExSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filtered Exercises List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {(() => {
            const filtered = exercises.filter(ex => {
              const matchSearch = ex.name.toLowerCase().includes(editorExSearchQuery.toLowerCase());
              const matchCat = editorExSelectedCategory === null || ex.category_id === editorExSelectedCategory;
              return matchSearch && matchCat && !ex.is_deleted;
            });

            if (filtered.length === 0) {
              return (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary-dark)', fontSize: '13px', padding: '24px' }}>
                  No matching exercises found.
                </p>
              );
            }

            return filtered.map(ex => {
              const cat = categories.find(c => c.id === ex.category_id);
              const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
              const isCurrentExercise = editorExercisePickerMode === 'switch' && switchTarget?.exercise_id === ex.id;
              const existsInTargetSection = editorSectionExercises.some(item =>
                item.id !== switchTarget?.id && !item.is_deleted && item.routine_section_id === targetSectionId && item.exercise_id === ex.id,
              );
              const isSaving = isAddingExerciseToSection || isSwitchingRoutineSectionExercise;
              const unavailable = isSaving || isCurrentExercise || existsInTargetSection;
              const unavailableLabel = isSaving ? 'Saving selection' : isCurrentExercise ? 'Currently selected' : 'Already in this workout day';
              return (
                <button
                  type="button"
                  key={ex.id}
                  className="exercise-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    cursor: unavailable ? 'not-allowed' : 'pointer',
                    opacity: unavailable ? 0.55 : 1,
                    width: '100%',
                    border: 'none',
                    textAlign: 'left',
                  }}
                  disabled={unavailable}
                  aria-label={`${editorExercisePickerMode === 'switch' ? 'Switch to' : 'Add'} ${ex.name}${unavailable ? ` (${unavailableLabel})` : ''}`}
                  onClick={async () => {
                    const completed = editorExercisePickerMode === 'switch'
                      ? await handleSwitchRoutineSectionExercise(switchTarget!.id, ex.id)
                      : await handleAddExerciseToSection(targetSectionId, ex.id);
                    if (completed) setShowAddExToSectionModal(false);
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{ex.name}{unavailable && ` — ${unavailableLabel}`}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: catColor + '20', color: catColor, fontWeight: 700 }}>
                    {cat?.name || 'Misc'}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
