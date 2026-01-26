'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit, GripVertical, Link2, Unlink } from 'lucide-react';
import type { RoutineExercise } from '@/types/routine';
import { PredefinedSetsEditor } from './predefined-sets-editor';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type RoutineExerciseItemProps = {
  exercise: RoutineExercise;
  onRemove: (routineExerciseId: number) => void;
  onSetsUpdated?: () => void;
  isSelected?: boolean;
  onSelectionChange?: (exerciseId: number, selected: boolean) => void;
  showSelection?: boolean;
  supersetColor?: string;
  onRemoveFromSuperset?: (exerciseId: number) => void;
};

export function RoutineExerciseItem({
  exercise,
  onRemove,
  onSetsUpdated,
  isSelected = false,
  onSelectionChange,
  showSelection = false,
  supersetColor,
  onRemoveFromSuperset,
}: RoutineExerciseItemProps) {
  const [setsEditorOpen, setSetsEditorOpen] = useState(false);
  const setCount = exercise.sets?.length ?? 0;
  const isInSuperset = exercise.supersetGroupId !== null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCloseSetsEditor = () => {
    setSetsEditorOpen(false);
    // Trigger refresh of the parent component to show updated set count
    onSetsUpdated?.();
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          ...(supersetColor ? { borderLeftColor: supersetColor, borderLeftWidth: '3px' } : {}),
        }}
        className={`flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
          isInSuperset && supersetColor ? 'border-l-4' : ''
        }`}
      >
        {showSelection && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange?.(exercise.id, checked === true)}
            className="shrink-0"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 cursor-grab active:cursor-grabbing touch-none shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
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
            {isInSuperset && (
              <Badge
                variant="secondary"
                className="text-xs shrink-0"
                style={{
                  backgroundColor: supersetColor ? `${supersetColor}20` : undefined,
                  color: supersetColor,
                }}
              >
                <Link2 className="h-3 w-3 mr-1" />
                Superset
              </Badge>
            )}
            {setCount > 0 && (
              <Badge variant="outline" className="text-xs shrink-0">
                {setCount} {setCount === 1 ? 'set' : 'sets'}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSetsEditorOpen(true)}
        >
          <Edit className="h-4 w-4 mr-1" />
          Edit Sets
        </Button>
        {isInSuperset && onRemoveFromSuperset && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => onRemoveFromSuperset(exercise.id)}
            title="Remove from superset"
          >
            <Unlink className="h-4 w-4" />
          </Button>
        )}
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
