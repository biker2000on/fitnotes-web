// Auth + sync slice: token/session state, login/logout, manual + debounced
// auto-sync, background pull heartbeat, backup import/export, and the OIDC
// return flows. Code moved verbatim from FitNotesStore.tsx.
import { useState, useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { AuthExpiredError, db, isTauri } from '../../storage/db';
import { getApiBaseUrl, getClientType, isAuthExpiredError, type TabId } from './shared';
import type { LateDeps, TriggerToast } from './types';

const SYNC_TABLES = [
  'categories',
  'exercises',
  'training_logs',
  'body_weights',
  'plates',
  'barbells',
  'workout_comments',
  'routines',
  'routine_sections',
  'routine_section_exercises',
  'routine_section_exercise_sets',
  'workout_groups',
  'workout_group_exercises',
  'workout_routines',
  'goals',
  'measurements',
  'measurement_records',
  'exercise_comments',
  'workout_times',
  'custom_units',
  'graph_favourites',
] as const;

export interface SyncSliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
}

export function useSyncSlice(deps: SyncSliceDeps) {
  const { late, triggerToast, setActiveTab } = deps;

  // Auth state
  const [token, setToken] = useState<string>(localStorage.getItem('fn_token') || '');
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('fn_user_email') || '');
  const [customApiUrl, setCustomApiUrl] = useState<string>(() => {
    return (typeof localStorage !== 'undefined' ? localStorage.getItem('fn_api_base_url') : '') || '';
  });
  const updateCustomApiUrl = (url: string) => {
    const trimmed = url.trim();
    setCustomApiUrl(trimmed);
    if (trimmed) {
      localStorage.setItem('fn_api_base_url', trimmed);
    } else {
      localStorage.removeItem('fn_api_base_url');
    }
  };
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const [exporting, setExporting] = useState(false);

  // Keyed on auth *presence*, not the token value: every token refresh mints a
  // new JWT, and re-running dependent effects per refresh created a perpetual
  // refresh -> sync -> setToken -> re-run loop.
  const isAuthenticated = Boolean(token);

  const loadLastSyncTime = async () => {
    if (isTauri()) {
      try {
        const rows = await db.query<{ key: string; value: string }>("SELECT * FROM settings WHERE key = 'last_sync_timestamp'");
        if (rows.length > 0) {
          setLastSyncTime(rows[0].value);
        }
      } catch (e) {
        console.warn("Failed to query last sync timestamp from SQLite:", e);
      }
    } else {
      setLastSyncTime(localStorage.getItem('fn_last_sync_timestamp') || '');
    }
  };

  // Debounced Auto-Sync Setup
  const syncTimeoutRef = useRef<any>(null);
  const syncInFlightRef = useRef(false);
  const syncAgainAfterCurrentRef = useRef(false);
  const tokenRef = useRef(token);
  const hasLocalChangesRef = useRef(false);
  const localChangeVersionRef = useRef(0);
  const lastAutoSyncAttemptRef = useRef(0);
  const lastPullAtRef = useRef(0);
  const lastTokenRefreshAtRef = useRef(0);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const refreshAuthToken = async (currentToken = tokenRef.current, opts: { force?: boolean } = {}): Promise<string> => {
    if (!currentToken) return '';

    // Tokens live for days (7d web / 180d mobile); don't burn a network round
    // trip on every background sync. A stale token still gets one forced
    // refresh-and-retry inside triggerSync before the session is declared dead.
    const now = Date.now();
    if (!opts.force && now - lastTokenRefreshAtRef.current < 10 * 60_000) {
      return currentToken;
    }

    try {
      const refreshUrl = new URL(`${getApiBaseUrl()}/api/auth/refresh`);
      refreshUrl.searchParams.set('client', getClientType());

      const res = await fetch(refreshUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
        },
      });

      if (res.status === 401) {
        throw new AuthExpiredError();
      }

      if (!res.ok) {
        return currentToken;
      }

      const data = await res.json();
      lastTokenRefreshAtRef.current = now;
      if (data?.token) {
        tokenRef.current = data.token;
        setToken(data.token);
        localStorage.setItem('fn_token', data.token);
      }
      if (data?.user?.email) {
        setUserEmail(data.user.email);
        localStorage.setItem('fn_user_email', data.user.email);
      }

      return data?.token || currentToken;
    } catch (e) {
      if (isAuthExpiredError(e)) throw e;
      console.warn('Token refresh skipped:', e);
      return currentToken;
    }
  };

  const hasPendingLocalChanges = async () => {
    if (hasLocalChangesRef.current) return true;
    for (const table of SYNC_TABLES) {
      const rows = await db.query<any>(`SELECT * FROM ${table}`);
      if (rows.some(row => row?.is_dirty === 1 || row?.is_dirty === true)) {
        hasLocalChangesRef.current = true;
        return true;
      }
    }
    const settingsRows = await db.query<any>('SELECT * FROM settings');
    if (settingsRows.some(row => row?.is_dirty === 1 || row?.is_dirty === true)) {
      hasLocalChangesRef.current = true;
      return true;
    }
    return false;
  };

  const triggerAutoSync = async (options: { debounceMs?: number; ignoreInterval?: boolean } = {}) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const now = Date.now();
    if (!options.ignoreInterval && now - lastAutoSyncAttemptRef.current < 10_000) {
      return;
    }

    if (!(await hasPendingLocalChanges())) return;
    lastAutoSyncAttemptRef.current = now;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      triggerSync();
    }, options.debounceMs ?? 5000);
  };

  // Background pull: keeps this device current with edits made on other
  // devices. The protocol is a delta sync (changes since last_sync_timestamp),
  // so these calls are cheap; the throttle just avoids hammering on rapid
  // focus/visibility events. Runs silently - no spinner, no error flash.
  const triggerPullSync = (minIntervalMs = 60_000) => {
    if (!tokenRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (Date.now() - lastPullAtRef.current < minIntervalMs) return;
    triggerSync({ background: true });
  };

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Central change listener for all DB operations
  useEffect(() => {
    if (!token) return;
    const unsubscribe = db.onChange(() => {
      hasLocalChangesRef.current = true;
      localChangeVersionRef.current += 1;
      triggerAutoSync();
    });
    return unsubscribe;
  }, [token]);

  // Keep devices in step without manual syncing, while staying snappy:
  // - reconnect: push pending edits and pull whatever happened while offline
  // - focus/visibility: throttled background pull when returning to the app
  // - interval: slow heartbeat pull while the app stays open
  // All pulls are silent delta syncs and never block interaction.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      triggerAutoSync({ debounceMs: 1000, ignoreInterval: true });
      triggerPullSync(5_000);
    };

    const handleFocus = () => {
      triggerPullSync(60_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerPullSync(60_000);
    };

    // Heartbeat doubles as resume detection: Android freezes the app (and its
    // timers) in the background, so a tick that arrives far later than
    // scheduled means the app just returned to the foreground - pull promptly.
    const HEARTBEAT_MS = 20_000;
    let lastTickAt = Date.now();
    const heartbeat = setInterval(() => {
      const now = Date.now();
      const wasSuspended = now - lastTickAt > HEARTBEAT_MS * 3;
      lastTickAt = now;
      // Tauri's Android WebView reports document.visibilityState as 'hidden'
      // even while foregrounded; rely on suspension detection there instead.
      if (!isTauri() && document.visibilityState !== 'visible') return;
      triggerPullSync(wasSuspended ? 30_000 : 150_000);
    }, HEARTBEAT_MS);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Android delivers no focus/visibilitychange to the WebView on activity
    // resume; the Tauri shell emits this from the native Resumed event.
    let unlistenResume: (() => void) | undefined;
    let disposed = false;
    if (isTauri()) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => listen('app-resumed', () => triggerPullSync(30_000)))
        .then((unlisten) => {
          if (disposed) unlisten();
          else unlistenResume = unlisten;
        })
        .catch((e) => console.warn('Failed to attach app-resumed listener:', e));
    }

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      if (unlistenResume) unlistenResume();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  // Auth logins
  const handleAuth = async (mode: 'login' | 'register') => {
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Please fill out all credentials');
      return;
    }

    setAuthLoading(true);
    try {
      const endpoint = mode === 'login' ? 'login' : 'register';
      const apiBaseUrl = getApiBaseUrl();

      const res = await fetch(`${apiBaseUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          client_type: getClientType(),
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setToken(data.token);
      setUserEmail(data.user.email);
      localStorage.setItem('fn_token', data.token);
      localStorage.setItem('fn_user_email', data.user.email);

      // Invalidate cache: prune previously synced data while preserving local guest offline modifications
      await db.invalidateCache(true);

      setAuthEmail('');
      setAuthPassword('');

      // Complete the first cloud sync before leaving the auth screen so mobile
      // users can see progress while a large account dataset is loading.
      setSyncStatus('syncing');
      await db.sync(data.token, apiBaseUrl);
      hasLocalChangesRef.current = false;
      localChangeVersionRef.current = 0;
      lastPullAtRef.current = Date.now();
      setSyncStatus('success');
      await late.refreshData();
      setActiveTab('log');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      console.error("Authentication failed:", e);
      setSyncStatus('error');
      setAuthError('Connection to API server failed: ' + (e?.message || String(e)));
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setAuthLoading(false);
    }
  };

  const clearSession = (preserveDirty: boolean) => {
    setToken('');
    tokenRef.current = '';
    setUserEmail('');
    localStorage.removeItem('fn_token');
    localStorage.removeItem('fn_user_email');
    localStorage.removeItem('fn_last_sync_timestamp');
    db.invalidateCache(preserveDirty).catch(e => console.warn("Failed to clear database on logout:", e));
  };

  const handleLogout = () => {
    clearSession(false);
  };

  const handleAuthExpired = () => {
    clearSession(true);
    setSyncStatus('error');
    triggerToast('Session expired. Sign in again to continue syncing.', 'error');
    setActiveTab('sync');
  };

  // Synchronize. Background mode runs silently (no spinner, no error flash)
  // and skips the post-sync UI refresh when the server had nothing new.
  const triggerSync = async (options: { background?: boolean } = {}) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    if (syncInFlightRef.current) {
      syncAgainAfterCurrentRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    const background = options.background === true;
    const syncedChangeVersion = localChangeVersionRef.current;
    if (!background) setSyncStatus('syncing');
    try {
      const apiBaseUrl = getApiBaseUrl();
      const refreshedToken = await refreshAuthToken(activeToken);

      let pulled: number | null = null;
      try {
        pulled = await db.sync(refreshedToken, apiBaseUrl);
      } catch (e) {
        if (!isAuthExpiredError(e)) throw e;
        // The throttled token may have gone stale; force one refresh and
        // retry before treating the session as expired.
        const forcedToken = await refreshAuthToken(tokenRef.current, { force: true });
        pulled = await db.sync(forcedToken, apiBaseUrl);
      }

      if (localChangeVersionRef.current === syncedChangeVersion) {
        hasLocalChangesRef.current = false;
      }
      lastPullAtRef.current = Date.now();
      if (!background) setSyncStatus('success');
      if (pulled !== 0) {
        await late.refreshData();
      } else {
        await loadLastSyncTime();
      }
      if (!background) setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      if (isAuthExpiredError(e)) {
        handleAuthExpired();
        return;
      }
      if (background) {
        console.warn('Background sync failed:', e);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    } finally {
      syncInFlightRef.current = false;
      if (syncAgainAfterCurrentRef.current && tokenRef.current) {
        syncAgainAfterCurrentRef.current = false;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          triggerSync();
        }, typeof navigator !== 'undefined' && navigator.onLine === false ? 5000 : 250);
      }
    }
  };

  const handleBackupUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const confirmImport = window.confirm(
      "Are you sure you want to import this FitNotes backup? This will wipe your current database and local data and replace it with the backup content."
    );
    if (!confirmImport) {
      e.target.value = '';
      return;
    }

    setImportStatus('importing');
    try {
      const apiBaseUrl = getApiBaseUrl();

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBaseUrl}/api/import-fitnotes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import backup database');
      }

      // Success! Clear local cache keys
      const keysToClear = [
        'fn_categories',
        'fn_exercises',
        'fn_training_logs',
        'fn_body_weights',
        'fn_plates',
        'fn_barbells',
        'fn_workout_comments',
        'fn_workout_groups',
        'fn_workout_group_exercises',
        'fn_workout_routines',
        'fn_routines',
        'fn_routine_sections',
        'fn_routine_section_exercises',
        'fn_routine_section_exercise_sets',
        'fn_last_sync_timestamp'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));

      setImportStatus('success');

      // Perform full-history synchronization to pull all migrated records from server
      setSyncStatus('syncing');
      await db.sync(token, apiBaseUrl);
      hasLocalChangesRef.current = false;
      localChangeVersionRef.current = 0;
      lastPullAtRef.current = Date.now();
      setSyncStatus('success');
      await late.refreshData();
      setTimeout(() => setSyncStatus('idle'), 3000);

      setTimeout(() => setImportStatus('idle'), 5000);
    } catch (err: any) {
      console.error(err);
      setImportStatus('error');
      alert(`Import failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setImportStatus('idle'), 5000);
    } finally {
      e.target.value = '';
    }
  };

  const handleBackupDownload = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/export-fitnotes`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate export database');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      a.download = `FitNotes_Backup_${timestamp}.fitnotes`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCsvDownload = async () => {
    if (!token) return;
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/export-csv`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to generate CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FitNotes_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      triggerToast(`CSV export failed: ${err.message || 'error'}`, 'error');
    }
  };

  // OIDC return, shared by both transports: the web flow lands back on the
  // SPA with query params; the mobile flow returns via the fitnotes://oidc
  // deep link with the same params.
  const completeOidcAuth = (params: URLSearchParams): boolean => {
    const oidcToken = params.get('oidc_token');
    const oidcError = params.get('oidc_error');
    const oidcLinked = params.get('oidc') === 'linked';
    if (!oidcToken && !oidcError && !oidcLinked) return false;

    if (oidcError) {
      triggerToast(`Single sign-on failed: ${oidcError}`, 'error');
      return true;
    }
    if (oidcLinked) {
      triggerToast('Single sign-on identity linked to your account!');
      return true;
    }
    if (oidcToken) {
      const email = params.get('oidc_email') || '';
      (async () => {
        tokenRef.current = oidcToken;
        setToken(oidcToken);
        localStorage.setItem('fn_token', oidcToken);
        if (email) {
          setUserEmail(email);
          localStorage.setItem('fn_user_email', email);
        }
        await db.invalidateCache(true);
        try {
          setSyncStatus('syncing');
          await db.sync(oidcToken, getApiBaseUrl());
          hasLocalChangesRef.current = false;
          localChangeVersionRef.current = 0;
          lastPullAtRef.current = Date.now();
          setSyncStatus('success');
          await late.refreshData();
          setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (e) {
          console.warn('OIDC initial sync failed:', e);
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 3000);
        }
        triggerToast('Signed in with single sign-on!');
      })();
    }
    return true;
  };

  // Web transport: query params on the SPA URL (mirrors the Withings flow).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (completeOidcAuth(params)) {
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Mobile transport: deep links delivered by the OS after the system-browser
  // sign-in. Covers both a running app (onOpenUrl) and a cold start by the
  // link itself (getCurrent); the handled-set dedupes overlap between them.
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const handled = new Set<string>();

    const handleUrls = (urls: string[] | null | undefined) => {
      for (const raw of urls ?? []) {
        if (!raw || handled.has(raw)) continue;
        handled.add(raw);
        try {
          const u = new URL(raw);
          if (u.protocol !== 'fitnotes:') continue;
          completeOidcAuth(u.searchParams);
        } catch (e) {
          console.warn('Ignoring malformed deep link:', raw, e);
        }
      }
    };

    import('@tauri-apps/plugin-deep-link')
      .then(async ({ onOpenUrl, getCurrent }) => {
        handleUrls(await getCurrent().catch(() => null));
        const un = await onOpenUrl(handleUrls);
        if (disposed) un();
        else unlisten = un;
      })
      .catch((e) => console.warn('Deep link listener unavailable:', e));

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  return {
    token, setToken, userEmail, setUserEmail, customApiUrl, updateCustomApiUrl,
    authEmail, setAuthEmail, authPassword, setAuthPassword, authError, setAuthError,
    authLoading, setAuthLoading, syncStatus, setSyncStatus, lastSyncTime, setLastSyncTime,
    importStatus, setImportStatus, exporting, setExporting,
    isAuthenticated, tokenRef, hasLocalChangesRef, localChangeVersionRef, lastPullAtRef,
    loadLastSyncTime, refreshAuthToken, triggerAutoSync, triggerPullSync, triggerSync,
    handleAuth, handleLogout, handleAuthExpired,
    handleBackupUpload, handleBackupDownload, handleCsvDownload,
  };
}
