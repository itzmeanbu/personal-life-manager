# SECURITY.md — App Lock & Data Security

This describes the **device-local app lock** (a PIN/biometric gate on the
app itself), not a server/account login — there is no user-account system,
and none of this depends on the backend or Render being reachable.

## 1. Authentication

- **PIN or password** (user's choice at setup) is the baseline method,
  always available regardless of device hardware.
- **Biometric** (fingerprint / face / iris) is offered as a fast-path when
  the device has it enrolled, via Android's own `BiometricPrompt` API
  through the `capacitor-native-biometric` plugin
  (`src/security/biometric.ts`). The app never implements its own
  fingerprint/face matching — that would be a fake biometric check, which
  the task explicitly forbids. If `BiometricPrompt` reports nothing is
  enrolled or available, the biometric option is simply not shown; the PIN
  always still works.
- **Pattern**: handled through Android's own device-credential fallback
  (`allowDeviceCredential` inside `BiometricPrompt`), which accepts
  whatever the user already set up at the OS level — PIN, pattern, or
  password. The app does not draw a second, separate pattern grid; that
  would duplicate what Android already verifies at the OS/hardware layer
  and would be weaker than it, not stronger.
- **App-lock gate** (`src/security/SecurityProvider.tsx` +
  `src/components/security/LockScreen.tsx`) sits above the router and
  renders on top of the whole app when locked, so no page content is
  reachable — including via back-navigation — until unlocked.

## 2. When the app locks

Configurable from **Settings → App lock & privacy**:

- **Lock on leaving the app** (default on) — the Capacitor `App` plugin's
  `appStateChange` event fires the instant the app is backgrounded (user
  switches apps, hits home, locks the phone screen, etc.), setting the
  locked flag before the app is even visible again.
- **Auto-lock after N minutes** — if "lock on leaving the app" is off, the
  app instead re-locks once it has been backgrounded for the configured
  duration (immediately / 1 / 5 / 15 / 30 minutes).
- App-lock state itself lives only in memory (React state) — a fresh app
  process always starts locked (if app-lock is enabled), so force-closing
  the app is never a bypass.

## 3. Encryption & key storage ("secure credentials")

- The PIN/password is **never stored, logged, or transmitted in plaintext**,
  anywhere, at any point.
- What's stored is `PBKDF2-SHA256(secret, salt, 150,000 iterations)` — a
  random 16-byte salt per secret, generated with `crypto.getRandomValues`
  (`src/security/crypto.ts`). 150k iterations follows OWASP's current
  PBKDF2-SHA256 minimum guidance for a rate-limited, device-local secret.
- The resulting hash + salt are written only to **secure storage**
  (`src/security/secureStorage.ts`), never to the regular app database
  (`src/data/db.ts`, which holds routines/tasks/etc. and is not
  encryption-at-rest by itself):
  - **On Android**, secure storage is backed by
    `@aparajita/capacitor-secure-storage`, which uses Android's
    `EncryptedSharedPreferences`, itself protected by a key held in the
    **Android Keystore** — hardware-backed on most devices (StrongBox /
    TEE where present). The raw PIN hash never leaves that encrypted store.
  - **On the web preview build** (no native layer, no OS keystore to bind
    to), the same interface falls back to `localStorage`. This is a real,
    documented gap — see Limitations below. The web preview is a
    development/preview target, not the secure target; the Android app is.
- Comparison of the entered secret's hash against the stored hash uses a
  length-checked, XOR-accumulated comparison (`safeEqual`) rather than
  `===`, to avoid trivial timing side-channels.
- **Brute-force cooldown:** after 5 consecutive failed attempts, PIN/
  password entry is blocked for 5 minutes (`MAX_FAILED_ATTEMPTS`,
  `COOLDOWN_MINUTES_AFTER_MAX_ATTEMPTS` in `src/security/types.ts`). This
  is what makes a 4–6 digit PIN's iteration count reasonable — without a
  cooldown, a short PIN alone would be brute-forceable.

## 4. Recovery mechanism

- At setup, alongside the PIN/password, the app generates a random
  12-character recovery code (e.g. `7F3K-9QXT-2M4L`) and shows it to the
  user **exactly once**. Only its PBKDF2 hash (separate salt) is stored —
  same guarantee as the PIN itself; the code cannot be retrieved again
  later, by the app or anyone else.
- "Forgot PIN/password?" on the lock screen accepts that recovery code,
  verifies its hash, and if valid lets the user set a new PIN/password —
  which immediately issues and displays a **new** recovery code (the old
  one is invalidated).
- This is entirely local — no server, email, or SMS step, consistent with
  "the app must not depend on Render to function." The trade-off (see
  Limitations) is that a lost recovery code + forgotten PIN means the
  locked local data is not recoverable by design — that's what "secure"
  has to mean for on-device secrets with no server-side reset path.

## 5. Screenshot & screen-recording protection

- Implemented via `@capacitor-community/privacy-screen`
  (`src/security/privacyScreen.ts`), which sets Android's window
  `FLAG_SECURE` when enabled.
- `FLAG_SECURE` is a single OS flag that covers **both** screenshot
  blocking and screen-recording blocking simultaneously (Android does not
  expose them as separate controls), and additionally blanks the app's
  thumbnail in the Recents/app-switcher view.
- Configurable from Settings as "Block screenshots & screen recording";
  applied whenever the config changes and reapplied on every app launch
  from the stored setting (`SecurityProvider`).
- Android-only: iOS and the web preview have no equivalent OS-level
  primitive, so the toggle is a no-op there (see Limitations).

## 6. Notifications

- Untouched by any of the above — app-lock and privacy-screen settings do
  not disable notifications. Per the task, notifications remain enabled.
- `AutomationSetting`/`FeatureToggle` (from the offline-first data layer,
  see `docs/DATABASE.md`) already provide a place to add **configurable
  notification privacy** later (e.g. "hide message content on lock
  screen") without a schema change — flagged here as a future item, not
  implemented in this pass since it wasn't in scope.

## 7. Limitations

- **Web preview build has no hardware keystore.** Secure storage there
  falls back to `localStorage`, which is not encryption-at-rest. Anyone
  with access to that browser profile's storage could read the PIN hash
  (not the PIN itself — it's still hashed — but the hash is no longer
  Keystore-protected). Treat the web preview as a UI/dev target, not the
  secure deployment target.
- **Screenshot/screen-recording protection is Android-only** by platform
  capability — there is no equivalent API on iOS or web to wire up even
  if a future iOS build were added.
- **No server-assisted recovery.** Losing both the PIN/password and the
  recovery code means the local data protected by that PIN is not
  recoverable through the app. This is an intentional consequence of never
  depending on Render/a backend for core function — there is no "reset via
  email" path possible without one.
- **Biometric availability is entirely device-dependent.** On devices with
  no enrolled fingerprint/face, only PIN/password is offered — this is
  Android's own `BiometricPrompt` reporting, not a limitation the app
  layer can work around (nor should it try to, per "do not implement fake
  biometric authentication").
- **Rooted/compromised devices** can defeat any on-device protection
  scheme, including Android Keystore in some cases — out of scope for an
  app-level control.

## 8. File map

```
src/security/
  types.ts               SecurityConfig shape, defaults, cooldown constants
  crypto.ts               PBKDF2 hashing, salt generation, recovery-code generation
  secureStorage.ts        Android Keystore-backed storage wrapper (native) / localStorage (web fallback)
  biometric.ts            Android BiometricPrompt wrapper (capacitor-native-biometric)
  privacyScreen.ts        FLAG_SECURE wrapper (@capacitor-community/privacy-screen)
  lockManager.ts          setup / verify / recovery / config persistence (business logic, no React)
  SecurityProvider.tsx    React context: locked state, auto-lock timer, background-lock listener

src/components/security/
  LockScreen.tsx           Full-screen PIN/biometric/recovery UI
  SecuritySettingsCard.tsx Settings UI: enable/disable, method, biometric, auto-lock, privacy screen
```


## Encrypted backup

- Optional user passphrase → PBKDF2 (120k iterations) + AES-GCM
- File prefix `LMENC1:` (`.lmenc` download)
- Passphrase is never stored; loss means backup cannot be decrypted
- Plain JSON export remains available without a passphrase

## Control Center

PIN / biometric / privacy screen settings remain under **Settings → Security** (`SecuritySettingsCard`). Feature toggles do not weaken encryption.


## Private media & logo

- Imports copy into app-private IndexedDB blob keys (`media/backgrounds/`, `media/logos/`).
- Not written to public Gallery/DCIM/Pictures.
- Custom logo is in-app only; replacing the Android launcher icon requires rebuilding adaptive icons in Android Studio after `cap sync`.
- Backgrounds: one image URL at a time, thumbnails for gallery grid, compress on import.
