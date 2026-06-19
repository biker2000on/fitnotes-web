// BodyView.tsx - Body weight logging + history.
import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Percent, RefreshCw, Scale, TrendingUp, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { kgToLbs } from '../lib/units';

type TimeRangePreset = '1M' | '1Y' | 'ALL' | 'CUSTOM';

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
  const [showLogModal, setShowLogModal] = useState(false);
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>('1Y');
  const [xDomain, setXDomain] = useState<[number, number] | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  const rawBodyData = useMemo(() => {
    return [...bodyWeights]
      .filter(w => !w.is_deleted)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(w => {
        const weight = userUnit === 'lbs' ? kgToLbs(w.body_weight_metric) : w.body_weight_metric;
        return {
          date: w.date,
          timestamp: new Date(`${w.date}T00:00:00`).getTime(),
          weight: Math.round(weight * 10) / 10,
          bodyFat: w.body_fat == null ? null : Math.round(w.body_fat * 10) / 10,
        };
      });
  }, [bodyWeights, userUnit]);

  const latest = rawBodyData[rawBodyData.length - 1];
  const first = rawBodyData[0];
  const fullDomain = useMemo<[number, number] | null>(() => {
    if (rawBodyData.length === 0) return null;
    return [rawBodyData[0].timestamp, rawBodyData[rawBodyData.length - 1].timestamp];
  }, [rawBodyData]);
  const visibleDomain = xDomain ?? fullDomain;
  const weightDelta = latest && first ? Math.round((latest.weight - first.weight) * 10) / 10 : null;
  const fatPoints = rawBodyData.filter(d => d.bodyFat != null);
  const latestFat = fatPoints[fatPoints.length - 1]?.bodyFat ?? null;
  const minZoomSpan = 1000 * 60 * 60 * 24;
  const visibleSpanDays = visibleDomain ? (visibleDomain[1] - visibleDomain[0]) / minZoomSpan : 0;
  const useMonthlyAverages = rangePreset === 'ALL' || visibleSpanDays > 730;

  const chartData = useMemo(() => {
    if (!useMonthlyAverages) return rawBodyData;

    const months = new Map<string, {
      timestamp: number;
      date: string;
      weightTotal: number;
      weightCount: number;
      fatTotal: number;
      fatCount: number;
    }>();

    for (const row of rawBodyData) {
      const d = new Date(row.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const bucket = months.get(key) ?? {
        timestamp: monthStart.getTime(),
        date: monthStart.toISOString().slice(0, 10),
        weightTotal: 0,
        weightCount: 0,
        fatTotal: 0,
        fatCount: 0,
      };
      bucket.weightTotal += row.weight;
      bucket.weightCount++;
      if (row.bodyFat != null) {
        bucket.fatTotal += row.bodyFat;
        bucket.fatCount++;
      }
      months.set(key, bucket);
    }

    return Array.from(months.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(bucket => ({
        date: bucket.date,
        timestamp: bucket.timestamp,
        weight: Math.round((bucket.weightTotal / bucket.weightCount) * 10) / 10,
        bodyFat: bucket.fatCount === 0 ? null : Math.round((bucket.fatTotal / bucket.fatCount) * 10) / 10,
      }));
  }, [rawBodyData, useMonthlyAverages]);

  const shortDate = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const axisDate = (timestamp: number) => new Date(timestamp);

  const formatAxisTick = (timestamp: number) => {
    const d = axisDate(timestamp);
    if (rangePreset === 'ALL' || visibleSpanDays > 730) {
      return d.toLocaleDateString(undefined, { year: 'numeric' });
    }
    if (visibleSpanDays > 120) {
      return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const axisTicks = useMemo(() => {
    if (!visibleDomain) return undefined;
    const [start, end] = visibleDomain;
    if (end <= start) return undefined;

    const ticks: number[] = [];
    const pushTick = (date: Date) => {
      const ts = date.getTime();
      if (ts >= start && ts <= end) ticks.push(ts);
    };

    if (rangePreset === 'ALL' || visibleSpanDays > 730) {
      const startYear = new Date(start).getFullYear();
      const endYear = new Date(end).getFullYear();
      pushTick(new Date(start));
      for (let year = startYear; year <= endYear; year++) {
        pushTick(new Date(year, 0, 1));
      }
      return Array.from(new Set(ticks)).sort((a, b) => a - b);
    }

    if (visibleSpanDays > 120) {
      const cursor = new Date(start);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      if (cursor.getTime() < start) cursor.setMonth(cursor.getMonth() + 1);
      while (cursor.getTime() <= end) {
        pushTick(cursor);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return ticks.length > 0 ? ticks : undefined;
    }

    const intervalDays = visibleSpanDays > 45 ? 14 : visibleSpanDays > 14 ? 7 : 2;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= end) {
      pushTick(cursor);
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    return ticks.length > 0 ? ticks : undefined;
  }, [rangePreset, visibleDomain, visibleSpanDays]);

  const clampDomain = (start: number, end: number): [number, number] | null => {
    if (!fullDomain) return null;
    const [fullStart, fullEnd] = fullDomain;
    const fullSpan = fullEnd - fullStart;
    if (fullSpan <= 0 || end - start >= fullSpan) return null;

    let nextStart = Math.max(fullStart, start);
    let nextEnd = Math.min(fullEnd, end);
    const nextSpan = nextEnd - nextStart;

    if (nextSpan < minZoomSpan) {
      const center = nextStart + nextSpan / 2;
      nextStart = center - minZoomSpan / 2;
      nextEnd = center + minZoomSpan / 2;
    }
    if (nextStart < fullStart) {
      nextEnd += fullStart - nextStart;
      nextStart = fullStart;
    }
    if (nextEnd > fullEnd) {
      nextStart -= nextEnd - fullEnd;
      nextEnd = fullEnd;
    }

    return [Math.max(fullStart, nextStart), Math.min(fullEnd, nextEnd)];
  };

  const domainForPreset = (preset: Exclude<TimeRangePreset, 'CUSTOM'>): [number, number] | null => {
    if (!fullDomain || preset === 'ALL') return null;
    const [fullStart, fullEnd] = fullDomain;
    const days = preset === '1M' ? 31 : 365;
    const start = Math.max(fullStart, fullEnd - days * minZoomSpan);
    return start <= fullStart ? null : [start, fullEnd];
  };

  useEffect(() => {
    if (!fullDomain) {
      setXDomain(null);
      return;
    }
    if (rangePreset === 'CUSTOM') {
      setXDomain(current => {
        if (!current) return null;
        const [fullStart, fullEnd] = fullDomain;
        if (current[1] < fullStart || current[0] > fullEnd) return null;
        return [Math.max(current[0], fullStart), Math.min(current[1], fullEnd)];
      });
      return;
    }
    setXDomain(domainForPreset(rangePreset));
  }, [fullDomain, rangePreset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLogModal) {
        setShowLogModal(false);
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogModal]);

  const setPreset = (preset: Exclude<TimeRangePreset, 'CUSTOM'>) => {
    setRangePreset(preset);
    setXDomain(domainForPreset(preset));
  };

  const zoomChart = (event: WheelEvent<HTMLDivElement>) => {
    if (!fullDomain || !visibleDomain) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerRatio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0.5;
    const [start, end] = visibleDomain;
    const center = start + (end - start) * pointerRatio;
    const factor = event.deltaY < 0 ? 0.78 : 1.28;
    setXDomain(clampDomain(
      center - (center - start) * factor,
      center + (end - center) * factor
    ));
    setRangePreset('CUSTOM');
  };

  const eventTimestamp = (state: unknown) => {
    const value = (state as { activeLabel?: number | string | null } | null)?.activeLabel;
    const timestamp = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const beginSelection = (state: unknown) => {
    const timestamp = eventTimestamp(state);
    if (timestamp == null) return;
    setSelectionStart(timestamp);
    setSelectionEnd(timestamp);
  };

  const updateSelection = (state: unknown) => {
    if (selectionStart == null) return;
    const timestamp = eventTimestamp(state);
    if (timestamp == null) return;
    setSelectionEnd(timestamp);
  };

  const completeSelection = () => {
    if (selectionStart == null || selectionEnd == null) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    if (end - start >= minZoomSpan) {
      setXDomain(clampDomain(start, end));
      setRangePreset('CUSTOM');
    }
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const saveWeight = async () => {
    await handleAddWeight();
    setShowLogModal(false);
  };

  const tooltipStyle = {
    backgroundColor: 'var(--bg-surface-dark)',
    borderColor: 'var(--border-dark)',
    borderRadius: '8px',
    color: 'var(--text-primary-dark)'
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card" style={{ gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title"><TrendingUp size={18} color="var(--primary)" /> Body Weight</div>
            <div style={{ color: 'var(--text-secondary-dark)', fontSize: '13px', marginTop: '6px' }}>
              {rawBodyData.length} historical record{rawBodyData.length === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
              <Scale size={16} /> Log Weight
            </button>
            {withingsConnected && (
              <button
                className="btn btn-secondary"
                onClick={syncWithings}
                disabled={withingsSyncing}
              >
                <RefreshCw size={16} className={withingsSyncing ? 'spin-animation' : undefined} />
                {withingsSyncing ? 'Syncing...' : 'Sync Scale'}
              </button>
            )}
          </div>
        </div>

        <div className="cols-2" style={{ gap: '12px' }}>
          <div style={{ padding: '14px', border: '1px solid var(--border-dark)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary-dark)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
              <Activity size={15} /> Latest Weight
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{latest ? `${latest.weight} ${userUnit}` : '-'}</div>
            {weightDelta != null && (
              <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>
                {weightDelta > 0 ? '+' : ''}{weightDelta} {userUnit} since {shortDate(first.date)}
              </div>
            )}
          </div>
          <div style={{ padding: '14px', border: '1px solid var(--border-dark)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary-dark)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
              <Percent size={15} /> Latest Body Fat
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>{latestFat == null ? '-' : `${latestFat}%`}</div>
            <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>
              {fatPoints.length} record{fatPoints.length === 1 ? '' : 's'} with body fat
            </div>
          </div>
        </div>

        {rawBodyData.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '48px 24px' }}>No body weight logs saved yet.</p>
        ) : (
          <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
            {(['1M', '1Y', 'ALL'] as const).map(preset => (
              <button
                key={preset}
                className={`btn ${rangePreset === preset ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPreset(preset)}
                style={{ minHeight: '32px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px' }}
              >
                {preset}
              </button>
            ))}
          </div>
          <div
            onWheel={zoomChart}
            style={{ display: 'grid', gridTemplateRows: 'minmax(220px, 1fr) minmax(180px, 0.8fr)', gap: '14px', minHeight: '460px', cursor: selectionStart == null ? 'crosshair' : 'ew-resize' }}
          >
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary-dark)', textTransform: 'uppercase' }}>Weight</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>{userUnit}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    syncId="body-weight-history"
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    onMouseDown={beginSelection}
                    onMouseMove={updateSelection}
                    onMouseUp={completeSelection}
                    onMouseLeave={completeSelection}
                  >
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={visibleDomain ?? ['dataMin', 'dataMax']}
                      allowDataOverflow
                      ticks={axisTicks}
                      tickFormatter={formatAxisTick}
                      minTickGap={28}
                      tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }}
                    />
                    <YAxis width={48} domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }} />
                    {selectionStart != null && selectionEnd != null && (
                      <ReferenceArea x1={selectionStart} x2={selectionEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.16} />
                    )}
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => shortDate(new Date(value).toISOString().slice(0, 10))}
                      formatter={(value) => [`${value} ${userUnit}`, 'Weight']}
                    />
                    <Line type="monotone" dataKey="weight" stroke="var(--primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary-dark)', textTransform: 'uppercase' }}>Body Fat</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>%</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    syncId="body-weight-history"
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    onMouseDown={beginSelection}
                    onMouseMove={updateSelection}
                    onMouseUp={completeSelection}
                    onMouseLeave={completeSelection}
                  >
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={visibleDomain ?? ['dataMin', 'dataMax']}
                      allowDataOverflow
                      ticks={axisTicks}
                      tickFormatter={formatAxisTick}
                      minTickGap={28}
                      tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }}
                    />
                    <YAxis width={48} domain={['dataMin - 2', 'dataMax + 2']} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }} />
                    {selectionStart != null && selectionEnd != null && (
                      <ReferenceArea x1={selectionStart} x2={selectionEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.16} />
                    )}
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => shortDate(new Date(value).toISOString().slice(0, 10))}
                      formatter={(value) => [`${value}%`, 'Body Fat']}
                    />
                    <Line type="monotone" dataKey="bodyFat" stroke="var(--success)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {showLogModal && (
        <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="mobile-modal-header">
              <div>
                <div className="card-title"><Scale size={18} color="var(--primary)" /> Log Weight</div>
                <div style={{ color: 'var(--text-secondary-dark)', fontSize: '12px', marginTop: '4px' }}>Save a body record for today</div>
              </div>
              <button className="btn btn-secondary icon-btn" onClick={() => setShowLogModal(false)} aria-label="Close weight entry">
                <X size={18} />
              </button>
            </div>
            <div className="mobile-modal-scroll">
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight ({userUnit})</label>
                <input type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Body Fat % (Optional)</label>
                <input type="number" value={newFat} onChange={(e) => setNewFat(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowLogModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveWeight} style={{ flex: 1 }}>
                  Save Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
