'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseRestTimerOptions {
  onComplete?: () => void;
  enableSound?: boolean;
  enableNotification?: boolean;
}

interface UseRestTimerReturn {
  time: number;
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  start: (duration?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: () => void;
}

export function useRestTimer({
  onComplete,
  enableSound = true,
  enableNotification = true,
}: UseRestTimerOptions = {}): UseRestTimerReturn {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationPermissionRef = useRef<NotificationPermission>('default');

  // Request notification permission on mount
  useEffect(() => {
    if (enableNotification && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermissionRef.current = permission;
        });
      } else {
        notificationPermissionRef.current = Notification.permission;
      }
    }
  }, [enableNotification]);

  // Play completion sound using Web Audio API
  const playSound = useCallback(() => {
    if (!enableSound) return;

    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Configure beep sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); // 800 Hz beep
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [enableSound]);

  // Show browser notification
  const showNotification = useCallback(() => {
    if (!enableNotification) return;

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      notificationPermissionRef.current === 'granted'
    ) {
      try {
        new Notification('Rest Timer Complete', {
          body: 'Your rest period is over. Ready for the next set!',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
        });
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  }, [enableNotification]);

  // Timer tick
  useEffect(() => {
    if (isRunning && !isPaused && time > 0) {
      intervalRef.current = setInterval(() => {
        setTime((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsPaused(false);
            playSound();
            showNotification();
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, time, playSound, showNotification, onComplete]);

  const start = useCallback((newDuration?: number) => {
    const timerDuration = newDuration || duration || 90;
    setDuration(timerDuration);
    setTime(timerDuration);
    setIsRunning(true);
    setIsPaused(false);
  }, [duration]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    setTime(duration);
    setIsRunning(false);
    setIsPaused(false);
  }, [duration]);

  const stop = useCallback(() => {
    setTime(0);
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  const progress = duration > 0 ? ((duration - time) / duration) * 100 : 0;

  return {
    time,
    isRunning,
    isPaused,
    progress,
    start,
    pause,
    resume,
    reset,
    stop,
  };
}
