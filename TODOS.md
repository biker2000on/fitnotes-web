# TODOs

## Done (2026-07-23 architecture + intelligence pass)
- ~~SQLite WASM (OPFS) storage for web — replaced the localStorage SQL mock; real SQL, indexes, transactions, one-time localStorage migration, localStorage fallback for unsupported browsers/second tabs.~~
- ~~PWA: manifest + service worker (autoUpdate), installable web app with offline shell.~~
- ~~Go sync round-trip test suite (push/pull, LWW conflicts, tombstones, incremental pull) gated on TEST_DATABASE_URL.~~
- ~~Progression suggestions: last-session ghost values, double-progression next-load recommendation, plateau/deload detection in the set entry modal.~~
- ~~SVG muscle diagram (front/back, primary/secondary/untargeted) on exercise guidance and workout summary; primary+secondary muscle data on default and custom exercises, backfilled server-side by migrations 000004 and 000005.~~
- ~~Weekly volume per muscle group: completed primary sets plus half-credit secondary sets, prior-week comparison, and a visible target band.~~
- ~~Combined strength analytics: Rep Max Grid, PR timeline, raw e1RM trend, and RPE/RIR-adjusted e1RM.~~
- ~~Read-only integration API keys: digest-only storage, one-time secret display, revocation, management UI, and versioned exercise/workout/body-weight endpoints.~~

## Roadmap to world-class
1. **Automated offsite backup** — nightly pg_dump shipped off the TrueNAS box.
2. **Program engine with periodization** — 5/3/1, GZCLP, linear templates; % of training-max auto-fill; builds on program_weeks/progression_* columns.
3. **Health Connect / Apple Health export** via a Tauri plugin — push workouts out; Withings already pulls weight in.
4. **Natural-language quick log** — "bench 225 5x3" parsed into sets; offline grammar first, optional LLM weekly-recap later.
5. **Share workout/graph as image** + cardio pace/speed graphs.
6. **Read/write API keys** — add mutation endpoints only after audit logging, rate limits, idempotency, and safer confirmation/revocation controls are designed.
7. **Scoped API keys** — per-resource and per-action grants, optional expiry, and scope-aware management UI.

## Done (2026-07-02 parity + mobile pass)
- ~~Per-exercise routine set types (copy previous / predefined / don't populate) honored when loading routines.~~
- ~~Workout timer (time workout): start/stop/resume/delete, auto-start on first set, auto-stop when all sets complete.~~
- ~~Copy (duplicate) routine templates including days, sets, and routine supersets.~~
- ~~Replace exercise: swap all of a day's sets to another exercise from the workout summary.~~
- ~~Mobile: routines/editor/workout log overflow, nested scrollbars, bottom-sheet modals, larger completion toggles and checkboxes.~~
- ~~Mark all complete + per-exercise complete buttons; superset naming and add-to-existing-group.~~

## Known gaps vs the reference Android app (deliberate or future)
- Delete workout history by date range / exercise filter (Settings > Data in the reference app).
- Set calculator (percent-of-1RM that adds a set directly from the logger; Tools has the standalone calculator).
- Share graph as image; share-workout include/exclude options (volume/PR/time toggles).
- Manual workout time editing (set start/end by hand); web has start/stop/resume/delete.
- Graph types not yet in Analysis: pace/speed for cardio.
- Android-only (not planned): notifications, Google Drive backup, home-screen widgets. Cloud sync covers backup.

More to come as the app gets used.
