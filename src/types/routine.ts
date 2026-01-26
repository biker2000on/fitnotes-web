export type Routine = {
  id: number;
  userId: string;
  name: string;
  notes: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  sections: RoutineSection[];
};

export type RoutineSection = {
  id: number;
  routineId: number;
  name: string;
  sortOrder: number | null;
  exercises: RoutineExercise[];
};

export type RoutineExercise = {
  id: number;
  sectionId: number;
  exerciseId: number;
  sortOrder: number | null;
  restTimerSeconds: number | null;
  notes: string | null;
  exercise?: {
    id: number;
    name: string;
    exerciseTypeId: number;
    category: {
      name: string;
      color: string;
    } | null;
  };
  sets?: PredefinedSet[];
  predefinedSets?: PredefinedSet[]; // Alias for backward compatibility
};

export type PredefinedSet = {
  id: number;
  sectionExerciseId: number;
  sortOrder: number | null;
  reps: number | null;
  metricWeight: number | null;
  durationSeconds: number | null;
  distance: number | null;
};
