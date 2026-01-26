'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { createGoal, updateGoal, type CreateGoalInput, type GoalProgress } from '@/actions/goals';
import { searchExercises } from '@/actions/exercises';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check } from 'lucide-react';

interface Exercise {
  id: number;
  name: string;
}

const GOAL_TYPES = [
  { value: 0, label: 'Max Weight', description: 'Lift X kg/lbs for any reps', needsExercise: true },
  { value: 1, label: 'Max Reps', description: 'Complete X reps at any weight', needsExercise: true },
  { value: 2, label: 'Total Volume', description: 'Lift X kg/lbs total volume', needsExercise: true },
  { value: 3, label: 'Max 1RM', description: 'Achieve X kg/lbs estimated 1RM', needsExercise: true },
  { value: 4, label: 'Total Distance', description: 'Complete X km/miles total', needsExercise: true },
  { value: 5, label: 'Total Duration', description: 'Exercise for X hours total', needsExercise: true },
  { value: 6, label: 'Workout Count', description: 'Complete X workouts', needsExercise: false },
];

const GOAL_TYPE_UNITS: Record<number, string> = {
  0: 'kg',
  1: 'reps',
  2: 'kg',
  3: 'kg',
  4: 'km',
  5: 'hours',
  6: 'workouts',
};

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGoal?: GoalProgress | null;
  onSuccess: () => void;
}

export function GoalForm({ open, onOpenChange, editingGoal, onSuccess }: GoalFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [openExercisePicker, setOpenExercisePicker] = useState(false);

  const [formData, setFormData] = useState<CreateGoalInput>({
    exerciseId: undefined,
    goalTypeId: 0,
    targetValue: 0,
    startDate: new Date(),
    targetDate: undefined,
  });

  useEffect(() => {
    if (editingGoal) {
      setFormData({
        exerciseId: editingGoal.exerciseId || undefined,
        goalTypeId: editingGoal.goalTypeId as any,
        targetValue: editingGoal.targetValue,
        startDate: editingGoal.startDate ? new Date(editingGoal.startDate) : new Date(),
        targetDate: editingGoal.targetDate ? new Date(editingGoal.targetDate) : undefined,
      });
    } else {
      setFormData({
        exerciseId: undefined,
        goalTypeId: 0,
        targetValue: 0,
        startDate: new Date(),
        targetDate: undefined,
      });
    }
  }, [editingGoal, open]);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (exerciseSearch.length >= 2) {
        setSearchLoading(true);
        try {
          const results = await searchExercises(exerciseSearch);
          setExercises(results as Exercise[]);
        } finally {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [exerciseSearch]);

  const selectedExercise = exercises.find((ex) => ex.id === formData.exerciseId);
  const selectedGoalType = GOAL_TYPES.find((gt) => gt.value === formData.goalTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, formData);
      } else {
        await createGoal(formData);
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              Set a target to work towards. Track your progress over time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goalType">Goal Type</Label>
              <Select
                value={formData.goalTypeId.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, goalTypeId: parseInt(value) as any })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select goal type" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value.toString()}>
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGoalType?.needsExercise && (
              <div className="space-y-2">
                <Label htmlFor="exercise">Exercise</Label>
                <Popover open={openExercisePicker} onOpenChange={setOpenExercisePicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      type="button"
                    >
                      {selectedExercise?.name || 'Select exercise...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search exercises..."
                        value={exerciseSearch}
                        onValueChange={setExerciseSearch}
                      />
                      <CommandEmpty>
                        {searchLoading ? 'Searching...' : 'No exercises found.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {exercises.map((exercise) => (
                          <CommandItem
                            key={exercise.id}
                            value={exercise.name}
                            onSelect={() => {
                              setFormData({ ...formData, exerciseId: exercise.id });
                              setOpenExercisePicker(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                formData.exerciseId === exercise.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {exercise.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="targetValue">
                Target Value ({GOAL_TYPE_UNITS[formData.goalTypeId]})
              </Label>
              <Input
                id="targetValue"
                type="number"
                step={formData.goalTypeId === 5 ? '0.1' : '1'}
                min="0"
                value={formData.targetValue}
                onChange={(e) =>
                  setFormData({ ...formData, targetValue: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.startDate && 'text-muted-foreground'
                    )}
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(date) => setFormData({ ...formData, startDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">Target Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.targetDate && 'text-muted-foreground'
                    )}
                    type="button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.targetDate ? format(formData.targetDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.targetDate}
                    onSelect={(date) => setFormData({ ...formData, targetDate: date })}
                    disabled={(date) => formData.startDate ? date < formData.startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
