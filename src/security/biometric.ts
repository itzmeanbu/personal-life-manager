import { Capacitor } from '@capacitor/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

/**
 * Real biometric auth via Android's native BiometricPrompt (through the
 * `capacitor-native-biometric` plugin). BiometricPrompt itself is what
 * decides whether fingerprint, face, or iris is used — that is a device/OS
 * decision we don't (and can't) fake at the app layer. If the device has
 * no enrolled biometric, `isAvailable()` returns false and the app simply
 * does not offer the biometric button — it always falls back to the app's
 * own PIN/password, never to a simulated "always succeeds" check.
 *
 * "Pattern": Android's BiometricPrompt device-credential fallback
 * (`allowDeviceCredential`) lets the OS accept the device's own PIN,
 * pattern, or password as set up in Android Settings, whichever the user
 * configured at the OS level — this is how "pattern support" is honored
 * without the app reimplementing pattern UI itself, which would just be a
 * second layer this task doesn't ask for and Android already handles.
 */

export interface BiometricAvailability {
  available: boolean;
  biometryType: BiometryType | null;
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, biometryType: null };
  }
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    return { available: result.isAvailable, biometryType: result.biometryType ?? null };
  } catch {
    return { available: false, biometryType: null };
  }
}

/**
 * Prompts the OS biometric UI. Resolves true only on a genuine OS-level
 * success; any error/cancel/failure resolves false. There is no code path
 * here that returns true without the platform having verified the user.
 */
export async function verifyBiometric(reason: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Unlock',
      subtitle: reason,
      // Lets Android's own device-credential (PIN/pattern/password) act as
      // the OS-level fallback when biometrics fail/are unavailable, instead
      // of the app inventing its own fake biometric check.
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}
