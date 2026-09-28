# Changelog

## Build fix (TypeScript strict errors on Render)
- college/dayOrder.ts: null-guard on saved last-chosen day order
- day/DayAsksCard.tsx: removed `await` inside sync `.filter()`; day asks are fetched once before filtering (also fixes the morning-check count)
- day/PeriodBoard.tsx: removed impossible `'unset'` / `'bunk'` / `'bunked'` / `'leave'` comparisons and the unused `TIME_SLOTS` import; class-day logic unchanged
- home/locationSession.ts: removed unused `stopHomeMonitor` import, renamed unused `reason` param to `_reason`
- No behaviour or data changes

## Day types + Wake Coach + notifications
- New day types: Deep Work Day, Coimbatore Stay (date ranges); friendly names for the rest
- Sunday is no longer special by default (toggle in Day Brief settings)
- Night picker offers all six types; multi-day picks for Deep Work / Coimbatore Stay
- Wake button, wake coach (Plan A/B/rush/missed), random multilingual greeting
- Bus log with fares, English + Tamil travel music (no repeats until all played)
- Real local notifications (needs npm install + cap sync), per-type toggles
- 15 built-in backgrounds with adaptive colours
- See docs/DAY_BRIEF.md

## Final integration phase

- Added ARCHITECTURE.md, FEATURES.md, README (frontend/backend), root .gitignore
- Documented offline-first, limits, deploy steps
- No full rebuild; Dexie/IndexedDB (not SQLite)

Unreleased / cumulative build

### Settings / Control Center
- Module deep-links for all major areas
- Feature toggles (workout, guitar, college, bike, money, sleep, k-drama, anime, social, hair/skin routine, spin, music, …) + custom keys
- Backup: EXPORT, EXPORT ENCRYPTED (AES-GCM), IMPORT/RESTORE with merge vs replace warning

### Prior feature stream
- College tracking + bunk day
- Special day profiles
- Workout engine
- Home arrival automation
- Guitar & sleep
- Recursive spin wheels
- Entertainment watchlists + spin integration
- Offline music playlists
- Money (daily + lend/borrow)
- Vehicles fuel/distance/range
- Development records & local photos
- Social + Naveen Anna
- Full-stack learning tracker
- Bucket list (seeded, editable)
- Gamification + Progress dashboard

### Docs
- PROJECT_CONTEXT.md, DATABASE.md, SECURITY.md, CHANGELOG.md updated


## Private media & logo

- Imports copy into app-private IndexedDB blob keys (`media/backgrounds/`, `media/logos/`).
- Not written to public Gallery/DCIM/Pictures.
- Custom logo is in-app only; replacing the Android launcher icon requires rebuilding adaptive icons in Android Studio after `cap sync`.
- Backgrounds: one image URL at a time, thumbnails for gallery grid, compress on import.
