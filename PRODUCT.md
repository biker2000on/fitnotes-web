# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first web app that also ships as an installable PWA and inside an Android Tauri WebView shell. One design language across all three; the phone is the primary device, desktop web is a first-class secondary.

## Users

- **Primary today:** the owner, a lifter who has logged in the original Android FitNotes app since at least 2024 (442 sessions, ~300 exercises, 13 routines in the imported backup), following programs such as ATG.
- **Eventually:** anyone. The app should be openable to the public later, so first-run, empty states, sign-up and import need to make sense to a stranger.
- **Situation:** mostly a home/garage gym. The phone is propped on a bench or rack between sets, glanced at in mixed or dim light, operated with sweaty hands. Planning (routines, exercise library, reviewing progress) also happens at a desk on the web.

## Product Purpose

A faithful, faster successor to the Android FitNotes workout log: record sets in seconds, follow routines, and see history and progress. Adds what the original lacks: sync across phone, web and devices, while still working completely offline (no signal in the gym is normal).

Success: logging a set mid-workout takes a glance and a couple of taps on the phone; planning and reviewing on desktop web feels designed for a big screen, not a stretched phone.

## Positioning

The FitNotes data model and speed the owner already trusts (it imports and exports native `.fitnotes` backups), made offline-first and synced, with progression hints drawn from the lifter's own history. Not a social or coaching app.

## Operating Context

- Core loop: pick exercise → enter weight/reps → save → mark complete → rest timer → next set.
- Routines are structured Routine → Day → Exercise → Set; a day is loaded into a date's log, then logged against.
- Calendar month view is the review surface the owner likes and is not to be redesigned.
- Data lives locally (SQLite WASM/OPFS on web, native SQLite in Tauri) and syncs to a Go backend when signed in. Read-only integration API keys exist.

## Capabilities and Constraints

- Must work fully offline; sync is opportunistic.
- Weights are stored per set with their own unit code (1 = kg, 2 = lbs, FitNotes legacy 0 = kg) and must always be shown and edited in the user's chosen unit.
- Terminology: **Routine** and **Day** (not "template", "split", or "workout day"). Program fields (version, program weeks, current week, start date, archive) are optional and live in a Program settings sheet, not the main editor.
- Phone navigation: bottom tabs **Log · Calendar · Routines · Body · More**; Exercises, History, Measurements, Goals, Analytics, Tools, Settings, Sync live under More. Exercises management is mainly a desktop surface; on the phone, exercises are added/edited via the picker and an exercise detail page.
- Starting a routine day opens a quick sheet with the target date and fill method preselected; one tap confirms.
- Destructive actions are undoable.

## Brand Commitments

- Name: **FitNotes** (web app/PWA). Icon concept: a notebook with a check mark (`frontend/public/favicon.svg`, `docs/icon-concepts/`). Colours of the icon may follow the visual identity.
- Owner wants a bold new visual identity replacing the generic dark-dashboard look, while staying dense and mobile-first.

## Evidence on Hand

- Real FitNotes backups: `reference/FitNotes_Backup_2026_05_31_19_47_26.fitnotes`, `reference/FitNotes_Backup_2025_09_15_14_12_28.sqlite`.
- Decompiled original app for flow reference: `reference/fitnotes/res` (layouts, menus, strings).
- No body-weight history in the backups (comes from Withings). No testimonials, users, or metrics to cite.

## Product Principles

1. **The set is the unit.** Every screen is judged by how quickly it gets a set logged or understood.
2. **Glanceable from a bench.** Large numerals, high contrast, thumb-reachable actions; nothing that needs a second look under dim light.
3. **Plain gym language.** Routine, Day, Set, Rest. No dashboard or SaaS vocabulary.
4. **Never lose a lift.** Offline first, undo on destruction, explicit dates and units.
5. **Phone first, desk worthy.** The phone layout leads; desktop earns its width with real side-by-side layouts.

## Accessibility & Inclusion

WCAG AA contrast minimum, 44px touch targets on touch devices, full keyboard operation on desktop (the owner uses shortcuts), visible focus, reduced-motion respect.
