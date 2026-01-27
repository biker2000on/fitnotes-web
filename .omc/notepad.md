# OMC Notepad

## Priority Context
fitnotes-web: Next.js fitness app with Drizzle ORM. Dev server on port 3003. Routine supersets implemented with supersetGroupId field, actions in routines.ts, UI in section-card.tsx. DB migration may still be needed.

## Working Memory

### 2026-01-26 - Session Progress
- Fixed FAB button position (bottom-20 to clear nav)
- Added Routines link to More menu
- Added Categories management page at /categories
- Fixed routine exercise names not showing (added exercise relation to getRoutine query)
- Fixed Add Set to copy from first set values
- Fixed set badge update after saving predefined sets
- Implemented drag-and-drop for sections and exercises using @dnd-kit
- Implemented superset support for routines:
  - Added supersetGroupId to routineSectionExercises schema
  - Added createRoutineSuperset, removeFromSuperset, dissolveSuperset actions
  - Updated applyRoutineToWorkout to create workout groups from routine supersets
  - Added selection mode UI with color-coded superset groupings
  - Fixed state sync bug in section-card.tsx (useEffect for superset grouping updates)
  - Migration 0004_skinny_hemingway.sql created - needs to be applied if not already

## MANUAL

