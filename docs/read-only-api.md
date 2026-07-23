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

### Body weights

```http
GET /api/v1/body-weights?from=2026-01-01&to=2026-12-31&limit=200&offset=0
```

## Example

```powershell
$headers = @{ Authorization = "Bearer fn_ro_your_key" }
Invoke-RestMethod `
  -Uri "https://fitnotes.example.com/api/v1/workouts?from=2026-01-01" `
  -Headers $headers
```

Pagination defaults to 200 records and is capped at 1,000 records per request.
Dates must use `YYYY-MM-DD`.
