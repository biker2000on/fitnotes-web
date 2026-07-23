// Withings integration slice: connection status, OAuth hand-off, and weight
// sync. Code moved verbatim from FitNotesStore.tsx.
import { useState, useEffect } from 'react';
import { getApiBaseUrl } from './shared';
import type { TriggerToast } from './types';

export interface WithingsSliceDeps {
  token: string;
  triggerToast: TriggerToast;
  triggerSync: (options?: { background?: boolean }) => Promise<void>;
}

export function useWithingsSlice(deps: WithingsSliceDeps) {
  const { token, triggerToast, triggerSync } = deps;

  // Withings Integration States
  const [withingsConnected, setWithingsConnected] = useState(false);
  const [withingsLastSync, setWithingsLastSync] = useState<string | null>(null);
  const [withingsSyncing, setWithingsSyncing] = useState(false);

  const fetchWithingsStatus = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWithingsConnected(!!data.connected);
        setWithingsLastSync(data.last_sync || null);
      }
    } catch (e) {
      console.warn("Failed to fetch Withings status:", e);
    }
  };

  const connectWithings = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/auth-url`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to get authorization URL");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      triggerToast("Failed to initiate Withings connection", "error");
    }
  };

  const disconnectWithings = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWithingsConnected(false);
        setWithingsLastSync(null);
        triggerToast("Withings account disconnected successfully!");
      } else {
        throw new Error();
      }
    } catch (e) {
      triggerToast("Failed to disconnect Withings account", "error");
    }
  };

  const syncWithings = async () => {
    if (!token) return;
    setWithingsSyncing(true);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const res = await fetch(`${apiBaseUrl}/api/withings/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to sync weight logs");
      }
      const data = await res.json();
      triggerToast(`Successfully pulled ${data.records_pulled} weight records from Withings!`);
      await triggerSync();
      await fetchWithingsStatus();
    } catch (e: any) {
      triggerToast(e.message || "Failed to sync weights", "error");
    } finally {
      setWithingsSyncing(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('withings_connected') === 'true') {
      triggerToast("Withings account connected successfully!");
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      triggerSync();
      fetchWithingsStatus();
    } else if (params.get('withings_error')) {
      const err = params.get('withings_error');
      triggerToast(`Withings connection failed: ${err}`, "error");
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [token]);

  return {
    withingsConnected, setWithingsConnected, withingsLastSync, setWithingsLastSync,
    withingsSyncing, setWithingsSyncing,
    fetchWithingsStatus, connectWithings, disconnectWithings, syncWithings,
  };
}
