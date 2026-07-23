// Settings slice: the synced settings singleton, unit preference, theme, and
// weight display helpers. Code moved verbatim from FitNotesStore.tsx.
import { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import type { Settings } from '../../types';
import type { TabId } from './shared';
import type { LateDeps } from './types';

export interface SettingsSliceDeps {
  late: LateDeps;
  activeTab: TabId;
}

export function useSettingsSlice(deps: SettingsSliceDeps) {
  const { late, activeTab } = deps;

  const [isLightTheme, setIsLightTheme] = useState(false);

  // User unit preference: kg or lbs
  const [userUnit, setUserUnit] = useState<'kg' | 'lbs'>(() => {
    return (localStorage.getItem('fn_user_unit') as 'kg' | 'lbs') || 'kg';
  });

  // Full settings singleton, loaded from the offline store (synced).
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('fn_settings') : null;
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  // Persist a partial settings change to the singleton so it syncs (last-write-wins).
  const persistSettings = (partial: Record<string, unknown>) => {
    db.execute('UPDATE settings', [partial]).catch(e => console.warn('Failed to persist settings:', e));
  };

  // Update one setting: optimistic local state + persisted (dirty) for sync.
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    persistSettings({ [key]: value });
    if (key === 'metric') {
      const unit = value ? 'kg' : 'lbs';
      setUserUnit(unit as 'kg' | 'lbs');
      localStorage.setItem('fn_user_unit', unit);
    }
    if (key === 'app_theme_id') {
      const light = value === 1;
      setIsLightTheme(light);
      document.body.classList.toggle('light-theme', light);
    }
  };

  // Keep the screen awake during workout logging when enabled (Screen Wake Lock API).
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const want = settings.keep_screen_on && activeTab === 'log';
    if (want && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((s: any) => { sentinel = s; }).catch(() => {});
    }
    return () => { if (sentinel) sentinel.release().catch(() => {}); };
  }, [settings.keep_screen_on, activeTab]);

  const handleUnitChange = (unit: 'kg' | 'lbs') => {
    if (unit === userUnit) return;

    setUserUnit(unit);
    localStorage.setItem('fn_user_unit', unit);
    persistSettings({ metric: unit === 'kg' });

    // Suggest standard conversion weights
    if (unit === 'lbs') {
      late.setLogWeight(w => String(Math.round(parseFloat(w) * 2.20462) || 135));
      late.setPlateCalcTarget(t => Math.round(t * 2.20462) || 225);
    } else {
      late.setLogWeight(w => String(Math.round(parseFloat(w) / 2.20462) || 60));
      late.setPlateCalcTarget(t => Math.round(t / 2.20462) || 100);
    }
  };

  const displayWeight = (metricWeight: number | null, logUnit: number | null): string => {
    if (metricWeight === null) return '';

    // logUnit: 1 = kg, 2 = lbs
    const isLogLbs = logUnit === 2;
    const isPrefLbs = userUnit === 'lbs';

    if (isLogLbs === isPrefLbs) {
      return `${metricWeight} ${userUnit}`;
    }

    if (isPrefLbs) {
      // Logged in kg, but pref is lbs -> Convert kg to lbs
      const converted = Math.round(metricWeight * 2.20462 * 10) / 10;
      return `${converted} lbs`;
    } else {
      // Logged in lbs, but pref is kg -> Convert lbs to kg
      const converted = Math.round(metricWeight / 2.20462 * 10) / 10;
      return `${converted} kg`;
    }
  };

  // Theme Toggle
  const toggleTheme = () => {
    const nextLight = !isLightTheme;
    setIsLightTheme(nextLight);
    document.body.classList.toggle('light-theme', nextLight);
    persistSettings({ app_theme_id: nextLight ? 1 : 0 });
  };

  return {
    isLightTheme, setIsLightTheme, userUnit, setUserUnit, settings, setSettings,
    updateSetting, handleUnitChange, displayWeight, toggleTheme,
  };
}
