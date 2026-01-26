'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Unlink, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SetRow } from './set-row';
import { CategoryBadge } from './category-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Set {
  id: number;
  exerciseId: number;
  metricWeight: number;
  reps: number;
  distance: number;
  durationSeconds: number;
  isComplete: boolean;
  isPersonalRecord: boolean;
}

interface SetUpdate {
  metricWeight?: number;
  reps?: number;
  distance?: number;
  durationSeconds?: number;
  isComplete?: boolean;
}

interface Exercise {
  id: number;
  name: string;
  exerciseTypeId: number;
  category: { name: string; color: string } | null;
  sets: Set[];
  previousSets?: Set[];
}

interface SupersetCardProps {
  groupId: number;
  groupName?: string | null;
  groupColor?: string | null;
  exercises: Exercise[];
  isMetric: boolean;
  workoutDate: string;
  onUpdateSet: (id: number, data: SetUpdate) => void;
  onDeleteSet: (id: number) => void;
  onUngroup: (groupId: number) => void;
  onUpdateGroup?: (groupId: number, data: { name?: string; color?: string }) => void;
}

export function SupersetCard({
  groupId,
  groupName,
  groupColor,
  exercises,
  isMetric,
  workoutDate,
  onUpdateSet,
  onDeleteSet,
  onUngroup,
  onUpdateGroup,
}: SupersetCardProps) {
  const [showPrevious, setShowPrevious] = useState<{ [exerciseId: number]: boolean }>({});
  const color = groupColor || '#3b82f6';

  const togglePrevious = (exerciseId: number) => {
    setShowPrevious(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  return (
    <Card className="relative" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {groupName || 'Superset'}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onUngroup(groupId)}>
                <Unlink className="mr-2 h-4 w-4" />
                Ungroup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pl-6">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{exercise.name}</h3>
                {exercise.category && (
                  <CategoryBadge
                    name={exercise.category.name}
                    color={exercise.category.color}
                  />
                )}
              </div>
            </div>

            {exercise.previousSets && exercise.previousSets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => togglePrevious(exercise.id)}
              >
                {showPrevious[exercise.id] ? (
                  <ChevronUp className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Previous:{' '}
                {exercise.previousSets
                  .map((s) => `${(s.metricWeight / 1000).toFixed(0)}×${s.reps}`)
                  .join(', ')}
              </Button>
            )}

            {exercise.sets.map((set, index) => (
              <SetRow
                key={set.id}
                set={set}
                setNumber={index + 1}
                exerciseTypeId={exercise.exerciseTypeId ?? 0}
                isMetric={isMetric}
                workoutDate={workoutDate}
                onUpdate={onUpdateSet}
                onDelete={onDeleteSet}
              />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
