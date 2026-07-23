// BulkMoveModal.tsx - Move selected sets to another date.
import { useFitNotesStore } from '../../store/FitNotesStore';

export function BulkMoveModal() {
  const {
    showBulkMoveModal, setShowBulkMoveModal, bulkMoveTargetDate, setBulkMoveTargetDate,
    handleBulkMoveConfirm, selectedLogIdsForGroup,
  } = useFitNotesStore();

  if (!showBulkMoveModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowBulkMoveModal(false)} style={{ zIndex: 100000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '400px',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-dark)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary-dark)' }}>Move sets to another date</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Choose target date to reschedule {selectedLogIdsForGroup.length} sets</span>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Target Date</label>
          <input
            type="date"
            value={bulkMoveTargetDate}
            onChange={(e) => setBulkMoveTargetDate(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleBulkMoveConfirm(bulkMoveTargetDate)}>Move sets</button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBulkMoveModal(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
