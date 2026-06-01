# Android Tauri build

This project's Android app is built from `mobile/src-tauri` with Tauri v2.

## Prerequisites

Required tools:

- Rust and Cargo.
- Tauri CLI: `cargo install tauri-cli --locked`.
- Android Studio with SDK Platform, Platform-Tools, Build-Tools, Command-line
  Tools, and NDK installed.
- Android Rust targets:

```powershell
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Expected environment variables on this Windows machine:

```powershell
$env:ANDROID_HOME = "C:\Users\biker\AppData\Local\Android\Sdk"
$env:NDK_HOME = "C:\Users\biker\AppData\Local\Android\Sdk\ndk\30.0.14904198"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

`adb` is available at:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe"
```

## One-time setup

Generate the Android project if `mobile/src-tauri/gen/android` does not exist:

```powershell
cd C:\Users\biker\projects\fitnotes-web\mobile\src-tauri
cargo tauri android init
```

If icons are missing, regenerate them from the frontend favicon:

```powershell
cargo tauri icon ..\..\frontend\public\favicon.svg
```

Enable Windows Developer Mode before building. Tauri symlinks native Rust
libraries into Android `jniLibs`; without symlink permission the build fails
after Rust compilation with "Creation symbolic link is not allowed for this
system."

## Build and install on Pixel 9

Plug in the phone, enable USB debugging, accept the authorization prompt, and
confirm the device is visible:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
```

Expected device line for the tested phone:

```text
48231FDAQ0030E         device product:tokay model:Pixel_9 device:tokay
```

Build a debug APK for the Pixel 9's ABI and install it:

```powershell
cd C:\Users\biker\projects\fitnotes-web\mobile\src-tauri
$env:VITE_API_BASE_URL = "https://fitnotes.adventureintandem.com"
cargo tauri android build --debug --target aarch64 --apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r .\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
```

Launch the installed app:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell monkey -p com.fitnotes.reborn.app 1
```

Installed package:

```text
com.fitnotes.reborn.app
```

## Release builds

`cargo tauri android build` creates release artifacts, but the generated
universal release APK is unsigned unless Android signing is configured. Installing
`app-universal-release-unsigned.apk` fails with:

```text
INSTALL_PARSE_FAILED_NO_CERTIFICATES
```

Use debug builds for local sideloading until release signing is configured.

## Repo-specific gotchas

- `tauri.conf.json` has two path bases during Android builds:
  - `beforeBuildCommand`: `npm --prefix ../frontend run build`
  - `frontendDist`: `../../frontend/dist`
- Do not change both paths to the same relative prefix without testing Android
  builds. The command and asset lookup are resolved from different places.
- `reqwest` uses `default-features = false` with `rustls-tls`; native OpenSSL
  caused Android cross-compilation failure from Windows.
- Set `VITE_API_BASE_URL` before building the APK. The value is compiled into
  the frontend bundle; use `https://fitnotes.adventureintandem.com` for the
  production FitNotes cloud target.
- The frontend depends on `@tauri-apps/api/core` in Tauri mode. Do not mark that
  package as an external Rollup dependency; a bare specifier in the built bundle
  causes Android WebView to fail with:

```text
failed to resolve module specifier @tauri/apps/api/core
```

- Browser mode's localStorage driver filters deleted rows internally, but the
  Tauri SQLite driver returns exactly what SQL asks for. Date-scoped UI queries
  that populate active views should include `AND is_deleted = 0`; otherwise
  tombstoned sync rows can render on Android after a full pull.
- Tauri sync payloads come from SQLite rows. Normalize them before posting to
  the Go API: remove local-only fields such as `is_dirty`, convert SQLite
  `0/1` values to JSON booleans for bool fields, and convert legacy string IDs
  to UUIDs. Without this, `/api/sync` can return `400 {"error":"invalid sync payload"}`.
- First builds are slow because Cargo and Gradle compile and cache everything.
  Later debug builds are much faster unless native dependencies, `target/`, or
  Gradle caches are changed.
- If ADB temporarily loses the phone, restart ADB or wait for the USB debugging
  session to reconnect:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" kill-server
& "$env:ANDROID_HOME\platform-tools\adb.exe" start-server
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
```
