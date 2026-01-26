import { useState, useEffect, useCallback, useRef } from 'react';
import { startWorkout, endWorkout, getWorkoutTime } from '@/actions/workoutTimes';

export interface UseWorkoutTimerReturn {
  isRunning: boolean;
  elapsedSeconds: number;
  startTime: Date | null;
  formattedTime: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useWorkoutTimer(date: string): UseWorkoutTimerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load workout time on mount
  useEffect(() => {
    const loadWorkoutTime = async () => {
      const workoutTime = await getWorkoutTime(date);

      if (workoutTime?.startDateTime) {
        setStartTime(workoutTime.startDateTime);

        // Check if workout is still active (no end time or same as start time)
        const isActive =
          !workoutTime.endDateTime ||
          workoutTime.endDateTime.getTime() === workoutTime.startDateTime.getTime();

        if (isActive) {
          setIsRunning(true);
          const elapsed = Math.floor((Date.now() - workoutTime.startDateTime.getTime()) / 1000);
          setElapsedSeconds(elapsed);
        } else {
          // Workout has ended
          const elapsed = Math.floor(
            (workoutTime.endDateTime.getTime() - workoutTime.startDateTime.getTime()) / 1000
          );
          setElapsedSeconds(elapsed);
        }
      }
    };

    loadWorkoutTime();
  }, [date]);

  // Update elapsed time every second when running
  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
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
  }, [isRunning, startTime]);

  const start = useCallback(async () => {
    const workoutTime = await startWorkout(date);
    if (workoutTime) {
      setStartTime(workoutTime.startDateTime);
      setIsRunning(true);
      setElapsedSeconds(0);
    }
  }, [date]);

  const stop = useCallback(async () => {
    await endWorkout(date);
    setIsRunning(false);
  }, [date]);

  const reset = useCallback(async () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartTime(null);
  }, []);

  const formattedTime = formatDuration(elapsedSeconds);

  return {
    isRunning,
    elapsedSeconds,
    startTime,
    formattedTime,
    start,
    stop,
    reset,
  };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationFriendly(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
