// CreateRoutineModal.tsx - Routine Creator Modal — name + notes only; days and
// exercises are added in the routine editor afterwards (reference app flow).
import { Bookmark } from 'lucide-react';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function CreateRoutineModal() {
  const {
    showCreateRoutineModal, setShowCreateRoutineModal, newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes,
    handleCreateRoutineTemplate, newRoutineCategory, setNewRoutineCategory, routines,
  } = useFitNotesStore();

  if (!showCreateRoutineModal) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowCreateRoutineModal(false)}>
      <div className="modal-content mobile-modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Bookmark size={20} color="var(--primary)" /> Create Routine</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowCreateRoutineModal(false)}>Close</button>
        </div>

        <div className="mobile-modal-scroll">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Routine Name</label>
              <input
                type="text"
                placeholder="e.g. Push Pull Legs, 5/3/1"
                value={newRoutineName}
                onChange={(e) => setNewRoutineName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoutineTemplate(); }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Category (optional)</label>
              <input
                type="text"
                list="routine-category-options"
                placeholder="e.g. ATG, Dialed Health"
                value={newRoutineCategory}
                onChange={(e) => setNewRoutineCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoutineTemplate(); }}
              />
              <datalist id="routine-category-options">
                {Array.from(new Set(routines.map(r => (r.category ?? '').trim()).filter(Boolean))).sort().map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Notes (optional)</label>
              <input
                type="text"
                placeholder="Warmup 5 min, then complete sets with 2 min rest"
                value={newRoutineNotes}
                onChange={(e) => setNewRoutineNotes(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoutineTemplate(); }}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', margin: 0 }}>
              You'll add workout days and exercises next, in the routine editor.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleCreateRoutineTemplate} style={{ width: '100%', height: '46px', flexShrink: 0, marginTop: '8px' }}>
            Create & Open Editor
          </button>
        </div>
      </div>
    </div>
  );
}
