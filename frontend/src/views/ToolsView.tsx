// ToolsView.tsx - Calculators: 1RM, percentage/set, warmup.
import { useState } from 'react';
import { Calculator, Percent, Flame } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { estimated1RM } from '../lib/stats';

const PCTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const WARMUP = [40, 55, 70, 85];

export function ToolsView() {
  const { userUnit, settings } = useFitNotesStore();
  const [weight, setWeight] = useState('100');
  const [reps, setReps] = useState('5');
  const [working, setWorking] = useState('100');

  const w = parseFloat(weight) || 0;
  const r = parseInt(reps, 10) || 0;
  const capped = Math.min(r, settings.estimated_1rm_max_reps_to_include || 15);
  const oneRm = Math.round(estimated1RM(w, capped));
  const wk = parseFloat(working) || 0;
  const round = (n: number) => Math.round(n * 2) / 2; // nearest 0.5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      <div className="card-title" style={{ margin: 0 }}><Calculator size={18} /> Tools</div>

      <div className="card" style={{ gap: '14px' }}>
        <div className="card-title"><Calculator size={16} /> Estimated 1RM Calculator</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight ({userUnit})</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Reps</label>
            <input type="number" value={reps} onChange={e => setReps(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: '120px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Estimated 1RM</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>{oneRm || '—'} <span style={{ fontSize: '14px', color: 'var(--text-secondary-dark)' }}>{userUnit}</span></div>
          </div>
        </div>
        {oneRm > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px', marginTop: '8px' }}>
            {PCTS.map(p => (
              <div key={p} style={{ textAlign: 'center', padding: '6px', border: '1px solid var(--border-dark)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>{p}%</div>
                <div style={{ fontWeight: 700 }}>{round(oneRm * p / 100)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ gap: '14px' }}>
        <div className="card-title"><Percent size={16} /> Percentage of 1RM</div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Target weights from the estimated 1RM above ({oneRm || 0} {userUnit}).</p>
      </div>

      <div className="card" style={{ gap: '14px' }}>
        <div className="card-title"><Flame size={16} /> Warmup Calculator</div>
        <div style={{ maxWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Working Weight ({userUnit})</label>
          <input type="number" value={working} onChange={e => setWorking(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {WARMUP.map((p, i) => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '8px 12px', border: '1px solid var(--border-dark)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-secondary-dark)' }}>Warmup {i + 1} · {p}%</span>
              <span style={{ fontWeight: 700 }}>{round(wk * p / 100)} {userUnit}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '8px 12px', border: '1px solid var(--primary)', borderRadius: '8px', background: 'var(--primary-glow)' }}>
            <span style={{ fontWeight: 700 }}>Working Set · 100%</span>
            <span style={{ fontWeight: 800 }}>{round(wk)} {userUnit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
