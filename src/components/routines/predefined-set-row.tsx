'use client';

import { Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getExerciseTypeFields } from '@/lib/exercise-types';

interface PredefinedSetRowProps {
  set: {
    metricWeight?: number | null;
    reps?: number | null;
    distance?: number | null;
    durationSeconds?: number | null;
  };
  setNumber: number;
  exerciseType: number;
  isMetric: boolean;
  onUpdate: (field: 'metricWeight' | 'reps' | 'distance' | 'durationSeconds', value: number | null) => void;
  onDelete: () => void;
}

export function PredefinedSetRow({
  set,
  setNumber,
  exerciseType,
  isMetric,
  onUpdate,
  onDelete,
}: PredefinedSetRowProps) {
  const handleWeightChange = (value: string) => {
    const parsed = parseFloat(value);
    if (value === '' || isNaN(parsed)) {
      onUpdate('metricWeight', null);
    } else {
      // Convert to grams (metric) or from lbs to grams
      const grams = isMetric ? parsed * 1000 : Math.round(parsed * 453.592);
      onUpdate('metricWeight', grams);
    }
  };

  const handleRepsChange = (value: string) => {
    const parsed = parseInt(value);
    if (value === '' || isNaN(parsed)) {
      onUpdate('reps', null);
    } else {
      onUpdate('reps', parsed);
    }
  };

  const handleDistanceChange = (value: string) => {
    const parsed = parseFloat(value);
    if (value === '' || isNaN(parsed)) {
      onUpdate('distance', null);
    } else {
      // Convert to meters (metric) or from miles to meters
      const meters = isMetric ? parsed * 1000 : Math.round(parsed * 1609.34);
      onUpdate('distance', meters);
    }
  };

  const handleDurationChange = (value: string) => {
    const parsed = parseInt(value);
    if (value === '' || isNaN(parsed)) {
      onUpdate('durationSeconds', null);
    } else {
      onUpdate('durationSeconds', parsed);
    }
  };

  const displayWeight = set.metricWeight
    ? isMetric
      ? (set.metricWeight / 1000).toFixed(1)
      : (set.metricWeight / 453.592).toFixed(1)
    : '';

  const displayDistance = set.distance
    ? isMetric
      ? (set.distance / 1000).toFixed(2)
      : (set.distance / 1609.34).toFixed(2)
    : '';

  const fields = getExerciseTypeFields(exerciseType);
  const fieldCount = [fields.hasWeight, fields.hasReps, fields.hasDistance, fields.hasTime].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-card">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </Button>

      <span className="w-8 text-center text-sm text-muted-foreground">{setNumber}</span>

      <div className="flex items-center gap-2 flex-1">
        {fields.hasWeight && (
          <div className="flex items-center gap-1 flex-1">
            <Input
              type="number"
              step="0.1"
              value={displayWeight}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder="Weight"
              className="w-24 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {isMetric ? 'kg' : 'lb'}
            </span>
          </div>
        )}

        {fields.hasWeight && (fields.hasReps || fields.hasDistance || fields.hasTime) && (
          <span className="text-muted-foreground">×</span>
        )}

        {fields.hasReps && (
          <div className="flex items-center gap-1 flex-1">
            <Input
              type="number"
              value={set.reps ?? ''}
              onChange={(e) => handleRepsChange(e.target.value)}
              placeholder="Reps"
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">reps</span>
          </div>
        )}

        {fields.hasReps && (fields.hasDistance || fields.hasTime) && (
          <span className="text-muted-foreground">@</span>
        )}

        {fields.hasDistance && (
          <div className="flex items-center gap-1 flex-1">
            <Input
              type="number"
              step="0.01"
              value={displayDistance}
              onChange={(e) => handleDistanceChange(e.target.value)}
              placeholder="Distance"
              className="w-24 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {isMetric ? 'km' : 'mi'}
            </span>
          </div>
        )}

        {fields.hasDistance && fields.hasTime && (
          <span className="text-muted-foreground">@</span>
        )}

        {fields.hasTime && (
          <div className="flex items-center gap-1 flex-1">
            <Input
              type="number"
              value={set.durationSeconds ?? ''}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder="Duration"
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">sec</span>
          </div>
        )}
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
