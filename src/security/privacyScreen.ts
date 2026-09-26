import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

/**
 * Screenshot & screen-recording protection.
 *
 * On Android, `@capacitor-community/privacy-screen` sets the window's
 * FLAG_SECURE, which simultaneously:
 *  - blocks screenshots (the OS refuses to capture the window content),
 *  - blocks screen recording of that window,
 *  - blanks the app's thumbnail in the Recents/app-switcher view.
 * There is no separate Android API for "screenshot" vs "screen recording"
 * protection — FLAG_SECURE is the single mechanism that covers both, which
 * is why one plugin/toggle handles both requirements.
 *
 * iOS/web have no equivalent OS-level flag, so this is Android-only by
 * platform capability, not by choice — see docs/SECURITY.md ("Limitations").
 */

export async function setScreenshotProtection(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // no-op on web preview
  try {
    if (enabled) {
      await PrivacyScreen.enable();
    } else {
      await PrivacyScreen.disable();
    }
  } catch {
    // Plugin not present on this build (e.g. web-only dev run) — safe no-op.
  }
}
