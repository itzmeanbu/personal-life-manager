# Life Manager (frontend)

Offline-first personal life OS. **Does not require Render or internet** for core use.

## Quick start

```bash
cd frontend   # or extract frontend.zip
npm install
npm run dev
```

Optional API base (does not block offline UI):

```bash
# .env (never commit secrets)
VITE_API_BASE_URL=http://localhost:4000
```

## Backend (optional)

```bash
cd backend
npm install
npm run dev
# GET http://localhost:4000/api/health
```

## Android (APK / AAB)

Requires Android Studio + SDK on your machine.

```bash
cd frontend
npm install
npm run build
npx cap add android          # once
npx cap sync android
npx cap open android         # build APK/AAB in Android Studio
```

Plugins already in `package.json`: `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/geolocation`, secure storage, native biometric, privacy-screen.

Grant runtime permissions on device: location (if using home arrival), notifications (if you add a local-notifications plugin later), and use the **system file picker** for MP3 (no all-files scan).

## Backup

Settings → Control Center → Backup: EXPORT, EXPORT ENCRYPTED, IMPORT/RESTORE (merge or replace with confirmation).

## Docs

- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/FEATURES.md`
- `docs/CHANGELOG.md`

## GitHub

Do not commit `.env`, `node_modules`, `dist`, or signing keystores. See root `.gitignore` if present.
