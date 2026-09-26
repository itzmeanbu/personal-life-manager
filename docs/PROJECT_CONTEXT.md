# Project context — Life Manager

Offline-first personal life OS (React + Vite + Dexie + Capacitor).

## Intent

- Private, on-device configuration — not a website admin panel.
- User changes behavior via **Control Center** and module screens; no source edits required for new categories, wheels, budgets, mileage, achievements, etc.
- Real records only: no invented history, achievements from real metrics only.

## Major modules (frontend)

| Area | Path / notes |
|------|----------------|
| Routines | Configurable daily templates |
| College | Categories, bunk day, stats |
| Workout | Flexible sets/reps/duration engine |
| Home arrival | Geofence-aware, late-cancel rule |
| Guitar / Sleep | Practice & bedtime logs |
| Spin | Unlimited nested wheels |
| Entertainment | Watchlists, binge config |
| Music | Offline MP3 playlists |
| Money | Daily ₹ budget, lend/borrow |
| Vehicles | Fuel, distance, range estimate |
| Development / Social | Records + friends (Naveen Anna separate) |
| Learning | Full-stack session tracker |
| Bucket list | Seeded editable goals |
| Progress | XP, streaks, achievements dashboard |
| Settings | Control Center, toggles, backup, security |

## Backend

Minimal Node health API in `backend/` — primary data plane is local IndexedDB.

## Design

Dark UI, module color tokens in `styles/tokens.css`. Android-first Capacitor shell.

## Local storage

Dexie → IndexedDB (not SQLite in this build). Blobs for photos/MP3.

## Platform honesty

- Background geofence: native Android + permissions; web is foreground-only.
- Biometrics & screenshot blocking: Capacitor plugins; degraded in pure browser.
- Notifications: in-app prompts; full OS push not fully wired.
- Music: explicit file picker only — no full-device scan.

See `docs/FEATURES.md` and `docs/CHANGELOG.md`.


## Private media & logo

- Imports copy into app-private IndexedDB blob keys (`media/backgrounds/`, `media/logos/`).
- Not written to public Gallery/DCIM/Pictures.
- Custom logo is in-app only; replacing the Android launcher icon requires rebuilding adaptive icons in Android Studio after `cap sync`.
- Backgrounds: one image URL at a time, thumbnails for gallery grid, compress on import.
