// notify.ts - Cross-platform notifications: Tauri native, Web Notifications API,
// plus sound + vibration helpers for the rest timer.
import { isTauri } from '../storage/db';

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (isTauri()) {
      const spec = '@tauri-apps/plugin' + '-notification';
      const mod = await import(/* @vite-ignore */ spec);
      let granted = await (mod as any).isPermissionGranted();
      if (!granted) granted = (await (mod as any).requestPermission()) === 'granted';
      return granted;
    }
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') return true;
      return (await Notification.requestPermission()) === 'granted';
    }
  } catch (e) {
    console.warn('Notification permission failed', e);
  }
  return false;
}

export async function notify(title: string, body?: string): Promise<void> {
  try {
    if (isTauri()) {
      const spec = '@tauri-apps/plugin' + '-notification';
      const mod = await import(/* @vite-ignore */ spec);
      if (await (mod as any).isPermissionGranted()) {
        (mod as any).sendNotification({ title, body });
        return;
      }
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (e) {
    console.warn('notify failed', e);
  }
}

export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

// Short beep using the Web Audio API (no asset needed). volume 0..100.
export function beep(volume = 100, durationMs = 400): void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = Math.max(0, Math.min(1, volume / 100)) * 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}
