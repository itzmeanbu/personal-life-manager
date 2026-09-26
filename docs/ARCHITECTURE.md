# Architecture

## Stack

| Layer | Choice | Role |
|-------|--------|------|
| UI | React 18 + TypeScript + Vite | SPA |
| Local data | **Dexie (IndexedDB)** | Offline-first source of truth |
| Native shell | Capacitor 6 | Android APK/AAB |
| Optional API | Node.js + Express | Health / future sync only |
| Hosting (optional) | Render | Backend + static web preview |

**Not used as primary store:** SQLite. IndexedDB via Dexie is the persistent local store on web and inside the Android WebView. A future native SQLite plugin is optional and not required for offline use.

## Offline-first rule

- Core personal features work with **no internet** and **no Render**.
- Backend is optional. Absence of `VITE_API_BASE_URL` must not break the app.
- Backup/export is local file based.

## Data flow

```
UI pages → repositories (src/data/repository.ts)
        → Dexie tables (src/data/db.ts)
        → optional blobs (photos, MP3)
Settings / feature toggles → appSettings + featureToggles tables
Backup → JSON (+ optional AES-GCM) file on device
```

## Module boundaries

- Each domain has `src/<domain>/` helpers (college, workout, spin, home, music, …).
- Pages under `src/pages/` are UI only.
- Day profiles (`src/day/`) overlay routines and module visibility.
- Home arrival (`src/home/`) is foreground-reliable; background geofence is platform-limited (see limitations).

## Security

- App PIN (hashed) + optional Android biometric via `capacitor-native-biometric`.
- Auto-lock via app lifecycle.
- Screenshot/recents protection via `@capacitor-community/privacy-screen` on native only.

## Android

- No committed `android/` folder in this tree until `npx cap add android` is run on a machine with Android SDK.
- Config: `capacitor.config.ts` (`appId: com.lifemanager.app`).


## Private media & logo

- Imports copy into app-private IndexedDB blob keys (`media/backgrounds/`, `media/logos/`).
- Not written to public Gallery/DCIM/Pictures.
- Custom logo is in-app only; replacing the Android launcher icon requires rebuilding adaptive icons in Android Studio after `cap sync`.
- Backgrounds: one image URL at a time, thumbnails for gallery grid, compress on import.
