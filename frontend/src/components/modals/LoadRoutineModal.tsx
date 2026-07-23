// LoadRoutineModal.tsx - Routine Import Picker Modal Drawer.
import { Bookmark } from 'lucide-react';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function LoadRoutineModal() {
  const {
    showRoutineImportModal, setShowRoutineImportModal, routines, setActiveRoutineForPopulate,
  } = useFitNotesStore();

  if (!showRoutineImportModal) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowRoutineImportModal(false)}>
      <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-modal-header">
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Bookmark size={20} color="var(--primary)" /> Select Routine to Load</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowRoutineImportModal(false)}>Close</button>
        </div>

        <div className="mobile-modal-scroll">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Choose a template to automatically load its exercises and target sets into today's log:</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {routines.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary-dark)' }}>No routines constructed yet.</p>
            ) : (
              [...routines].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map(r => (
                <button
                  key={r.id}
                  className="btn btn-secondary"
                  onClick={() => {
                    setActiveRoutineForPopulate(r);
                    setShowRoutineImportModal(false);
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '16px', borderRadius: '16px' }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary-dark)', textAlign: 'left' }}>{r.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', marginTop: '4px', textAlign: 'left' }}>{r.notes || 'No description notes added.'}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
