'use client';

import { useState, useEffect, useTransition } from 'react';
import { Dumbbell, ClipboardList, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getRoutines } from '@/actions/routines';
import { applyRoutineToWorkout } from '@/actions/routines';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Routine {
  id: number;
  name: string;
  sections: {
    id: number;
    name: string;
    exercises: {
      id: number;
    }[];
  }[];
}

interface RoutinePickerProps {
  workoutDate: string;
  onApplied?: () => void;
}

type PopulateOption = 'blank' | 'template' | 'last';

export function RoutinePicker({ workoutDate, onApplied }: RoutinePickerProps) {
  const [open, setOpen] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<number | null>(null);
  const [populateOption, setPopulateOption] = useState<PopulateOption>('template');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const fetchedRoutines = await getRoutines();
        setRoutines(fetchedRoutines as Routine[]);
      });
    }
  }, [open]);

  const handleApply = async () => {
    if (!selectedRoutine) return;

    startTransition(async () => {
      try {
        const result = await applyRoutineToWorkout(selectedRoutine, workoutDate, populateOption);

        if (result) {
          const routine = routines.find(r => r.id === selectedRoutine);
          toast.success(
            `Applied ${routine?.name}: ${result.exerciseCount} exercises, ${result.setCount} sets`
          );
          setOpen(false);
          setSelectedRoutine(null);
          onApplied?.();
        }
      } catch (error) {
        toast.error('Failed to apply routine');
        console.error(error);
      }
    });
  };

  const selectedRoutineData = routines.find(r => r.id === selectedRoutine);
  const totalExercises = selectedRoutineData?.sections.reduce(
    (sum, section) => sum + section.exercises.length,
    0
  ) ?? 0;
  const totalSections = selectedRoutineData?.sections.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList className="h-4 w-4 mr-2" />
          Load Routine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Routine</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {isPending && routines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading routines...</div>
          ) : routines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No routines found</p>
              <p className="text-sm mt-1">Create a routine first to use this feature</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Routine</Label>
                <div className="space-y-2">
                  {routines.map((routine) => {
                    const exerciseCount = routine.sections.reduce(
                      (sum, section) => sum + section.exercises.length,
                      0
                    );
                    const sectionCount = routine.sections.length;

                    return (
                      <Card
                        key={routine.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedRoutine === routine.id
                            ? 'border-primary bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => setSelectedRoutine(routine.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{routine.name}</h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>{sectionCount} section{sectionCount !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>{exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          {selectedRoutine === routine.id && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {selectedRoutine && (
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-sm font-medium">Populate Sets With</Label>
                  <RadioGroup value={populateOption} onValueChange={(value) => setPopulateOption(value as PopulateOption)}>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="blank" id="blank" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="blank" className="font-medium cursor-pointer">
                          Blank sets
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Create exercises with no sets
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="template" id="template" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="template" className="font-medium cursor-pointer">
                          Use template values
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Use predefined weight and reps from routine
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="last" id="last" className="mt-0.5" />
                      <div className="flex-1">
                        <Label htmlFor="last" className="font-medium cursor-pointer">
                          <Copy className="h-4 w-4 inline mr-1" />
                          Copy last workout
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Copy values from most recent workout of each exercise
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedRoutine && (
              <span>
                {totalSections} section{totalSections !== 1 ? 's' : ''}, {totalExercises} exercise{totalExercises !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!selectedRoutine || isPending}>
              {isPending ? 'Applying...' : 'Apply Routine'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
