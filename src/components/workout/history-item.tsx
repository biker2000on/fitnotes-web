'use client';

import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Dumbbell, Calendar } from 'lucide-react';
import { CategoryBadge } from './category-badge';
import Link from 'next/link';

interface Exercise {
  id: number;
  name: string;
  category: { name: string; color: string } | null;
}

interface HistoryItemProps {
  date: string;
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
  exercises: Exercise[];
}

export function HistoryItem({
  date,
  exerciseCount,
  setCount,
  totalVolume,
  exercises,
}: HistoryItemProps) {
  const dateObj = parseISO(date);
  const displayDate = format(dateObj, 'EEEE, MMM d, yyyy');
  const volumeKg = totalVolume / 1000;

  return (
    <Link href={`/workout?date=${date}`}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              {/* Date */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{displayDate}</h3>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Dumbbell className="h-3 w-3" />
                  <span>{exerciseCount} exercises</span>
                </div>
                <span>•</span>
                <span>{setCount} sets</span>
                <span>•</span>
                <span>{volumeKg.toFixed(0)} kg</span>
              </div>

              {/* Exercise preview */}
              <div className="flex flex-wrap gap-2">
                {exercises.slice(0, 4).map((exercise) => (
                  <div key={exercise.id} className="flex items-center gap-1">
                    <span className="text-sm">{exercise.name}</span>
                    {exercise.category && (
                      <CategoryBadge
                        name={exercise.category.name}
                        color={exercise.category.color}
                        size="sm"
                      />
                    )}
                  </div>
                ))}
                {exercises.length > 4 && (
                  <span className="text-sm text-muted-foreground">
                    +{exercises.length - 4} more
                  </span>
                )}
              </div>
            </div>

            {/* Chevron */}
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
