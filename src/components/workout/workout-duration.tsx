'use client';

import { Clock, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWorkoutTimer } from '@/hooks/use-workout-timer';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WorkoutDurationProps {
  date: string;
  autoStart?: boolean;
}

export function WorkoutDuration({ date, autoStart = false }: WorkoutDurationProps) {
  const { isRunning, formattedTime, startTime, start, stop } = useWorkoutTimer(date);

  const handleToggle = async () => {
    if (isRunning) {
      await stop();
    } else {
      await start();
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            isRunning ? "bg-green-500/10" : "bg-muted"
          )}>
            <Clock className={cn(
              "h-4 w-4",
              isRunning ? "text-green-500" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                isRunning && "text-green-500"
              )}>
                {formattedTime}
              </span>
              {isRunning && (
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
              )}
            </div>
            {startTime && (
              <p className="text-xs text-muted-foreground">
                Started at {format(new Date(startTime), 'h:mm a')}
              </p>
            )}
          </div>
        </div>
        <Button
          variant={isRunning ? "destructive" : "default"}
          size="sm"
          onClick={handleToggle}
        >
          {isRunning ? (
            <>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
