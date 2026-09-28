# Changelog

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
