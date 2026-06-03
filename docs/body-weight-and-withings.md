# Body weight chart and Withings backfill

## Current body weight UI

The Body Weight page lives in `frontend/src/views/BodyView.tsx`.

- Manual weight entry opens a modal from the `Log Weight` button.
- History renders as two synchronized Recharts lanes:
  - Weight, displayed in the selected user unit.
  - Body fat percentage, when present.
- The X axis is numeric timestamp-based, not categorical, so sparse history keeps real time spacing.
- The default chart window is `1Y`; users can switch to `1M`, `1Y`, or `ALL`.
- Mouse wheel zooms around the cursor position.
- Dragging horizontally across either lane selects a time range and zooms both lanes to that range.

The two lanes share one `xDomain` so cursor, wheel zoom, drag zoom, and preset filters keep weight and body fat aligned.

## Withings sync behavior

Withings integration is in `backend/handlers/withings_handler.go`.

The manual `/api/withings/sync` endpoint is intentionally an all-time repair pull:

```go
PullWithingsWeightsRange(ctx, pool, userID, 0, time.Now().Unix())
```

This is not just an incremental sync. It is meant to repair historical gaps after connect-time imports, API paging issues, or webhook misses.

The Withings `measure/getmeas` response can be paginated. `pullWithingsWeights` must keep following `body.more` and submit the returned `body.offset` on the next request. A previous implementation only processed the first page, which could make an "all-time" pull stop at a page boundary such as 2018 even when older data existed.

Deterministic UUIDs are generated from the Withings `grpid`, so re-running an all-time repair pull is safe: existing records are skipped by `ON CONFLICT (id) DO NOTHING`.

## Verification

Frontend:

```powershell
npm --prefix frontend run build
```

Backend:

```powershell
cd backend
go test ./...
```

Android debug install on a connected Pixel 9:

```powershell
cd C:\Users\biker\projects\fitnotes-web\mobile\src-tauri
$env:VITE_API_BASE_URL = "https://fitnotes.adventureintandem.com"
cargo tauri android build --debug --target aarch64 --apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r .\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell monkey -p com.fitnotes.reborn.app 1
```
