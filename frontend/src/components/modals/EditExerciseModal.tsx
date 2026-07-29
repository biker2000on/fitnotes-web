// EditExerciseModal.tsx - Edit Exercise Modal (name, category, type, guidance, etc.).
import { Dumbbell } from 'lucide-react';
import { typeHasWeight } from '../../lib/units';
import { ALL_MUSCLES, MUSCLE_DISPLAY, exerciseMuscleTargets, type MuscleKey } from '../../lib/muscles';
import MuscleDiagram from '../MuscleDiagram';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function EditExerciseModal() {
  const {
    showEditExModal, setShowEditExModal, editingExercise, editExName, setEditExName, editExCategory, setEditExCategory,
    editExType, setEditExType, editExNotes, setEditExNotes, editExWeightIncrement, setEditExWeightIncrement,
    editExGuidance, setEditExGuidance,
    editExDefaultRestTime, setEditExDefaultRestTime, editExWeightUnit, setEditExWeightUnit,
    editExIsFavourite, setEditExIsFavourite, handleUpdateExercise, handleDeleteExercise,
    categories,
  } = useFitNotesStore();

  if (!showEditExModal || !editingExercise) return null;

  // Muscle targets parsed from the (possibly free-text) guidance fields.
  // Clicking a region cycles none -> primary -> secondary -> none and writes
  // canonical names back, keeping the text inputs below in sync.
  const muscleTargets = exerciseMuscleTargets({
    primary_muscles: editExGuidance.primary_muscles,
    secondary_muscles: editExGuidance.secondary_muscles,
  });
  const cycleMuscle = (muscle: MuscleKey) => {
    const primary = new Set(muscleTargets.primary);
    const secondary = new Set(muscleTargets.secondary);
    if (primary.has(muscle)) {
      primary.delete(muscle);
      secondary.add(muscle);
    } else if (secondary.has(muscle)) {
      secondary.delete(muscle);
    } else {
      primary.add(muscle);
    }
    const toText = (set: Set<MuscleKey>) =>
      ALL_MUSCLES.filter(m => set.has(m)).map(m => MUSCLE_DISPLAY[m]).join(', ');
    setEditExGuidance({
      ...editExGuidance,
      primary_muscles: toText(primary),
      secondary_muscles: toText(secondary),
    });
  };

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowEditExModal(false)}>
      <div className="modal-content mobile-modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Dumbbell size={20} color="var(--primary)" /> Edit Exercise</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowEditExModal(false)}>Close</button>
        </div>

        <div className="mobile-modal-scroll">
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Name</label>
            <input type="text" value={editExName} onChange={(e) => setEditExName(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Category</label>
            <select value={editExCategory} onChange={(e) => setEditExCategory(e.target.value)}>
              <option value="">Uncategorized / Misc</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Type</label>
              <select value={editExType} onChange={(e) => setEditExType(e.target.value)}>
                <option value="0">Weight & Reps</option>
                <option value="2">Reps Only</option>
                <option value="3">Distance & Time</option>
                <option value="4">Distance Only</option>
                <option value="5">Time Only</option>
                <option value="6">Weight & Distance</option>
                <option value="7">Weight & Time</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Default Rest Time (s)</label>
              <input type="number" value={editExDefaultRestTime} onChange={(e) => setEditExDefaultRestTime(e.target.value)} />
            </div>
          </div>

          {typeHasWeight(parseInt(editExType)) && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Default Weight Unit</label>
                <select value={editExWeightUnit} onChange={(e) => setEditExWeightUnit(e.target.value)}>
                  <option value="1">kg</option>
                  <option value="2">lbs</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight Increment</label>
                <input type="number" step="0.5" value={editExWeightIncrement} onChange={(e) => setEditExWeightIncrement(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Notes / Tips</label>
            <input type="text" placeholder="e.g. Keep shoulder blades retracted" value={editExNotes} onChange={(e) => setEditExNotes(e.target.value)} />
          </div>

          <div style={{ border: '1px solid var(--border-dark)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>Muscles Worked</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginBottom: '10px' }}>
              Click a muscle to cycle: red = primary, yellow = secondary, click again to clear.
            </div>
            <MuscleDiagram
              primary={muscleTargets.primary}
              secondary={muscleTargets.secondary}
              height={190}
              showLegend={false}
              onMuscleClick={cycleMuscle}
            />
            <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
              <input type="text" placeholder="Primary muscles (e.g. Chest, Front Delts)" value={editExGuidance.primary_muscles} onChange={(e) => setEditExGuidance({ ...editExGuidance, primary_muscles: e.target.value })} />
              <input type="text" placeholder="Secondary muscles (e.g. Triceps)" value={editExGuidance.secondary_muscles} onChange={(e) => setEditExGuidance({ ...editExGuidance, secondary_muscles: e.target.value })} />
            </div>
          </div>

          <details style={{ border: '1px solid var(--border-dark)', borderRadius: '10px', padding: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Guidance, video & alternatives</summary>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input type="text" placeholder="Aliases (comma separated)" value={editExGuidance.aliases} onChange={(e) => setEditExGuidance({ ...editExGuidance, aliases: e.target.value })} />
              <textarea placeholder="Step-by-step instructions and coaching cues" value={editExGuidance.instructions} onChange={(e) => setEditExGuidance({ ...editExGuidance, instructions: e.target.value })} rows={4} />
              <input type="url" placeholder="Reference video URL" value={editExGuidance.video_url} onChange={(e) => setEditExGuidance({ ...editExGuidance, video_url: e.target.value })} />
              <input type="text" placeholder="Equipment" value={editExGuidance.equipment} onChange={(e) => setEditExGuidance({ ...editExGuidance, equipment: e.target.value })} />
              <input type="text" placeholder="Regressions" value={editExGuidance.regressions} onChange={(e) => setEditExGuidance({ ...editExGuidance, regressions: e.target.value })} />
              <input type="text" placeholder="Progressions" value={editExGuidance.progressions} onChange={(e) => setEditExGuidance({ ...editExGuidance, progressions: e.target.value })} />
              <input type="text" placeholder="Substitutions" value={editExGuidance.substitutions} onChange={(e) => setEditExGuidance({ ...editExGuidance, substitutions: e.target.value })} />
            </div>
          </details>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input type="checkbox" id="editExFav" checked={editExIsFavourite} onChange={(e) => setEditExIsFavourite(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            <label htmlFor="editExFav" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Mark as Favorite Exercise</label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleUpdateExercise} style={{ flex: 2 }}>Save Exercise</button>
            <button className="btn btn-danger" onClick={() => handleDeleteExercise(editingExercise.id)} style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
