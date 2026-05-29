// RestTimer.tsx - Fixed bottom rest-timer bar with countdown + controls.
import { Pause, Play, X, Plus, Minus, Timer } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function RestTimer() {
  const { restRemaining, restPaused, pauseRestTimer, cancelRestTimer, adjustRestTimer, settings, startRestTimer } = useFitNotesStore();
  if (restRemaining === null) return null;

  const total = settings.rest_timer_seconds || 90;
  const pct = Math.max(0, Math.min(100, (restRemaining / total) * 100));

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'var(--bg-surface-dark)', borderTop: '1px solid var(--border-dark)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', transition: 'width 1s linear' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Timer size={18} color="var(--primary)" />
          <span style={{ fontSize: '22px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: restRemaining <= 5 ? 'var(--danger)' : 'var(--text-primary-dark)' }}>{fmt(restRemaining)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>rest</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => adjustRestTimer(-15)} title="-15s"><Minus size={14} /> 15</button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => adjustRestTimer(15)} title="+15s"><Plus size={14} /> 15</button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={pauseRestTimer} title={restPaused ? 'Resume' : 'Pause'}>
            {restPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => startRestTimer()} title="Restart">Restart</button>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', color: 'var(--danger)' }} onClick={cancelRestTimer} title="Cancel"><X size={14} /></button>
        </div>
      </div>
    </div>
  );
}
