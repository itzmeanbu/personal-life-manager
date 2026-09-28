# Changelog

## Wake gate, time-anchored morning, nav fix

- Welcome page is now a full-screen "Did you wake up?" (Yes / I woke up earlier / Not yet). Shown 04:00-15:00 until a wake time is logged.
- Wake time drives the morning block: routine times shift later by however late you woke (never earlier). "Wake up" routine and "Actually out of bed" ask are ticked automatically.
- Home shows what to do Now (or Next at ...), then Coming up, above the yes/no cards. "Morning To-Do" heading is now "Morning" with "up since ..." in the header.
- Fixed: Morning phase pulled in night routines (Bath, Night hair & face) because they share the Hygiene category, so it showed 0/7 and could not finish. Category matches now respect time of day; Bath / Night routine belong to Evening.
- Bottom nav: four equal-width tabs (Today, Modules, Progress, Settings) with SVG icons; removed the off-centre floating button. Modules opens the same drawer.
- Files: components/navigation/BottomNav.tsx + navigation.css, home/MorningGreeting.tsx + wakeGate.css, day/timeline.ts + timeline.css, day/wakeGate.ts, day/phaseEngine.ts, day/spendPrompts.ts (setWakeTime takes an optional time), hooks/useNow.ts, pages/Home.tsx

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
