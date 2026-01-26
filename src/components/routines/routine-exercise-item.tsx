'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit } from 'lucide-react';
import type { RoutineExercise } from '@/types/routine';
import { PredefinedSetsEditor } from './predefined-sets-editor';

type RoutineExerciseItemProps = {
  exercise: RoutineExercise;
  onRemove: (routineExerciseId: number) => void;
  onSetsUpdated?: () => void;
};

export function RoutineExerciseItem({ exercise, onRemove, onSetsUpdated }: RoutineExerciseItemProps) {
  const [setsEditorOpen, setSetsEditorOpen] = useState(false);
  const setCount = exercise.sets?.length ?? 0;

  const handleCloseSetsEditor = () => {
    setSetsEditorOpen(false);
    // Trigger refresh of the parent component to show updated set count
    onSetsUpdated?.();
  };

  return (
    <>
      <div className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{exercise.exercise?.name}</p>
            {exercise.exercise?.category && (
              <Badge
                variant="secondary"
                className="text-xs shrink-0"
                style={{
                  backgroundColor: `${exercise.exercise.category.color}20`,
                  color: exercise.exercise.category.color,
                }}
              >
                {exercise.exercise.category.name}
              </Badge>
            )}
            {setCount > 0 && (
              <Badge variant="outline" className="text-xs shrink-0">
                {setCount} {setCount === 1 ? 'set' : 'sets'}
              </Badge>
            )}
          </div>
          {setCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {setCount} predefined set{setCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSetsEditorOpen(true)}
        >
          <Edit className="h-4 w-4 mr-1" />
          Edit Sets
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0"
          onClick={() => onRemove(exercise.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <PredefinedSetsEditor
        sectionExerciseId={exercise.id}
        exerciseName={exercise.exercise?.name ?? 'Exercise'}
        exerciseType={exercise.exercise?.exerciseTypeId ?? 0}
        open={setsEditorOpen}
        onClose={handleCloseSetsEditor}
      />
    </>
  );
}
