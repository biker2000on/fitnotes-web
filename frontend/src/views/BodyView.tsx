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
import { RefreshCw, Scale, Trash2, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { kgToLbs } from '../lib/units';
import { getLocalDateString } from '../lib/date';
import { exponentialMovingAverage } from '../lib/trends';

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
    handleDeleteWeight,
    withingsConnected,
    withingsSyncing,
    syncWithings
  } = useFitNotesStore();
  const [showLogModal, setShowLogModal] = useState(false);
  const [entryDate, setEntryDate] = useState(getLocalDateString());
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>('1Y');
  const [xDomain, setXDomain] = useState<[number, number] | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  const rawBodyData = useMemo(() => {
    return [...bodyWeights]
      .filter(w => !w.is_deleted)
      .sort((a, b) => (a.measured_at || a.date).localeCompare(b.measured_at || b.date))
      .map(w => {
        const measuredAt = w.measured_at && !Number.isNaN(Date.parse(w.measured_at))
          ? w.measured_at
          : `${w.date}T00:00:00`;
        const weight = userUnit === 'lbs' ? kgToLbs(w.body_weight_metric) : w.body_weight_metric;
        return {
          id: w.id,
          date: w.date,
          measuredAt,
          timestamp: new Date(measuredAt).getTime(),
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
    let data = rawBodyData;

    if (useMonthlyAverages) {
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

      data = Array.from(months.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(bucket => ({
          id: `month-${bucket.date}`,
          date: bucket.date,
          measuredAt: `${bucket.date}T00:00:00`,
          timestamp: bucket.timestamp,
          weight: Math.round((bucket.weightTotal / bucket.weightCount) * 10) / 10,
          bodyFat: bucket.fatCount === 0 ? null : Math.round((bucket.fatTotal / bucket.fatCount) * 10) / 10,
        }));
    }

    const weightEwma = exponentialMovingAverage(data.map(row => row.weight));
    const bodyFatEwma = exponentialMovingAverage(data.map(row => row.bodyFat));
    return data.map((row, index) => ({
      ...row,
      weightEwma: weightEwma[index],
      bodyFatEwma: bodyFatEwma[index],
    }));
  }, [rawBodyData, useMonthlyAverages]);

  const shortDate = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const shortDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
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
    await handleAddWeight(entryDate);
    setShowLogModal(false);
  };

  const openLogModal = () => {
    setEntryDate(getLocalDateString());
    setShowLogModal(true);
  };

  const unitLabel = userUnit === 'kg' ? 'kg' : 'lb';
  const entries = [...rawBodyData].reverse();
  const visibleEntries = showAllEntries ? entries : entries.slice(0, 14);
  const formatEntryDate = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric' });
  };
  const formatValueTick = (value: number) => String(Math.round(value * 10) / 10);

  const tooltipStyle = {
    backgroundColor: 'var(--bg-surface-dark)',
    borderColor: 'var(--border-dark)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary-dark)'
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card" style={{ gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">Weight</div>
            <div className="field-hint">
              {rawBodyData.length} weigh-in{rawBodyData.length === 1 ? '' : 's'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={openLogModal}>
              <Scale size={16} aria-hidden /> Log weigh-in
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

        <dl className="body-figures">
          <div className="body-figure">
            <dt className="field-label">Latest weight</dt>
            <dd>
              <span className="body-figure-num">{latest ? latest.weight : '–'}</span>
              {latest && <span className="sv-unit">{userUnit === 'kg' ? 'kg' : 'lb'}</span>}
            </dd>
            {weightDelta != null && (
              <dd className="field-hint">{weightDelta > 0 ? '+' : ''}{weightDelta} {userUnit === 'kg' ? 'kg' : 'lb'} since {shortDate(first.date)}</dd>
            )}
          </div>
          <div className="body-figure">
            <dt className="field-label">Latest body fat</dt>
            <dd>
              <span className="body-figure-num">{latestFat == null ? '–' : latestFat}</span>
              {latestFat != null && <span className="sv-unit">%</span>}
            </dd>
            <dd className="field-hint">{fatPoints.length} reading{fatPoints.length === 1 ? '' : 's'}</dd>
          </div>
        </dl>

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
                style={{ minHeight: '32px', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: '12px' }}
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Raw · <span style={{ color: 'var(--accent)' }}>EWMA</span> · {unitLabel}</span>
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
                    <CartesianGrid stroke="var(--line)" vertical={false} />
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
                    <YAxis width={48} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={formatValueTick} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }} />
                    {selectionStart != null && selectionEnd != null && (
                      <ReferenceArea x1={selectionStart} x2={selectionEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.16} />
                    )}
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => shortDateTime(Number(value))}
                      formatter={(value, name) => [`${value} ${unitLabel}`, name]}
                    />
                    <Line type="monotone" dataKey="weight" name="Weight" stroke="var(--fg-muted)" strokeWidth={1.5} strokeOpacity={0.6} dot={false} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="weightEwma" name="Weight EWMA" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary-dark)', textTransform: 'uppercase' }}>Body Fat</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Raw · <span style={{ color: 'var(--accent)' }}>EWMA</span> · %</span>
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
                    <CartesianGrid stroke="var(--line)" vertical={false} />
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
                    <YAxis width={48} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={formatValueTick} tick={{ fill: 'var(--text-secondary-dark)', fontSize: 12 }} />
                    {selectionStart != null && selectionEnd != null && (
                      <ReferenceArea x1={selectionStart} x2={selectionEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.16} />
                    )}
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => shortDateTime(Number(value))}
                      formatter={(value, name) => [`${value}%`, name]}
                    />
                    <Line type="monotone" dataKey="bodyFat" name="Body Fat" stroke="var(--fg-muted)" strokeWidth={1.5} strokeOpacity={0.6} dot={false} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="bodyFatEwma" name="Body Fat EWMA" stroke="var(--accent)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {entries.length > 0 && (
        <section className="weighins" aria-labelledby="weighins-title">
          <h2 id="weighins-title" className="section-title">Weigh-ins</h2>
          <ol className="weighin-list">
            {visibleEntries.map(entry => (
              <li key={entry.id} className="weighin-row">
                <span className="weighin-date">{formatEntryDate(entry.date)}</span>
                <span className="weighin-value"><span className="sv-num">{entry.weight}</span><span className="sv-unit">{unitLabel}</span></span>
                <span className="weighin-fat">{entry.bodyFat != null ? `${entry.bodyFat}%` : ''}</span>
                <button type="button" className="icon-btn" onClick={() => handleDeleteWeight(entry.id)} aria-label={`Delete weigh-in from ${formatEntryDate(entry.date)}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          {entries.length > 14 && (
            <button type="button" className="btn btn-ghost" onClick={() => setShowAllEntries(v => !v)}>
              {showAllEntries ? 'Show recent only' : `Show all ${entries.length}`}
            </button>
          )}
        </section>
      )}

      {showLogModal && (
        <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="mobile-modal-header">
              <div>
                <h2>Log weigh-in</h2>
              </div>
              <button className="btn btn-secondary icon-btn" onClick={() => setShowLogModal(false)} aria-label="Close weight entry">
                <X size={18} />
              </button>
            </div>
            <div className="mobile-modal-scroll">
              <label className="field">
                <span className="field-label">Date</span>
                <input type="date" value={entryDate} max={getLocalDateString()} onChange={(e) => setEntryDate(e.target.value || getLocalDateString())} />
              </label>
              <label className="field">
                <span className="field-label">Weight ({unitLabel})</span>
                <input type="number" inputMode="decimal" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} autoFocus />
              </label>
              <label className="field">
                <span className="field-label">Body fat % (optional)</span>
                <input type="number" inputMode="decimal" value={newFat} onChange={(e) => setNewFat(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowLogModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveWeight} style={{ flex: 1 }}>
                  Save weigh-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
