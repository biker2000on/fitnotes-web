// MeasurementsView.tsx - Custom body-measurement tracker (neck, chest, ...).
import { useEffect, useMemo, useState } from 'react';
import { Ruler, Plus, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useFitNotesStore } from '../store/FitNotesStore';
import type { Measurement, MeasurementRecord } from '../types';

import type { CustomUnit } from '../types';

// Resolve a measurement unit_id to its label. Built-in: 1 cm, 2 in, 3 %.
// Custom units use unit_id = 100 + (index in custom_units sorted by id).
const resolveUnit = (unitId: number, custom: CustomUnit[]): string => {
  if (unitId >= 100) {
    const sorted = [...custom].filter(c => !c.is_deleted).sort((a, b) => a.id.localeCompare(b.id));
    return sorted[unitId - 100]?.abbreviation ?? '?';
  }
  return unitId === 3 ? '%' : unitId === 2 ? 'in' : 'cm';
};

export function MeasurementsView() {
  const {
    measurements, measurementRecords, loadMeasurementRecords,
    saveMeasurement, deleteMeasurement, saveMeasurementRecord, deleteMeasurementRecord,
    selectedDate, uuidv4, customUnits, saveCustomUnit,
  } = useFitNotesStore();

  const activeCustomUnits = customUnits.filter(c => !c.is_deleted).sort((a, b) => a.id.localeCompare(b.id));
  const addCustomUnit = () => {
    const name = window.prompt('Custom unit name (e.g. Stone)');
    if (!name) return;
    const abbr = window.prompt('Abbreviation (e.g. st)') || name.slice(0, 3);
    saveCustomUnit({ id: uuidv4(), name, abbreviation: abbr, type: 2, conversion_to_base: 1 });
  };

  const [selectedId, setSelectedId] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [recordComment, setRecordComment] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState(1);

  const selected = measurements.find(m => m.id === selectedId) ?? measurements[0];
  const graphData = useMemo(
    () => measurementRecords.filter(r => !r.is_deleted).map(r => ({ date: r.date, value: r.value })).sort((a, b) => a.date.localeCompare(b.date)),
    [measurementRecords],
  );

  // Default to first measurement and load its records.
  useEffect(() => {
    if (!selectedId && measurements.length > 0) {
      setSelectedId(measurements[0].id);
    }
  }, [measurements, selectedId]);

  useEffect(() => {
    if (selected) loadMeasurementRecords(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const addMeasurement = () => {
    if (!newName.trim()) return;
    const m: Measurement = {
      id: uuidv4(), name: newName.trim(), unit_id: newUnit,
      goal_type: null, goal_value: null, custom: true, enabled: true,
      sort_order: measurements.length,
    };
    saveMeasurement(m);
    setNewName(''); setShowNew(false);
  };

  const addRecord = () => {
    if (!selected || !recordValue) return;
    const now = new Date();
    const rec: MeasurementRecord = {
      id: uuidv4(),
      measurement_id: selected.id,
      date: selectedDate,
      time: now.toTimeString().split(' ')[0],
      value: parseFloat(recordValue),
      comment: recordComment || null,
    };
    saveMeasurementRecord(rec);
    setRecordValue(''); setRecordComment('');
  };

  return (
    <div className="cols-side" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Measurement list */}
      <div className="card" style={{ gap: '8px', alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ margin: 0 }}><Ruler size={16} /> Measurements</div>
          <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowNew(s => !s)} title="Add measurement"><Plus size={14} /></button>
        </div>

        {showNew && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', border: '1px solid var(--border-dark)', borderRadius: '10px' }}>
            <input placeholder="Name (e.g. Wrist)" value={newName} onChange={e => setNewName(e.target.value)} />
            <select value={newUnit} onChange={e => { if (e.target.value === 'custom') { addCustomUnit(); } else { setNewUnit(parseInt(e.target.value, 10)); } }} style={{ padding: '8px' }}>
              <option value={1}>cm</option>
              <option value={2}>inches</option>
              <option value={3}>percent</option>
              {activeCustomUnits.map((u, i) => <option key={u.id} value={100 + i}>{u.name} ({u.abbreviation})</option>)}
              <option value="custom">+ Add custom unit…</option>
            </select>
            <button className="btn btn-primary" style={{ padding: '6px' }} onClick={addMeasurement}>Add</button>
          </div>
        )}

        {measurements.map(m => (
          <div
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
              background: selected?.id === m.id ? 'var(--primary-glow)' : 'transparent',
              border: '1px solid', borderColor: selected?.id === m.id ? 'var(--primary)' : 'var(--border-dark)',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>{resolveUnit(m.unit_id, customUnits)}</span>
              {m.custom && (
                <button onClick={(e) => { e.stopPropagation(); deleteMeasurement(m.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete">
                  <Trash2 size={13} color="var(--danger)" />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Records for selected measurement */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card" style={{ gap: '12px' }}>
          <div className="card-title">Log {selected?.name ?? 'Measurement'} ({selected ? resolveUnit(selected.unit_id, customUnits) : ''})</div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Value</label>
              <input type="number" value={recordValue} onChange={e => setRecordValue(e.target.value)} />
            </div>
            <div style={{ flex: 2, minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Comment (optional)</label>
              <input value={recordComment} onChange={e => setRecordComment(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addRecord}>Save</button>
          </div>
          {selected && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Goal:</span>
              <select value={selected.goal_type ?? 0} onChange={e => saveMeasurement({ ...selected, goal_type: Number(e.target.value) || null })} style={{ padding: '6px' }}>
                <option value={0}>None</option><option value={1}>Increase to</option><option value={2}>Decrease to</option><option value={3}>Reach</option>
              </select>
              {(selected.goal_type ?? 0) !== 0 && (
                <input type="number" defaultValue={selected.goal_value ?? ''} placeholder="Target"
                  onBlur={e => saveMeasurement({ ...selected, goal_value: e.target.value ? parseFloat(e.target.value) : null })}
                  style={{ width: '100px', padding: '6px' }} />
              )}
            </div>
          )}
        </div>

        {graphData.length > 1 && (
          <div className="card">
            <div className="card-title">Progress</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} />
                  <YAxis stroke="var(--text-secondary-dark)" style={{ fontSize: '11px' }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface-dark)', borderColor: 'var(--border-dark)' }} />
                  {selected?.goal_value != null && <ReferenceLine y={selected.goal_value} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: 'Goal', fill: 'var(--accent)', fontSize: 10 }} />}
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <div className="card-title">History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {measurementRecords.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '24px' }}>No records logged yet.</p>
            ) : (
              measurementRecords.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-dark)', borderRadius: '10px', fontSize: '14px' }}>
                  <span style={{ fontWeight: 600 }}>{r.date}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{r.value} {selected ? resolveUnit(selected.unit_id, customUnits) : ''}</span>
                    {r.comment && <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>{r.comment}</span>}
                    <button onClick={() => deleteMeasurementRecord(r.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
