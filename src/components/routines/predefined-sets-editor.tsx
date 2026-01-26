'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PredefinedSetRow } from './predefined-set-row';
import { getPredefinedSets, savePredefinedSets, type PredefinedSet } from '@/actions/routines';
import { getUserSettings } from '@/actions/userSettings';

interface PredefinedSetsEditorProps {
  sectionExerciseId: number;
  exerciseName: string;
  exerciseType: number; // 0 = weight/reps, 1 = distance/time
  open: boolean;
  onClose: () => void;
}

export function PredefinedSetsEditor({
  sectionExerciseId,
  exerciseName,
  exerciseType,
  open,
  onClose,
}: PredefinedSetsEditorProps) {
  const [sets, setSets] = useState<PredefinedSet[]>([]);
  const [isMetric, setIsMetric] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectionExerciseId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [existingSets, settings] = await Promise.all([
        getPredefinedSets(sectionExerciseId),
        getUserSettings(),
      ]);

      setSets(
        existingSets.map((set, index) => ({
          id: set.id,
          metricWeight: set.metricWeight,
          reps: set.reps,
          distance: set.distance,
          durationSeconds: set.durationSeconds,
          sortOrder: index,
        }))
      );
      setIsMetric(settings?.metric ?? true);
    } catch (error) {
      console.error('Failed to load predefined sets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSet = () => {
    const newSet: PredefinedSet = {
      metricWeight: null,
      reps: null,
      distance: null,
      durationSeconds: null,
      sortOrder: sets.length,
    };
    setSets([...sets, newSet]);
  };

  const handleUpdateSet = (index: number, field: keyof PredefinedSet, value: number | null) => {
    const updatedSets = [...sets];
    const currentSet = updatedSets[index];
    if (!currentSet) return;
    updatedSets[index] = {
      ...currentSet,
      [field]: value,
      sortOrder: currentSet.sortOrder ?? index,
    };
    setSets(updatedSets);
  };

  const handleDeleteSet = (index: number) => {
    const updatedSets = sets.filter((_, i) => i !== index);
    // Update sort order
    setSets(updatedSets.map((set, i) => ({ ...set, sortOrder: i })));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePredefinedSets(sectionExerciseId, sets);
      onClose();
    } catch (error) {
      console.error('Failed to save predefined sets:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Predefined Sets</DialogTitle>
          <DialogDescription>
            Configure default sets for {exerciseName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : sets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sets configured. Click &quot;Add Set&quot; to get started.
            </div>
          ) : (
            sets.map((set, index) => (
              <PredefinedSetRow
                key={index}
                set={set}
                setNumber={index + 1}
                exerciseType={exerciseType}
                isMetric={isMetric}
                onUpdate={(field, value) => handleUpdateSet(index, field, value)}
                onDelete={() => handleDeleteSet(index)}
              />
            ))
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={handleAddSet}
            disabled={isLoading}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Set
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
