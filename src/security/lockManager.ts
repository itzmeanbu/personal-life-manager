import { getSetting, setSetting } from '../data/settings';
import { secureGet, secureSet, secureClear } from './secureStorage';
import { generateSalt, hashSecret, safeEqual, generateRecoveryCode } from './crypto';
import {
  DEFAULT_SECURITY_CONFIG,
  MAX_FAILED_ATTEMPTS,
  COOLDOWN_MINUTES_AFTER_MAX_ATTEMPTS,
  SECURE_KEYS,
  type SecurityConfig,
} from './types';

const CONFIG_KEY = 'security.config';

export async function getSecurityConfig(): Promise<SecurityConfig> {
  return getSetting<SecurityConfig>(CONFIG_KEY, DEFAULT_SECURITY_CONFIG);
}

async function saveSecurityConfig(patch: Partial<SecurityConfig>): Promise<SecurityConfig> {
  const current = await getSecurityConfig();
  const next = { ...current, ...patch };
  await setSetting(CONFIG_KEY, next);
  return next;
}

/**
 * First-time setup: stores a hashed PIN/password (never plaintext) and
 * generates a one-time recovery code, also stored only as a hash. The
 * caller MUST show `recoveryCode` to the user once — it cannot be
 * retrieved again afterwards, by design (same guarantee as the PIN).
 */
export async function setupLock(
  secret: string,
  method: SecurityConfig['lockMethod']
): Promise<{ recoveryCode: string }> {
  const salt = generateSalt();
  const hash = await hashSecret(secret, salt);
  await secureSet(SECURE_KEYS.pinSalt, salt);
  await secureSet(SECURE_KEYS.pinHash, hash);

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = generateSalt();
  const recoveryHash = await hashSecret(recoveryCode, recoverySalt);
  await secureSet(SECURE_KEYS.recoveryCodeSalt, recoverySalt);
  await secureSet(SECURE_KEYS.recoveryCodeHash, recoveryHash);

  await saveSecurityConfig({
    appLockEnabled: true,
    lockMethod: method,
    isSetUp: true,
    failedAttempts: 0,
    lockedUntil: null,
  });

  return { recoveryCode };
}

export interface VerifyResult {
  success: boolean;
  locked: boolean;
  lockedUntil: string | null;
  attemptsRemaining: number;
}

export async function verifySecret(secret: string): Promise<VerifyResult> {
  const config = await getSecurityConfig();

  if (config.lockedUntil && new Date(config.lockedUntil) > new Date()) {
    return {
      success: false,
      locked: true,
      lockedUntil: config.lockedUntil,
      attemptsRemaining: 0,
    };
  }

  const salt = await secureGet(SECURE_KEYS.pinSalt);
  const storedHash = await secureGet(SECURE_KEYS.pinHash);
  if (!salt || !storedHash) {
    return { success: false, locked: false, lockedUntil: null, attemptsRemaining: 0 };
  }

  const candidateHash = await hashSecret(secret, salt);
  const success = safeEqual(candidateHash, storedHash);

  if (success) {
    await saveSecurityConfig({ failedAttempts: 0, lockedUntil: null });
    return { success: true, locked: false, lockedUntil: null, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  const failedAttempts = config.failedAttempts + 1;
  const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
  let lockedUntil: string | null = null;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + COOLDOWN_MINUTES_AFTER_MAX_ATTEMPTS * 60_000).toISOString();
  }
  await saveSecurityConfig({ failedAttempts, lockedUntil });

  return { success: false, locked: Boolean(lockedUntil), lockedUntil, attemptsRemaining };
}

/** Verifies the recovery code and, if valid, lets the caller set a new PIN/password. */
export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const salt = await secureGet(SECURE_KEYS.recoveryCodeSalt);
  const storedHash = await secureGet(SECURE_KEYS.recoveryCodeHash);
  if (!salt || !storedHash) return false;
  const candidateHash = await hashSecret(code.trim().toUpperCase(), salt);
  return safeEqual(candidateHash, storedHash);
}

/** Resets the PIN/password after a successful recovery-code verification. A new recovery code is issued. */
export async function resetSecretAfterRecovery(
  newSecret: string
): Promise<{ recoveryCode: string }> {
  const salt = generateSalt();
  const hash = await hashSecret(newSecret, salt);
  await secureSet(SECURE_KEYS.pinSalt, salt);
  await secureSet(SECURE_KEYS.pinHash, hash);

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = generateSalt();
  const recoveryHash = await hashSecret(recoveryCode, recoverySalt);
  await secureSet(SECURE_KEYS.recoveryCodeSalt, recoverySalt);
  await secureSet(SECURE_KEYS.recoveryCodeHash, recoveryHash);

  await saveSecurityConfig({ failedAttempts: 0, lockedUntil: null });
  return { recoveryCode };
}

/** Turns app lock off entirely and wipes stored secrets. Requires prior successful verification by the caller. */
export async function disableLock(): Promise<void> {
  await secureClear([
    SECURE_KEYS.pinHash,
    SECURE_KEYS.pinSalt,
    SECURE_KEYS.recoveryCodeHash,
    SECURE_KEYS.recoveryCodeSalt,
  ]);
  await saveSecurityConfig({
    ...DEFAULT_SECURITY_CONFIG,
  });
}

export async function updateSecurityConfig(patch: Partial<SecurityConfig>): Promise<SecurityConfig> {
  return saveSecurityConfig(patch);
}
