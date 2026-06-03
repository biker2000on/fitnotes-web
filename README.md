# FitNotes Web

FitNotes Web is a full-stack FitNotes-style workout tracker with a web frontend,
Go backend, and a Tauri mobile shell.

## Project layout

- `frontend/` - React/Vite web client.
- `backend/` - Go API and sync/import/export backend.
- `mobile/src-tauri/` - Tauri v2 app used for desktop/mobile builds.
- `docs/` - project notes and implementation decisions.

## Common commands

Build the frontend:

```powershell
npm --prefix frontend run build
```

## Android Tauri build and install

See `docs/android-tauri-build.md` for the full Android setup, troubleshooting,
and install notes.

The quick path for installing a debug APK on a connected Pixel 9 is:

```powershell
cd C:\Users\biker\projects\fitnotes-web\mobile\src-tauri

$env:VITE_API_BASE_URL = "https://fitnotes.adventureintandem.com"
cargo tauri android build --debug --target aarch64 --apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r .\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

Use a debug build for direct device installs. The release APK produced by
`cargo tauri android build` is unsigned unless Android signing is configured,
and Android will reject an unsigned release APK.

## Notes for future agents

- `adb` may not be on `PATH`; use `$env:ANDROID_HOME\platform-tools\adb.exe`.
- Windows Developer Mode must be enabled so Tauri can create symlinks into
  `gen/android/app/src/main/jniLibs`.
- `mobile/src-tauri/tauri.conf.json` uses different path bases during Android
  builds: `beforeBuildCommand` needs `../frontend`, while `frontendDist` needs
  `../../frontend/dist`.
- `reqwest` is configured with Rustls in `mobile/src-tauri/Cargo.toml` to avoid
  native OpenSSL cross-compilation issues on Android.
- Android sync uses the native SQLite/Tauri path, not the browser localStorage
  path. Keep Tauri sync payload normalization and `is_deleted = 0` active-view
  filters in sync with the web driver behavior.
- Body weight chart behavior and Withings historical backfill notes live in
  `docs/body-weight-and-withings.md`.
