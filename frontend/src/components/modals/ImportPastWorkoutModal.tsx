// ImportPastWorkoutModal.tsx - Import Previous Workout Logs Modal.
import { Bookmark } from 'lucide-react';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function ImportPastWorkoutModal() {
  const {
    showPastImporterModal, setShowPastImporterModal, pastImporterTargetSectionId, pastImporterDate, setPastImporterDate,
    pastLoggedDates, handleImportPastLogsToSection,
  } = useFitNotesStore();

  if (!showPastImporterModal || !pastImporterTargetSectionId) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowPastImporterModal(false)}>
      <div className="modal-content mobile-modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Bookmark size={20} color="var(--primary)" /> Import Past Workout
          </h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowPastImporterModal(false)}>Close</button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', margin: 0 }}>
          Select a calendar date to import all exercise templates and logged sets directly into this day section:
        </p>

        <div className="mobile-modal-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          {/* Date Input Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Select Target Date</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="date"
                value={pastImporterDate}
                onChange={e => setPastImporterDate(e.target.value)}
                style={{ fontSize: '14px' }}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleImportPastLogsToSection(pastImporterTargetSectionId, pastImporterDate)}
              >
                Import Date
              </button>
            </div>
          </div>

          {/* Quick Select Recent Workout Dates */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '8px' }}>Or Quick Select Recent Sessions</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {pastLoggedDates.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                  No past workouts logged yet.
                </p>
              ) : (
                pastLoggedDates.map(dStr => (
                  <button
                    key={dStr}
                    className="btn btn-secondary"
                    onClick={() => handleImportPastLogsToSection(pastImporterTargetSectionId, dStr)}
                    style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-primary-dark)' }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{dStr}</span>
                    <span style={{ fontSize: '11px', color: 'var(--primary)' }}>Select & Import</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
