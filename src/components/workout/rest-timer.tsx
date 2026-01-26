'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Timer, Play, Pause, RotateCcw, X, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRestTimer } from '@/hooks/use-rest-timer';
import { cn } from '@/lib/utils';

interface RestTimerProps {
  defaultDuration?: number;
  enableSound?: boolean;
  enableNotification?: boolean;
  onComplete?: () => void;
}

export interface RestTimerHandle {
  start: (duration?: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  stop: () => void;
}

export const RestTimer = forwardRef<RestTimerHandle, RestTimerProps>(({
  defaultDuration = 90,
  enableSound = true,
  enableNotification = true,
  onComplete,
}, ref) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { time, isRunning, isPaused, progress, start, pause, resume, reset, stop } = useRestTimer({
    onComplete,
    enableSound,
    enableNotification,
  });

  const handleStart = () => {
    start(defaultDuration);
    setIsVisible(true);
    setIsMinimized(false);
  };

  const handleStop = () => {
    stop();
    setIsVisible(false);
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    start: (duration?: number) => {
      start(duration ?? defaultDuration);
      setIsVisible(true);
      setIsMinimized(false);
    },
    pause,
    resume,
    reset,
    stop: handleStop,
  }));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render anything if not visible
  if (!isVisible) {
    return (
      <Button
        onClick={handleStart}
        className="fixed bottom-20 right-4 z-50 rounded-full shadow-lg h-14 w-14 p-0"
        size="icon"
        title="Start Rest Timer"
      >
        <Timer className="h-6 w-6" />
      </Button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <Card
        className="fixed bottom-20 right-4 z-50 shadow-lg cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-2 p-3">
          <Timer className="h-5 w-5 text-primary" />
          <span className="font-mono font-bold text-lg">{formatTime(time)}</span>
        </div>
      </Card>
    );
  }

  // Full view
  return (
    <Card className="fixed bottom-20 right-4 z-50 shadow-lg w-64">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <span className="font-semibold">Rest Timer</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleStop}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Circular Timer Display */}
        <div className="relative flex items-center justify-center">
          <svg className="w-40 h-40 -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-muted"
            />
            {/* Progress circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress / 100)}`}
              className={cn(
                "transition-all duration-1000",
                time <= 10 ? "text-red-500" : "text-primary"
              )}
              strokeLinecap="round"
            />
          </svg>
          {/* Time text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              "font-mono font-bold text-4xl",
              time <= 10 && "text-red-500 animate-pulse"
            )}>
              {formatTime(time)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          {!isRunning ? (
            <Button
              onClick={() => start(defaultDuration)}
              size="lg"
              className="flex-1"
            >
              <Play className="h-5 w-5 mr-2" />
              Start
            </Button>
          ) : isPaused ? (
            <Button
              onClick={resume}
              size="lg"
              className="flex-1"
            >
              <Play className="h-5 w-5 mr-2" />
              Resume
            </Button>
          ) : (
            <Button
              onClick={pause}
              size="lg"
              variant="secondary"
              className="flex-1"
            >
              <Pause className="h-5 w-5 mr-2" />
              Pause
            </Button>
          )}
          <Button
            onClick={reset}
            size="lg"
            variant="outline"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
});

RestTimer.displayName = 'RestTimer';
