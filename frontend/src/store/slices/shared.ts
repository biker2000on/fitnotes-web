// Shared module-level helpers used by the controller and its domain slices.
// Moved verbatim from FitNotesStore.tsx during the slice decomposition.
import { AuthExpiredError, isTauri } from '../../storage/db';

export const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export const isAuthExpiredError = (error: unknown): boolean => {
  if (error instanceof AuthExpiredError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /\b401\b|unauthorized|invalid or expired token|session expired/i.test(message);
};

export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('fn_api_base_url');
    if (custom) return custom;
  }
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  if (isTauri()) return 'https://fitnotes.adventureintandem.com';

  if (typeof window === 'undefined') return 'http://localhost:8080';

  const { hostname, port, origin } = window.location;
  const localDevPorts = new Set(['3001', '5173']);
  if (hostname === 'tauri.localhost' || localDevPorts.has(port)) {
    const resolvedHost = hostname === 'tauri.localhost' || !hostname ? 'localhost' : hostname;
    return `http://${resolvedHost}:8080`;
  }

  return origin;
};

export const getClientType = () => (isTauri() ? 'mobile' : 'web');

export const VALID_TABS = ['log', 'calendar', 'exercises', 'routines', 'routine-editor', 'body', 'measurements', 'goals', 'analysis', 'tools', 'history', 'settings', 'sync'] as const;
export type TabId = typeof VALID_TABS[number];
