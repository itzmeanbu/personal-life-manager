# Database

## Engine

- **Dexie.js** over **IndexedDB**
- Versioned schema in `src/data/db.ts` (v1…v12+)
- Soft deletes via `deleted` on `BaseEntity`
- Repositories in `src/data/repository.ts`

## Entity groups (summary)

- Routines & completion records  
- College categories / activities / day status  
- Workout templates, exercise defs, sessions  
- Guitar sessions, sleep records  
- Day profiles & assignments  
- Spin wheels & spin history  
- Entertainment categories & watchlist  
- Music playlists & tracks (+ `blobs` for audio)  
- Money transactions, lending, borrowing  
- Vehicles, fuel, distance, maintenance  
- Development records & photos (blob keys)  
- Friends & social records  
- Learning sessions  
- Bucket list items  
- Achievement defs & unlocks  
- App settings, feature toggles, automation settings  

## Blobs

`blobs` table stores binary (photos, MP3) keyed by string. Never auto-uploaded.

## Backup

`src/data/backup.ts` serializes all `ENTITY_TABLES` + blobs to JSON.  
Optional AES-GCM passphrase encryption (`.lmenc`).  
Restore modes: **merge** (upsert) or **replace** (clear then import — warned in UI).

## Feature toggles

`featureToggles` table + `isFeatureEnabled` / `setFeatureEnabled` in `settings.ts`.  
Seed flags also use this table (e.g. `*Seeded`).

## Future sync

Same backup payload shape can underpin optional server sync later without a breaking format change.
