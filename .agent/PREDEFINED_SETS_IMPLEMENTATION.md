# Predefined Sets Editor Implementation

## Overview
Implemented a complete predefined sets editor for routine exercises in the FitNotes web app.

## Files Created

### 1. `src/components/routines/predefined-set-row.tsx`
- Single row component for displaying and editing a predefined set
- Supports two exercise types:
  - **Type 0 (Weight/Reps)**: Weight input (kg/lbs) + Reps input
  - **Type 1 (Distance/Time)**: Distance input (km/mi) + Duration input (seconds)
- Features:
  - Drag handle for reordering (GripVertical icon)
  - Auto-converts units to metric for storage (grams for weight, meters for distance)
  - Delete button per row
  - User settings-aware (metric/imperial toggle)

### 2. `src/components/routines/predefined-sets-editor.tsx`
- Modal dialog component for editing all predefined sets for a routine exercise
- Features:
  - Loads existing sets from database
  - Add new sets with "Add Set" button
  - Delete individual sets
  - Shows set count and exercise type-specific inputs
  - Save/Cancel buttons with loading states
  - Auto-refreshes parent on close
- Props:
  - `sectionExerciseId`: ID of the routine section exercise
  - `exerciseName`: Display name
  - `exerciseType`: 0 for weight/reps, 1 for distance/time
  - `open`: Dialog visibility control
  - `onClose`: Callback when dialog closes

### 3. `src/components/routines/routine-exercise-item.tsx` (Updated)
- Enhanced existing component to integrate sets editor
- Added:
  - "Edit Sets" button
  - Set count badge display
  - Integration with PredefinedSetsEditor modal
  - `onSetsUpdated` callback to refresh parent after editing

### 4. `src/actions/routines.ts` (Updated)
Added two new server actions:

#### `getPredefinedSets(sectionExerciseId: number)`
- Fetches all predefined sets for a routine exercise
- Returns sets ordered by sortOrder
- Requires authentication

#### `savePredefinedSets(sectionExerciseId: number, sets: PredefinedSet[])`
- Bulk saves predefined sets (replaces all existing)
- Deletes all existing sets first, then inserts new ones
- Auto-assigns sortOrder based on array index
- Requires authentication

#### `PredefinedSet` Type
```typescript
interface PredefinedSet {
  id?: number;
  metricWeight?: number | null;  // in grams
  reps?: number | null;
  distance?: number | null;       // in meters
  durationSeconds?: number | null;
  sortOrder: number;
}
```

### 5. `src/types/routine.ts` (Updated)
- Added `exerciseTypeId` field to exercise object in RoutineExercise type
- Required for determining which input fields to show (weight/reps vs distance/time)

### 6. `src/components/routines/index.ts`
- Barrel export file for easy imports

## Database Schema

Uses existing `routine_section_exercise_sets` table:
```sql
CREATE TABLE routine_section_exercise_sets (
  id SERIAL PRIMARY KEY,
  section_exercise_id INTEGER NOT NULL REFERENCES routine_section_exercises(id) ON DELETE CASCADE,
  metric_weight INTEGER,        -- grams
  reps INTEGER,
  distance INTEGER,             -- meters
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0
);
```

## Unit Conversion

All values are stored in metric:
- **Weight**: Input in kg or lbs → Stored in grams
  - kg → grams: multiply by 1000
  - lbs → grams: multiply by 453.592
- **Distance**: Input in km or mi → Stored in meters
  - km → meters: multiply by 1000
  - mi → meters: multiply by 1609.34

Display conversion uses user settings from `userSettings.metric` boolean.

## UI Components Used

From shadcn/ui:
- `Dialog` (DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter)
- `Button`
- `Input`
- `Badge`
- `DropdownMenu`

Icons from lucide-react:
- `Plus` (add set)
- `Trash2` (delete set)
- `GripVertical` (drag handle)
- `Edit` (edit button)
- `MoreVertical` (options menu)

## Usage Example

```tsx
import { RoutineExerciseItem } from '@/components/routines';

<RoutineExerciseItem
  sectionExerciseId={exercise.id}
  exerciseName={exercise.exercise.name}
  exerciseType={exercise.exercise.exerciseTypeId}
  setCount={exercise.predefinedSets.length}
  notes={exercise.notes}
  restTimerSeconds={exercise.restTimerSeconds}
  onDelete={() => handleDelete(exercise.id)}
  onSetsUpdated={() => refetch()}
/>
```

## Features Implemented

- ✅ Modal editor for predefined sets
- ✅ Support for weight/reps exercises (type 0)
- ✅ Support for distance/time exercises (type 1)
- ✅ Add/remove individual sets
- ✅ Unit conversion (metric/imperial)
- ✅ Auto-save to database
- ✅ Set count badge display
- ✅ User settings integration
- ✅ TypeScript type safety
- ✅ Server action authentication

## Future Enhancements

- 🔲 Drag-and-drop reordering of sets
- 🔲 Copy/duplicate sets within editor
- 🔲 Bulk set templates (e.g., "3x10 pyramid")
- 🔲 Set rest timers per set
- 🔲 Set notes/comments
- 🔲 Undo/redo functionality

## Notes

- The implementation follows the existing codebase patterns (set-row.tsx)
- Uses server actions for all database operations
- Properly handles authentication via requireAuth()
- All database values stored in metric units for consistency
- Component is fully responsive and mobile-friendly
