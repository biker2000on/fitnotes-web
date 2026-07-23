// SupersetManagerModal.tsx - Superset Link Manager Modal.
import { Layers } from 'lucide-react';
import { intColorToHex } from '../../lib/colors';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function SupersetManagerModal() {
  const {
    showSupersetManagerModal, setShowSupersetManagerModal,
    selectedExIdsForSuperset, setSelectedExIdsForSuperset, supersetColor, setSupersetColor, handleCreateWorkoutSuperset,
    supersetName, setSupersetName, targetSupersetGroupId, setTargetSupersetGroupId, workoutGroups,
    exercises, currentLogs, selectedDate,
  } = useFitNotesStore();

  if (!showSupersetManagerModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSupersetManagerModal(false)}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Layers size={20} color="var(--primary)" /> Link Superset Group</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowSupersetManagerModal(false)}>Close</button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginBottom: '16px' }}>Select two or more exercises from today's workout log to group them into a Superset:</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-dark)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
          {Array.from(new Set(currentLogs.map(l => l.exercise_id))).map(exId => {
            const ex = exercises.find(x => x.id === exId);
            if (!ex) return null;
            const isChecked = selectedExIdsForSuperset.includes(exId);
            return (
              <label key={exId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <input
                  type="checkbox"
                  className="set-select-checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedExIdsForSuperset([...selectedExIdsForSuperset, exId]);
                    } else {
                      setSelectedExIdsForSuperset(selectedExIdsForSuperset.filter(id => id !== exId));
                    }
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{ex.name}</span>
              </label>
            );
          })}
        </div>

        {/* Superset Custom Name Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', marginTop: '16px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Superset Name</label>
          <input
            type="text"
            value={supersetName}
            onChange={(e) => setSupersetName(e.target.value)}
            placeholder="e.g. Superset A, Push Split Superset"
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-dark)', background: 'rgba(255,255,255,0.01)', color: 'var(--text-primary-dark)' }}
          />
        </div>

        {/* Superset Link Action (Add to existing or Create New) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Link Action</label>
          <select
            value={targetSupersetGroupId}
            onChange={(e) => {
              const val = e.target.value;
              setTargetSupersetGroupId(val);
              if (val) {
                const group = workoutGroups.find(g => g.id === val);
                if (group) {
                  setSupersetName(group.name || 'Superset');
                  const hexColor = intColorToHex(group.colour);
                  setSupersetColor(hexColor);
                }
              } else {
                setSupersetName('Superset');
              }
            }}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-dark)', background: 'var(--card-bg-dark)', color: 'var(--text-primary-dark)' }}
          >
            <option value="">+ Create New Superset Group</option>
            {workoutGroups.filter(g => g.date === selectedDate && !g.is_deleted).map(g => (
              <option key={g.id} value={g.id}>Add to: {g.name || 'Unnamed Superset'}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Pick Superset Custom Color Theme</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="color"
              value={supersetColor}
              onChange={(e) => setSupersetColor(e.target.value)}
              style={{ width: '64px', height: '42px', padding: '2px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>{supersetColor}</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleCreateWorkoutSuperset} style={{ width: '100%', height: '46px' }}>
          Link Exercises Now
        </button>
      </div>
    </div>
  );
}
