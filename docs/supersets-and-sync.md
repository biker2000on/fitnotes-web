# Supersets modeling & sync coverage

## Superset representation (decision)

A superset is stored as a `workout_groups` row plus `workout_group_exercises`
links — the **same two tables** serve both contexts, distinguished by which
columns are set:

| Context | `workout_groups` row |
|---|---|
| **Logged-workout superset** (a superset performed on a date) | `date = 'YYYY-MM-DD'`, `routine_section_id = NULL` |
| **Routine-template superset** (a superset defined inside a routine) | `date = ''`, `routine_section_id = <section>` |

We deliberately **keep this dual-use representation** rather than introducing a
dedicated `routine_section_exercise_group` table:

- It already round-trips losslessly through the FitNotes `.fitnotes` SQLite
  import/export (`backend/handlers/import_handler.go` / `export_handler.go`).
- A dedicated table would require a schema migration plus new import/export
  mapping for no functional gain.

`routine_section_exercises.populate_sets_type` is unrelated to grouping — it
controls how predefined sets are filled when a routine is loaded into a workout
(`template` / `last_workout` / `one_rep_max`).

## Sync coverage

Last-write-wins on `last_modified` (`backend/handlers/sync_handler.go` +
`sync_handler_extra.go`), offline-first client payload in
`frontend/src/storage/db.ts`.

**Synced tables:** categories, exercises, routines, routine_sections,
routine_section_exercises, routine_section_exercise_sets, training_logs,
body_weights, plates, barbells, workout_comments, workout_groups,
workout_group_exercises, goals, measurements, measurement_records.

### FK-safe push ordering

The server upserts pushed rows inside one transaction, so parents must precede
children:

1. categories, exercises
2. routines → routine_sections → routine_section_exercises → routine_section_exercise_sets
3. training_logs, body_weights, plates, barbells, workout_comments
4. workout_groups → workout_group_exercises  *(workout_groups.routine_section_id
   references routine_sections, which is why routine_sections must be pushed in
   step 2 — this previously dangled because routines were never synced)*
5. goals  *(references exercises)*
6. measurements → measurement_records  *(records reference measurements)*

The client mirrors this order in the `sync()` payload, and default measurements
are persisted (their parent is upserted before any record) so a synced
`measurement_record` never references a missing measurement.

## Refactor (done)

`App.tsx` is now a thin shell (~915 lines: the sidebar/header/tab-switch + inline
modals + one destructure). All state, handlers, and effects live in
`useFitNotesController()` in `store/FitNotesStore.tsx` (~1930 lines), which returns
the `store` object provided via context; `FitNotesStore` is now
`ReturnType<typeof useFitNotesController>` (no hand-maintained interface). Every tab
(Workout Log, Calendar, Exercises, Routines, Routine Editor, Body, Measurements,
Goals, Analysis, Sync) plus the Exercise-history drawer lives in `views/` /
`components/` and consumes its slice through `useFitNotesStore()`.

## Tauri mobile sync (done)

`mobile/src-tauri/src/main.rs` now pushes/pulls all tables the web client does
(routines*, workout_groups, workout_group_exercises, goals, measurements,
measurement_records), with FK-safe upsert ordering. The inline `setup()` schema
(the migration file is unused) was extended with the matching `CREATE TABLE`s.
The Android Tauri build was compile-verified on Windows and installed on a Pixel
9 as package `com.fitnotes.reborn.app`; see `docs/android-tauri-build.md` for the
current build/install workflow and gotchas.

## Settings sync (done)

The browser driver no longer sends `settings: null`. Settings are a per-user
singleton stored under `fn_settings` (seeded from `DEFAULT_SETTINGS`, which mirrors
the schema defaults). `useFitNotesController` writes changes via `persistSettings()`
(wired into the unit toggle → `metric` and theme toggle → `app_theme_id`), marking
the row dirty. `sync()` pushes the dirty singleton (a complete object, so no
zero-fill clobbers server defaults) and applies the server copy on pull;
`refreshData` reflects synced `metric`/`app_theme_id` back into the UI unless a
local change is still pending. Backend `pushSettings` keeps the last-write-wins
guard (`settings.last_modified < EXCLUDED.last_modified`), and registration seeds a
default settings row (`INSERT INTO settings (user_id)`).

Note: the Tauri local DB stores `settings` as a key/value table (used for the sync
cursor), so the columnar settings singleton is web/Postgres only for now; bringing
settings to the Tauri client would need a separate columnar table there.

## Known gaps / follow-ups

- Guest-then-login can produce duplicate default measurements (client virtual
  defaults + server-seeded defaults); harmless and user-deletable.
