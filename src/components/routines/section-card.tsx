'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, ChevronDown, ChevronUp, Trash2, Plus } from 'lucide-react';
import type { RoutineSection } from '@/types/routine';
import { RoutineExerciseItem } from './routine-exercise-item';

type SectionCardProps = {
  section: RoutineSection;
  onDelete: (sectionId: number) => void;
  onAddExercise: (sectionId: number) => void;
  onRemoveExercise: (routineExerciseId: number) => void;
  onEditExercise: (routineExerciseId: number) => void;
};

export function SectionCard({
  section,
  onDelete,
  onAddExercise,
  onRemoveExercise,
  onEditExercise,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-grab">
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
          {section.exercises.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No exercises in this section yet.
            </div>
          ) : (
            <div className="space-y-2">
              {section.exercises.map((exercise) => (
                <RoutineExerciseItem
                  key={exercise.id}
                  exercise={exercise}
                  onRemove={onRemoveExercise}
                  onSetsUpdated={onEditExercise ? () => onEditExercise(exercise.id) : undefined}
                />
              ))}
            </div>
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
