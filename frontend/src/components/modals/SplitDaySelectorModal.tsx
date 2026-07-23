// SplitDaySelectorModal.tsx - Split Day Selector Modal when importing a routine.
// Loads the selected routine's sections and lets the user pick which day split to start.
import { Bookmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function SplitDaySelectorModal() {
  const { activeRoutineForPopulate, setActiveRoutineForPopulate, setActiveSectionForPopulate } = useFitNotesStore();
  const [populateSections, setPopulateSections] = useState<any[]>([]);

  useEffect(() => {
    if (activeRoutineForPopulate) {
      db.query<any>('SELECT * FROM routine_sections WHERE routine_id = ? ORDER BY sort_order ASC', [activeRoutineForPopulate.id])
        .then(setPopulateSections)
        .catch(err => console.error("Failed to load routine sections:", err));
    } else {
      setPopulateSections([]);
    }
  }, [activeRoutineForPopulate]);

  if (!activeRoutineForPopulate || populateSections.length === 0) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setActiveRoutineForPopulate(null)}>
      <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="mobile-modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Bookmark size={20} color="var(--primary)" /> Select Split Day to Start
          </h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setActiveRoutineForPopulate(null)}>Close</button>
        </div>

        <div className="mobile-modal-scroll">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginBottom: '16px' }}>
          Select which workout day split from <strong>{activeRoutineForPopulate.name}</strong> you want to load:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {populateSections.map(sec => (
            <button
              key={sec.id}
              className="btn btn-secondary"
              onClick={() => {
                setActiveSectionForPopulate(sec);
                setActiveRoutineForPopulate(null);
              }}
              style={{ width: '100%', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary-dark)' }}>{sec.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Start Day Split →</span>
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
