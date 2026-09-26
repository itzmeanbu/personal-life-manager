/**
 * App-lock / security configuration types.
 * This governs LOCAL DEVICE ACCESS to the app (like a screen lock for the
 * app itself) — it is not a server account-login system. Nothing here
 * requires the backend/Render to be reachable.
 */

export type LockMethod = 'pin' | 'password';

export interface SecurityConfig {
  /** Master switch. When false, the app never shows the lock screen. */
  appLockEnabled: boolean;
  lockMethod: LockMethod;
  /** Whether biometric (fingerprint/face/etc., via Android BiometricPrompt) is offered as a fast-path. */
  biometricEnabled: boolean;
  /**
   * Minutes of background/inactivity after which the app re-locks.
   * 0 = lock immediately on leaving the app (most secure).
   */
  autoLockMinutes: number;
  /** Also lock immediately whenever the app is backgrounded, regardless of autoLockMinutes. */
  lockOnBackground: boolean;
  /** Applies Android FLAG_SECURE: blocks screenshots AND screen recording (and hides app in the recents thumbnail). */
  screenshotProtectionEnabled: boolean;
  /** Has the user completed initial PIN/password + recovery-code setup? */
  isSetUp: boolean;
  failedAttempts: number;
  /** ISO timestamp; when set and in the future, PIN entry is temporarily blocked (brute-force cooldown). */
  lockedUntil: string | null;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  appLockEnabled: false,
  lockMethod: 'pin',
  biometricEnabled: false,
  autoLockMinutes: 1,
  lockOnBackground: true,
  screenshotProtectionEnabled: false,
  isSetUp: false,
  failedAttempts: 0,
  lockedUntil: null,
};

export const MAX_FAILED_ATTEMPTS = 5;
export const COOLDOWN_MINUTES_AFTER_MAX_ATTEMPTS = 5;

/** Keys used in secure storage (see secureStorage.ts) — never stored in the regular Dexie DB. */
export const SECURE_KEYS = {
  pinHash: 'security.pinHash',
  pinSalt: 'security.pinSalt',
  recoveryCodeHash: 'security.recoveryCodeHash',
  recoveryCodeSalt: 'security.recoveryCodeSalt',
} as const;
