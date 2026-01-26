'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, ChevronDown, ChevronUp, Trash2, Plus, Link2, Unlink } from 'lucide-react';
import type { RoutineSection, RoutineExercise } from '@/types/routine';
import { RoutineExerciseItem } from './routine-exercise-item';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { createRoutineSuperset, removeFromSuperset, dissolveSuperset } from '@/actions/routines';

// Predefined colors for superset groups
const SUPERSET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

type SectionCardProps = {
  section: RoutineSection;
  onDelete: (sectionId: number) => void;
  onAddExercise: (sectionId: number) => void;
  onRemoveExercise: (routineExerciseId: number) => void;
  onEditExercise: (routineExerciseId: number) => void;
  onReorderExercises?: (sectionId: number, exerciseIds: number[]) => void;
  onSupersetChange?: () => void;
};

export function SectionCard({
  section,
  onDelete,
  onAddExercise,
  onRemoveExercise,
  onEditExercise,
  onReorderExercises,
  onSupersetChange,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localExercises, setLocalExercises] = useState(section.exercises);
  const [selectedExercises, setSelectedExercises] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isCreatingSuperset, setIsCreatingSuperset] = useState(false);

  // Update local exercises when section changes (including superset groupings)
  useEffect(() => {
    setLocalExercises(section.exercises);
  }, [section.exercises]);

  // Generate color mapping for superset groups
  const supersetColorMap = useMemo(() => {
    const colorMap = new Map<number, string>();
    const groupIds = [...new Set(localExercises
      .filter(e => e.supersetGroupId !== null)
      .map(e => e.supersetGroupId!)
    )].sort((a, b) => a - b);

    groupIds.forEach((groupId, index) => {
      const color = SUPERSET_COLORS[index % SUPERSET_COLORS.length] ?? '#3b82f6';
      colorMap.set(groupId, color);
    });

    return colorMap;
  }, [localExercises]);

  const handleSelectionChange = (exerciseId: number, selected: boolean) => {
    setSelectedExercises(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(exerciseId);
      } else {
        next.delete(exerciseId);
      }
      return next;
    });
  };

  const handleCreateSuperset = async () => {
    if (selectedExercises.size < 2) return;

    setIsCreatingSuperset(true);
    try {
      await createRoutineSuperset(section.id, Array.from(selectedExercises));
      setSelectedExercises(new Set());
      setIsSelectionMode(false);
      onSupersetChange?.();
    } catch (error) {
      console.error('Failed to create superset:', error);
    } finally {
      setIsCreatingSuperset(false);
    }
  };

  const handleRemoveFromSuperset = async (exerciseId: number) => {
    try {
      await removeFromSuperset(exerciseId);
      onSupersetChange?.();
    } catch (error) {
      console.error('Failed to remove from superset:', error);
    }
  };

  const handleDissolveSuperset = async (supersetGroupId: number) => {
    try {
      await dissolveSuperset(section.id, supersetGroupId);
      onSupersetChange?.();
    } catch (error) {
      console.error('Failed to dissolve superset:', error);
    }
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedExercises(new Set());
  };

  // Get unique superset groups for showing dissolve buttons
  const supersetGroups = useMemo(() => {
    const groups = new Map<number, RoutineExercise[]>();
    localExercises.forEach(exercise => {
      if (exercise.supersetGroupId !== null) {
        const existing = groups.get(exercise.supersetGroupId) || [];
        existing.push(exercise);
        groups.set(exercise.supersetGroupId, existing);
      }
    });
    return groups;
  }, [localExercises]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const exerciseSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = localExercises.findIndex((e) => e.id === active.id);
    const newIndex = localExercises.findIndex((e) => e.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newExercises = arrayMove(localExercises, oldIndex, newIndex);
    setLocalExercises(newExercises);

    // Persist to database
    onReorderExercises?.(section.id, newExercises.map((e) => e.id));
  };

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
          <CardTitle className="text-base flex-1">{section.name}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {section.exercises.length} exercise{section.exercises.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(section.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-2">
          {localExercises.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No exercises in this section yet.
            </div>
          ) : (
            <>
              {/* Superset action bar */}
              <div className="flex items-center gap-2 mb-2">
                {!isSelectionMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectionMode(true)}
                    disabled={localExercises.length < 2}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Create Superset
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreateSuperset}
                      disabled={selectedExercises.size < 2 || isCreatingSuperset}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {isCreatingSuperset ? 'Creating...' : `Link ${selectedExercises.size} Exercises`}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelSelectionMode}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {/* Show dissolve buttons for existing supersets */}
                {!isSelectionMode && Array.from(supersetGroups.entries()).map(([groupId, exercises]) => (
                  <Button
                    key={groupId}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDissolveSuperset(groupId)}
                    style={{
                      borderColor: supersetColorMap.get(groupId),
                      color: supersetColorMap.get(groupId),
                    }}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Unlink ({exercises.length})
                  </Button>
                ))}
              </div>

              <DndContext
                sensors={exerciseSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleExerciseDragEnd}
              >
                <SortableContext
                  items={localExercises.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {localExercises.map((exercise) => (
                      <RoutineExerciseItem
                        key={exercise.id}
                        exercise={exercise}
                        onRemove={onRemoveExercise}
                        onSetsUpdated={onEditExercise ? () => onEditExercise(exercise.id) : undefined}
                        isSelected={selectedExercises.has(exercise.id)}
                        onSelectionChange={handleSelectionChange}
                        showSelection={isSelectionMode}
                        supersetColor={exercise.supersetGroupId !== null
                          ? supersetColorMap.get(exercise.supersetGroupId)
                          : undefined}
                        onRemoveFromSuperset={exercise.supersetGroupId !== null
                          ? handleRemoveFromSuperset
                          : undefined}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => onAddExercise(section.id)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
