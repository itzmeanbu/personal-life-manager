# Features (implemented)

All of the following exist as code paths in the current frontend. Behavior is **offline-local** unless noted.

| Feature | Status | Notes |
|---------|--------|--------|
| App start / nav | OK | React Router + bottom nav + module drawer |
| Daily routines | OK | Editable templates, completions |
| College day / bunk | OK | Categories, stats, bunk arrival windows |
| Special days / Exam | OK | Day profiles, no code change for new types |
| Workout engine | OK | Sets/reps/duration; skip/cancel/manual start |
| Late home > cutoff | OK | Workout status `cancelled` (not completed) |
| Home detection | Partial | Foreground poll + optional native geolocation |
| 15‑min post-arrival delay | OK | Configurable |
| Home sound | OK | Web Audio tone; native asset optional later |
| Guitar / Sleep | OK | Logs + totals / adherence |
| Spin + recursive wheels | OK | Unlimited nesting, time windows |
| K-drama watchlist / 4h binge | OK | Category default 240 min, editable |
| Friends / Naveen Anna | OK | Separate from generic friends |
| Money / lend / borrow | OK | Paid-by never assumed; partial repay |
| Bike fuel / distance / warn | OK | Mileage user-configured |
| Vehicle sold | OK | History kept, tracking stops |
| Development records / photos | OK | Local blobs only |
| Bucket list | OK | Seed data editable |
| Gamification / Progress | OK | XP/streaks from real metrics |
| Settings / toggles | OK | Control Center |
| Backup / restore | OK | Merge/replace; optional encrypt |
| Offline mode | OK | No server required |
| Auth PIN / biometric | OK | Biometric **native Android only** |
| Auto-lock | OK | |
| Screenshot protection | Native only | Privacy Screen plugin |
| Notifications | Limited | No full push pipeline; prompts are in-app |
| MP3 / shuffle | OK | User-picked files; no library scan |

## Explicit non-goals in this build

- Cloud sync (payload shape ready via backup format).
- Invented history or fake achievements.
- Unrestricted background geofencing on pure web.

## Appearance & private media (Prompt 21)

- Configurable app logo (default compass/energy/A mark or custom upload)
- Daily background gallery (~30 photos), shuffle with anti-repeat history
- Media stored as IndexedDB blobs under `media/backgrounds|logos|…` — not DCIM/Gallery
- Module emoji identity on Home tiles
- Appearance page: theme accent, background toggles
