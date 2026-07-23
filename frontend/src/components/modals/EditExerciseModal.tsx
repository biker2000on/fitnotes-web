// EditExerciseModal.tsx - Edit Exercise Modal (name, category, type, guidance, etc.).
import { Dumbbell } from 'lucide-react';
import { typeHasWeight } from '../../lib/units';
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

  return (
    <div className="modal-overlay" onClick={() => setShowEditExModal(false)}>
      <div className="modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Dumbbell size={20} color="var(--primary)" /> Edit Exercise</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowEditExModal(false)}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          <details style={{ border: '1px solid var(--border-dark)', borderRadius: '10px', padding: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Guidance, video & alternatives</summary>
            <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
              <input type="text" placeholder="Aliases (comma separated)" value={editExGuidance.aliases} onChange={(e) => setEditExGuidance({ ...editExGuidance, aliases: e.target.value })} />
              <textarea placeholder="Step-by-step instructions and coaching cues" value={editExGuidance.instructions} onChange={(e) => setEditExGuidance({ ...editExGuidance, instructions: e.target.value })} rows={4} />
              <input type="url" placeholder="Reference video URL" value={editExGuidance.video_url} onChange={(e) => setEditExGuidance({ ...editExGuidance, video_url: e.target.value })} />
              <input type="text" placeholder="Equipment" value={editExGuidance.equipment} onChange={(e) => setEditExGuidance({ ...editExGuidance, equipment: e.target.value })} />
              <input type="text" placeholder="Primary muscles (e.g. Chest, Front Delts)" value={editExGuidance.primary_muscles} onChange={(e) => setEditExGuidance({ ...editExGuidance, primary_muscles: e.target.value })} />
              <input type="text" placeholder="Secondary muscles (e.g. Triceps)" value={editExGuidance.secondary_muscles} onChange={(e) => setEditExGuidance({ ...editExGuidance, secondary_muscles: e.target.value })} />
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
