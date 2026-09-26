import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

/**
 * Secure storage for security-critical secrets ONLY (PIN hash/salt,
 * recovery-code hash/salt). Everything else in the app (routines, tasks,
 * etc.) stays in the regular Dexie/IndexedDB database — see
 * src/data/db.ts — which is fine for non-sensitive app data but is NOT
 * used here.
 *
 * - On Android (native build): backed by `@aparajita/capacitor-secure-storage`,
 *   which on Android stores values in EncryptedSharedPreferences, itself
 *   protected by a key in the Android Keystore (hardware-backed on most
 *   devices). This satisfies "secure credentials" / "secure local storage"
 *   for the actual secret material.
 * - On web preview (no native layer): there is no OS keystore to bind to.
 *   We fall back to localStorage. This is a real limitation — see
 *   docs/SECURITY.md ("Limitations") — the web preview build is not
 *   intended to be the secure target; the Android app is.
 */

const isNative = Capacitor.isNativePlatform();

export async function secureSet(key: string, value: string): Promise<void> {
  if (isNative) {
    await SecureStorage.set(key, value);
  } else {
    localStorage.setItem(key, value);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  if (isNative) {
    try {
      const value = await SecureStorage.get(key);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }
  return localStorage.getItem(key);
}

export async function secureRemove(key: string): Promise<void> {
  if (isNative) {
    try {
      await SecureStorage.remove(key);
    } catch {
      /* key may not exist — fine */
    }
  } else {
    localStorage.removeItem(key);
  }
}

export async function secureClear(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => secureRemove(k)));
}
