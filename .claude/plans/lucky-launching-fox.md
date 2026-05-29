# Plan: Modularize frontend, add Goals / Measurements / Exercise-History, wire routine+measurement+goal sync

## Context

The `reborn` branch ports the FitNotes Android app (in `reference/fitnotes`) to a Go+Postgres backend, a React web frontend, and a Tauri offline app. The data model and FitNotes `.fitnotes` SQLite import/export are high-fidelity, but the **frontend is a single 4,063-line `App.tsx`** (one component, ~150 `useState`, ~50 handlers, one giant JSX return). Three FitNotes features that already have DB tables + Go models are unbuilt in the UI: **Goals**, **Measurements** (custom body-measurement tracker), and the **per-exercise History/Records** view. Separately, **routines, goals, and measurements do not sync** — and because routine supersets are stored as `workout_groups` rows referencing `routine_sections`, syncing workout_groups without routine_sections produces dangling references.

Goal: refactor `App.tsx` into a modular store+views architecture, build the three missing views, and close the sync gaps — implementing routine/goal/measurement sync plus documenting the superset modeling decision.

User decisions (confirmed): **full provider+views refactor** (staged & verified per tab); **Goals + Measurements as sidebar tabs, History as an exercise drawer**; **implement routine/goal/measurement sync now + document superset modeling**.

## Target module structure (`frontend/src/`)

```
types.ts                      // all interfaces (Category, Exercise, TrainingLog, Goal, Measurement, ...)
lib/
  colors.ts                   // intColorToHex (from App.tsx:153)
  units.ts                    // kg<->lbs conversion, getExerciseTypeLabel (App.tsx:160)
  uuid.ts                     // uuidv4 (App.tsx:174)
  stats.ts                    // NEW: estimated1RM, computeVolume, personalRecords, sessionSummaries
store/
  FitNotesStore.tsx           // React context Provider owning all state + actions (the current App body)
  useFitNotesStore.ts         // hook to consume the store
views/
  WorkoutLogView.tsx  CalendarView.tsx  ExercisesView.tsx
  RoutinesView.tsx    RoutineEditorView.tsx  BodyView.tsx
  MeasurementsView.tsx (NEW)  GoalsView.tsx (NEW)  AnalysisView.tsx  SyncView.tsx
components/
  ExerciseHistoryDrawer.tsx (NEW)   // Track/History/Records tabs for one exercise
  (existing modals stay: PlateCalculatorModal, CommandPalette, etc.)
App.tsx                       // layout shell only: sidebar + header + <tab> switch, wrapped in <FitNotesProvider>
```

## Phase 0 — Foundation extraction (no behavior change)

1. `types.ts`: move the 11 interfaces from `App.tsx:50-150`; add `Goal`, `Measurement`, `MeasurementRecord` interfaces mirroring `backend/models/models.go:135-210`.
2. `lib/colors.ts`, `lib/units.ts`, `lib/uuid.ts`: move the pure helpers (`intColorToHex`, `getExerciseTypeLabel`, `uuidv4`).
3. `lib/stats.ts` (NEW, reused by History/Records/Analysis):
   - `estimated1RM(weight, reps)` — Epley `weight * (1 + reps/30)`; ignore reps beyond `estimated_1rm_max_reps_to_include` (settings, default 10).
   - `volume(log)` = `weight * reps` (or distance/time variants per exercise type).
   - `personalRecords(logs)` → best weight per rep count + best estimated-1RM (mirrors FitNotes Actual vs Estimated records).
   - `sessionSummaries(logs)` → group logs by date with total sets/reps/volume/max-weight.
   - Verify: `npm run build` in `frontend/` stays green after each extraction.

## Phase 1 — Store provider

Create `store/FitNotesStore.tsx`: a `FitNotesProvider` that hosts every `useState` and every handler currently inside `App.tsx` (`refreshData` App.tsx:608, `triggerToast` :342, `triggerSync` :706, all `handleXxx`), exposed via context. `useFitNotesStore()` returns state + actions. Keep `db` (`storage/db.ts`) as the single data gateway — actions call `db.query`/`db.execute`/`db.sync` exactly as today. This is a mechanical move; behavior identical. Verify build + manual smoke of workout log.

## Phase 2 — View extraction (staged, verify each)

Reduce `App.tsx` to the sidebar + header + `activeTab` switch, rendering one `views/*` component per tab, each consuming `useFitNotesStore()`. Migrate **leaf tabs first** (Body, Analysis, Sync), then the heavy ones (WorkoutLog, Routines, RoutineEditor — these carry the drag-drop `DragDropContext` and superset bars at App.tsx:3140+). After each tab moves, build + click through that tab. `BodyView.tsx` uses the existing markup at App.tsx:3191-3226 as the template for the new Measurements view.

## Phase 3 — New views

### GoalsView.tsx (new sidebar tab "Goals")
- Lists goals joined to exercise name; add/edit/delete via `goals` table.
- Goal types (FitNotes): max weight, max reps, est-1RM, total volume/reps, distance, duration — drive which inputs show by `type_id` + the target exercise's `exercise_type_id`.
- Progress bar: current best (from `lib/stats.ts` over `training_logs` for that exercise) vs `metric_weight`/`reps`/target; show `target_date`.
- Store actions: `loadGoals`, `saveGoal`, `deleteGoal` (insert/replace/soft-delete in `goals`).

### MeasurementsView.tsx (new sidebar tab "Measurements")
- Left: list of measurements (default + custom) with latest value; add custom measurement (name, unit). Right: history of records for the selected measurement + add-record form (date defaults to `selectedDate`, value, comment). Mirrors BodyView layout.
- Store actions: `loadMeasurements`, `loadMeasurementRecords`, `saveMeasurement`, `saveMeasurementRecord`, soft-delete.
- Seed default measurements (Body Fat, Neck, Shoulders, Chest, Waist, Hips, Thigh, Calf, Bicep, Forearm) on first load if none exist — add to `backend/db/seeder.go` for server users and to the offline driver default-return for guests.

### ExerciseHistoryDrawer.tsx (opens from clicking an exercise)
A drawer with three tabs (matching FitNotes; from reference `res/`):
- **History**: all `training_logs` for the exercise grouped by date (newest first); each row shows `weight × reps` / distance / time per exercise type, comment, and a PR badge when `is_personal_record`. Per-session totals (sets, reps, volume) via `lib/stats.ts`.
- **Records**: Actual PRs (best weight per rep count, with date) and Estimated PRs (best estimated-1RM) from `personalRecords()`.
- **Graph**: per-exercise line chart (max weight / est-1RM / volume over time) — also fixes the Analysis view, which currently renders hardcoded dummy data (App.tsx:3247-3255).
- Wire open from the Exercises list and from the Workout Log exercise rows.

## Phase 4 — Offline driver + backend sync wiring

### `frontend/src/storage/db.ts`
- Add `BrowserLocalDriver` `query`/`execute` cases for: `routines` (already), `routine_sections`, `routine_section_exercises`, `routine_section_exercise_sets` (already), plus `goals`, `measurements`, `measurement_records`.
- Extend the `sync()` payload (db.ts:238-250) to include `routines`, `routine_sections`, `routine_section_exercises`, `routine_section_exercise_sets`, `goals`, `measurements`, `measurement_records`, and stop sending `settings: null` (send real dirty settings). Add matching `applyUpdates(...)` pull calls (db.ts:290-298).

### `backend/handlers/sync_handler.go`
Follow the existing per-table `pushXxx`/`pullXxx` template (each does `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE table.last_modified < EXCLUDED.last_modified`, last-write-wins). Add fields to `SyncRequest`/`SyncResponse` (structs at lines 17-43) and push/pull funcs + calls for: `routines`, `routine_sections`, `routine_section_exercises`, `routine_section_exercise_sets`, `goals`, `measurements`, `measurement_records`.
- **Ordering matters for FK constraints**: push parents before children — `routines` → `routine_sections` → `routine_section_exercises` → `routine_section_exercise_sets`, and ensure `routine_sections` push precedes `workout_groups` push (workout_groups.routine_section_id FK). `measurements` before `measurement_records`; `goals` after `exercises`.
- Extend `backend/handlers/sync_handler_test.go` with a routine+goal+measurement round-trip case.

## Phase 5 — Routines / supersets modeling (decision documented)

**Current model:** routine supersets reuse the logged-workout tables — a `workout_groups` row with `routine_section_id` set + empty `date`, and `workout_group_exercises` linking exercises. Decision: **keep this dual-use representation** (no schema migration) because (a) it already round-trips through FitNotes import/export and (b) the alternative (a dedicated `routine_section_exercise_group` table) adds a migration + import/export mapping with no functional gain. The real defect is sync integrity, fixed in Phase 4 by syncing `routine_sections` so the `workout_groups.routine_section_id` FK is never dangling.
- Document in code comments + a short note in the repo: a routine superset = `workout_groups (routine_section_id NOT NULL, date='')` + `workout_group_exercises`; a logged superset = `workout_groups (date=YYYY-MM-DD, routine_section_id NULL)`.
- Guard the sync push order so a `workout_group` referencing a `routine_section` is only upserted after that section exists (Phase 4 ordering covers this).

## Critical files
- `frontend/src/App.tsx` (split apart) · `frontend/src/storage/db.ts` (driver + sync payload)
- `backend/handlers/sync_handler.go` (+ `_test.go`) · `backend/db/seeder.go` (default measurements)
- New: `frontend/src/types.ts`, `lib/{colors,units,uuid,stats}.ts`, `store/FitNotesStore.tsx`, `views/*`, `components/ExerciseHistoryDrawer.tsx`

## Verification
1. `cd frontend && npm run build` green after each phase; `cd backend && go build ./... && go test ./...`.
2. Run app (`docker-compose up` or backend `go run .` + `npm run dev`): smoke every existing tab (workout log add/complete/delete set, routine editor drag-drop + superset linking, plate calc) to confirm no refactor regressions.
3. Goals: create a goal, log sets exceeding it, see progress bar fill + completion.
4. Measurements: add a custom measurement, log records, see history; confirm defaults seeded.
5. Exercise History: open drawer from an exercise, verify History grouping, Records (actual + estimated), and a real (non-dummy) graph.
6. Sync: log in on two browser profiles; create routine+superset, goal, measurement on A, sync; sync B; confirm all replicate with no FK errors. Inspect Postgres rows.
