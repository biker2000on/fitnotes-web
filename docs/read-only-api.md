# Read-only integration API

FitNotes exposes a versioned, read-only HTTP API for integrations. API keys are
managed in **Settings > Integrations** after signing in to a synced account.

## Security model

- Keys begin with `fn_ro_` and are shown only once when created.
- The server stores a SHA-256 digest, never the plaintext key.
- Keys can call only the versioned `/api/v1` routes.
- Only `GET` and `HEAD` are accepted.
- Keys can be revoked immediately from Settings.
- Creating, listing, and revoking keys requires a normal signed-in session.

Send a key using either standard bearer authentication:

```http
Authorization: Bearer fn_ro_your_key
```

or:

```http
X-API-Key: fn_ro_your_key
```

## Resources

### API information

```http
GET /api/v1/
```

Lists the available resources: exercises, workouts, body-weights,
workout-groups, workout-routines, and workout-times.

### Exercises

```http
GET /api/v1/exercises?limit=200&offset=0
```

Returns active exercises with category, type, equipment, and primary/secondary
muscle metadata.

### Workout sets

```http
GET /api/v1/workouts?from=2026-01-01&to=2026-12-31&exercise_id=<uuid>&limit=200&offset=0
```

All filters are optional. The response includes weight, reps, RPE, RIR, set
type, completion/PR flags, cardio fields, comments, and modification time.
Each set also carries `routine_section_exercise_set_id` (nullable UUID) linking
the logged set back to the routine template set it was populated from.

### Completion timing

Workout sets include nullable `completed_at` (ISO 8601). An individual check
on today's local workout records the client time; weight, rep, and comment
edits preserve it. Undo clears it, and rechecking records a new time. Copying
or moving a set clears timing. Bulk completion and historical checks leave
it null because they do not establish when the work occurred. Existing data
is not backfilled from `last_modified`, which changes on ordinary edits.
Missing historical checkmarks do not establish that a set was not performed.

The field survives web/offline/native storage and sync. Older clients that
omit it on edits preserve an existing timestamp while the set stays complete
on the same workout date. Explicit `null` clears timing even when the set
remains complete (for example, an offline undo followed by bulk completion).
Backend migration 000007 and the native SQLite
column upgrade are additive; deploy the backend before the new clients.

### Workout times

```http
GET /api/v1/workout-times?from=2026-01-01&to=2026-12-31&limit=200&offset=0
```

Returns `id`, `date`, nullable `start_time`, `end_time`, `duration_seconds`,
`last_modified`, and `is_deleted`. Date filters and pagination follow workouts.
Unlike other read resources, this includes deletion markers so an integration
can clear a previously imported timer. A running timer has no end time and
must not be treated as a finished workout duration. Only the authenticated
user's records are returned.

### Body weights

```http
GET /api/v1/body-weights?from=2026-01-01&to=2026-12-31&limit=200&offset=0
```

### Workout groups (supersets)

```http
GET /api/v1/workout-groups?from=2026-01-01&to=2026-12-31&limit=200&offset=0
```

Returns logged-workout supersets only — groups performed on a real calendar
date. Routine-template supersets (groups defined inside a routine) are
excluded. Each row is:

```json
{
  "id": "…",
  "name": "Superset 1",
  "date": "2026-07-23",
  "colour": 3,
  "exercise_ids": ["…", "…"],
  "last_modified": "2026-07-23T18:04:11Z"
}
```

`exercise_ids` lists the exercises grouped into the superset, in stable order.

### Workout routines

```http
GET /api/v1/workout-routines?from=2026-01-01&to=2026-12-31&limit=200&offset=0
```

Returns which routine (and optionally which routine section) was loaded into a
workout day. Each row is:

```json
{
  "id": "…",
  "date": "2026-07-23",
  "routine_id": "…",
  "routine_name": "PPL",
  "routine_section_id": "…",
  "section_name": "Push",
  "last_modified": "2026-07-23T18:04:11Z"
}
```

`routine_section_id` and `section_name` are `null` when the whole routine was
loaded rather than a single section.

## Example

```powershell
$headers = @{ Authorization = "Bearer fn_ro_your_key" }
Invoke-RestMethod `
  -Uri "https://fitnotes.example.com/api/v1/workouts?from=2026-01-01" `
  -Headers $headers
```

Pagination defaults to 200 records and is capped at 1,000 records per request.
Dates must use `YYYY-MM-DD`.
