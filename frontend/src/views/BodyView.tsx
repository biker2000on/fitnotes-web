// BodyView.tsx - Body weight logging + history.
import { TrendingUp, FileText } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { kgToLbs } from '../lib/units';

export function BodyView() {
  const {
    userUnit,
    bodyWeights,
    newWeight,
    setNewWeight,
    newFat,
    setNewFat,
    handleAddWeight,
    withingsConnected,
    withingsSyncing,
    syncWithings
  } = useFitNotesStore();
  const formatBodyWeight = (metricWeight: number) => {
    const displayWeight = userUnit === 'lbs' ? kgToLbs(metricWeight) : metricWeight;
    return `${Math.round(displayWeight * 10) / 10} ${userUnit}`;
  };

  return (
    <div className="cols-2" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div className="card">
        <div className="card-title"><TrendingUp size={18} /> Log Today's Weight</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight ({userUnit})</label>
            <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Body Fat % (Optional)</label>
            <input type="number" value={newFat} onChange={(e) => setNewFat(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button className="btn btn-primary" onClick={handleAddWeight} style={{ flex: 1 }}>
              Save Record
            </button>
            {withingsConnected && (
              <button
                className="btn"
                onClick={syncWithings}
                disabled={withingsSyncing}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border-dark)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {withingsSyncing ? 'Syncing...' : 'Sync Scale'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ maxHeight: '350px', overflowY: 'auto' }}>
        <div className="card-title"><FileText size={16} /> Historical Weight Records</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {bodyWeights.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '24px' }}>No body weight logs saved yet.</p>
          ) : (
            bodyWeights.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-dark)', borderRadius: '10px', fontSize: '14px' }}>
                <span style={{ fontWeight: 600 }}>{w.date}</span>
                <span style={{ fontWeight: 700 }}>{formatBodyWeight(w.body_weight_metric)} <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 400 }}>{w.body_fat ? `(${w.body_fat}% BF)` : ''}</span></span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
