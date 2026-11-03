// SyncStatusChip.tsx - Compact sync state for the nav rail and More page.
// Offline-first: "not signed in" is a normal state, not a warning.
import { useEffect, useState } from 'react';
import { RefreshCw, CloudOff, Check, AlertTriangle } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

export const formatRelativeTime = (timestamp: string): string => {
  if (!timestamp) return 'never';
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return 'never';
  const diffSec = Math.floor((Date.now() - parsed) / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function SyncStatusChip({ wide = false }: { wide?: boolean }) {
  const { token, syncStatus, lastSyncTime, triggerSync } = useFitNotesStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, [token]);

  if (!token) {
    return (
      <a href="#/sync" className={`sync-chip is-local${wide ? ' is-wide' : ''}`}>
        <CloudOff size={16} aria-hidden />
        <span className="sync-chip-text">
          <span>On this device</span>
          <small>Sign in to sync</small>
        </span>
      </a>
    );
  }

  const state = syncStatus === 'syncing' ? 'syncing' : syncStatus === 'error' ? 'error' : 'ok';
  const label = state === 'syncing' ? 'Syncing…' : state === 'error' ? 'Sync failed' : 'Synced';
  const Icon = state === 'error' ? AlertTriangle : state === 'syncing' ? RefreshCw : Check;

  return (
    <button
      type="button"
      className={`sync-chip is-${state}${wide ? ' is-wide' : ''}`}
      onClick={() => triggerSync()}
      title="Sync now"
    >
      <Icon size={16} aria-hidden className={state === 'syncing' ? 'spin-animation' : undefined} />
      <span className="sync-chip-text">
        <span>{label}</span>
        <small>{state === 'error' ? 'Tap to retry' : formatRelativeTime(lastSyncTime)}</small>
      </span>
    </button>
  );
}
