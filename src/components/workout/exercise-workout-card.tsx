'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SetRow } from './set-row';
import { CategoryBadge } from './category-badge';

interface Set {
  id: number;
  metricWeight: number;
  reps: number;
  isComplete: boolean;
  isPersonalRecord: boolean;
}

interface SetUpdate {
  metricWeight?: number;
  reps?: number;
  isComplete?: boolean;
}

interface ExerciseWorkoutCardProps {
  exercise: {
    id: number;
    name: string;
    category: { name: string; color: string } | null;
  };
  sets: Set[];
  previousSets?: Set[];
  isMetric: boolean;
  onAddSet: (exerciseId: number) => void;
  onUpdateSet: (id: number, data: SetUpdate) => void;
  onDeleteSet: (id: number) => void;
}

export function ExerciseWorkoutCard({
  exercise,
  sets,
  previousSets,
  isMetric,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
}: ExerciseWorkoutCardProps) {
  const [showPrevious, setShowPrevious] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{exercise.name}</CardTitle>
            {exercise.category && (
              <CategoryBadge name={exercise.category.name} color={exercise.category.color} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {previousSets && previousSets.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowPrevious(!showPrevious)}
          >
            {showPrevious ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            Previous: {previousSets.map(s => `${(s.metricWeight/1000).toFixed(0)}×${s.reps}`).join(', ')}
          </Button>
        )}

        {sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            setNumber={index + 1}
            isMetric={isMetric}
            onUpdate={onUpdateSet}
            onDelete={onDeleteSet}
          />
        ))}

        <Button variant="outline" className="w-full" onClick={() => onAddSet(exercise.id)}>
          <Plus className="mr-2 h-4 w-4" /> Add Set
        </Button>
      </CardContent>
    </Card>
  );
}
