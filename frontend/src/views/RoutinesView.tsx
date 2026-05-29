// RoutinesView.tsx - List of routine templates with edit / start actions.
import { Bookmark, Plus } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

export function RoutinesView() {
  const {
    routines, setShowCreateRoutineModal, setEditingRoutine, setActiveTab, setActiveRoutineForPopulate,
  } = useFitNotesStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title"><Bookmark size={18} /> Routine Templates</div>
          <button className="btn btn-primary" onClick={() => setShowCreateRoutineModal(true)}>
            <Plus size={16} /> Create Routine Template
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {routines.map(r => (
            <div
              key={r.id}
              style={{
                padding: '20px',
                border: '1px solid var(--border-dark)',
                borderRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.01)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-dark)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)';
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary-dark)' }}>{r.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '4px' }}>{r.notes || 'No notes added.'}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => {
                  setEditingRoutine(r);
                  setActiveTab('routine-editor');
                }}>
                  <Bookmark size={14} /> Edit Template
                </button>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setActiveRoutineForPopulate(r)}>
                  <Bookmark size={14} /> Start Routine
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
