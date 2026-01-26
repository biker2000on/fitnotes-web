'use client';

import { Suspense, useState, useEffect, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { addDays, subDays, format, parse, isValid } from 'date-fns';
import { ExerciseWorkoutCard } from '@/components/workout/exercise-workout-card';
import { AddExerciseDialog } from '@/components/workout/add-exercise-dialog';
import { WorkoutDuration } from '@/components/workout/workout-duration';
import { WorkoutNotes } from '@/components/workout/workout-notes';
import { RoutinePicker } from '@/components/workout/routine-picker';
import {
  getTrainingLogs,
  getLastWorkout,
  createTrainingLog,
  updateTrainingLog,
  deleteTrainingLog,
} from '@/actions/trainingLogs';
import { getUserSettings } from '@/actions/userSettings';

interface TrainingLog {
  id: number;
  exerciseId: number;
  metricWeight: number;
  reps: number;
  distance: number;
  durationSeconds: number;
  isComplete: boolean;
  isPersonalRecord: boolean;
  exercise: {
    id: number;
    name: string;
    exerciseTypeId: number;
    category: { name: string; color: string } | null;
  };
}

interface PreviousSet {
  id: number;
  metricWeight: number;
  reps: number;
  distance: number;
  durationSeconds: number;
  isComplete: boolean;
  isPersonalRecord: boolean;
}

interface GroupedLogs {
  [exerciseId: number]: {
    exercise: TrainingLog['exercise'];
    sets: TrainingLog[];
    previousSets?: PreviousSet[];
  };
}

function WorkoutContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');

  // Parse date from URL or default to today
  const initialDate = dateParam
    ? parse(dateParam, 'yyyy-MM-dd', new Date())
    : new Date();

  const [date, setDate] = useState(isValid(initialDate) ? initialDate : new Date());
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs>({});
  const [exerciseOrder, setExerciseOrder] = useState<number[]>([]); // Track exercise display order
  const [isMetric, setIsMetric] = useState(true);
  const [, startTransition] = useTransition();

  const dateString = format(date, 'yyyy-MM-dd');

  const loadWorkoutData = async () => {
    startTransition(async () => {
      const [fetchedLogs, settings] = await Promise.all([
        getTrainingLogs(dateString),
        getUserSettings(),
      ]);

      setIsMetric(settings?.metric ?? true);

      // Group logs by exercise and fetch previous sets
      const grouped: GroupedLogs = {};
      const order: number[] = []; // Track order of first appearance
      for (const log of fetchedLogs as TrainingLog[]) {
        if (!grouped[log.exerciseId]) {
          grouped[log.exerciseId] = {
            exercise: log.exercise,
            sets: [],
          };
          order.push(log.exerciseId);

          // Fetch previous workout
          const previousSets = await getLastWorkout(log.exerciseId, dateString);
          if (previousSets) {
            grouped[log.exerciseId]!.previousSets = previousSets as PreviousSet[] | undefined;
          }
        }
        grouped[log.exerciseId]!.sets.push(log);
      }

      setGroupedLogs(grouped);
      setExerciseOrder(order);
    });
  };

  // Load training logs and settings
  useEffect(() => {
    loadWorkoutData();
  }, [dateString]);

  const handleAddExercise = async (exerciseId: number) => {
    startTransition(async () => {
      // Check if exercise already exists in today's workout
      if (groupedLogs[exerciseId]) {
        return;
      }

      // Create first set with default values
      const newLog = await createTrainingLog({
        exerciseId,
        workoutDate: dateString,
        metricWeight: 0,
        reps: 0,
        unit: 0,
        distance: 0,
        durationSeconds: 0,
        isComplete: false,
      });

      // Fetch previous sets
      const previousSets = await getLastWorkout(exerciseId, dateString);

      // Update local state
      const fetchedLogs = await getTrainingLogs(dateString);

      const log = fetchedLogs.find(l => l.id === newLog?.id) as TrainingLog;
      setGroupedLogs({
        ...groupedLogs,
        [exerciseId]: {
          exercise: log.exercise,
          sets: [log],
          previousSets: previousSets as PreviousSet[] | undefined,
        },
      });
      setExerciseOrder([...exerciseOrder, exerciseId]);
    });
  };

  const handleAddSet = async (exerciseId: number) => {
    startTransition(async () => {
      const group = groupedLogs[exerciseId];
      if (!group) return;

      // Use last set values or previous workout values
      let metricWeight = 0;
      let reps = 0;

      if (group.sets.length > 0) {
        const lastSet = group.sets[group.sets.length - 1];
        metricWeight = lastSet?.metricWeight ?? 0;
        reps = lastSet?.reps ?? 0;
      } else if (group.previousSets && group.previousSets.length > 0) {
        const lastPrevious = group.previousSets[group.previousSets.length - 1];
        metricWeight = lastPrevious?.metricWeight ?? 0;
        reps = lastPrevious?.reps ?? 0;
      }

      const newLog = await createTrainingLog({
        exerciseId,
        workoutDate: dateString,
        metricWeight,
        reps,
        unit: 0,
        distance: 0,
        durationSeconds: 0,
        isComplete: false,
      });

      // Update local state
      const fetchedLogs = await getTrainingLogs(dateString);

      const log = fetchedLogs.find(l => l.id === newLog?.id) as TrainingLog;
      setGroupedLogs({
        ...groupedLogs,
        [exerciseId]: {
          ...group,
          sets: [...group.sets, log],
        },
      });
    });
  };

  const handleUpdateSet = async (
    id: number,
    data: {
      metricWeight?: number;
      reps?: number;
      distance?: number;
      durationSeconds?: number;
      isComplete?: boolean;
    }
  ) => {
    // Optimistically update local state first (no reordering)
    setGroupedLogs(prevGrouped => {
      const newGrouped = { ...prevGrouped };
      for (const exerciseId of Object.keys(newGrouped)) {
        const group = newGrouped[Number(exerciseId)]!;
        const setIndex = group.sets.findIndex(s => s.id === id);
        if (setIndex !== -1) {
          const updatedSets = [...group.sets];
          updatedSets[setIndex] = { ...updatedSets[setIndex]!, ...data };
          newGrouped[Number(exerciseId)] = { ...group, sets: updatedSets };
          break;
        }
      }
      return newGrouped;
    });

    // Then persist to database
    startTransition(async () => {
      await updateTrainingLog(id, data);
    });
  };

  const handleDeleteSet = async (id: number) => {
    startTransition(async () => {
      await deleteTrainingLog(id);

      // Update local state
      const fetchedLogs = await getTrainingLogs(dateString);

      // Rebuild grouped logs
      const grouped: GroupedLogs = {};
      for (const log of fetchedLogs as TrainingLog[]) {
        if (!grouped[log.exerciseId]) {
          grouped[log.exerciseId] = {
            exercise: log.exercise,
            sets: [],
            previousSets: groupedLogs[log.exerciseId]?.previousSets,
          };
        }
        grouped[log.exerciseId]!.sets.push(log);
      }
      setGroupedLogs(grouped);
      // Update exerciseOrder to remove any exercises that no longer have sets
      const remainingExerciseIds = new Set(Object.keys(grouped).map(Number));
      setExerciseOrder(exerciseOrder.filter(id => remainingExerciseIds.has(id)));
    });
  };

  return (
    <div>
      <Header
        showDateNav
        date={date}
        onPrevDate={() => setDate(subDays(date, 1))}
        onNextDate={() => setDate(addDays(date, 1))}
      />
      <div className="p-4 pb-24 space-y-4">
        <div className="flex justify-end">
          <RoutinePicker workoutDate={dateString} onApplied={loadWorkoutData} />
        </div>
        <WorkoutDuration date={dateString} />
        <WorkoutNotes date={dateString} />
        {exerciseOrder.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">No exercises logged yet</p>
            <p className="text-sm">Add an exercise to start your workout</p>
          </div>
        ) : (
          exerciseOrder.map((exerciseId) => {
            const group = groupedLogs[exerciseId];
            if (!group) return null;
            return (
              <ExerciseWorkoutCard
                key={exerciseId}
                exercise={group.exercise}
                sets={group.sets}
                previousSets={group.previousSets}
                isMetric={isMetric}
                workoutDate={dateString}
                onAddSet={handleAddSet}
                onUpdateSet={handleUpdateSet}
                onDeleteSet={handleDeleteSet}
              />
            );
          })
        )}
      </div>
      <AddExerciseDialog onAdd={handleAddExercise} />
    </div>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense fallback={
      <div>
        <Header showDateNav date={new Date()} onPrevDate={() => {}} onNextDate={() => {}} />
        <div className="p-4">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <WorkoutContent />
    </Suspense>
  );
}
