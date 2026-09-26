/**
 * Platform capability probes — never claim browser background geofencing works.
 */

import { Capacitor } from '@capacitor/core';

export type LocationCapability = {
  isNative: boolean;
  platform: string;
  /** True only on Capacitor Android/iOS builds. */
  canRequestFineLocation: boolean;
  /**
   * True background geofencing requires native Android + plugin + user
   * disabling aggressive battery optimization. Never true on pure web.
   */
  canBackgroundGeofence: boolean;
  note: string;
};

export function probeLocationCapability(): LocationCapability {
  const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
  const isNative = Capacitor.isNativePlatform();

  if (!isNative || platform === 'web') {
    return {
      isNative: false,
      platform: 'web',
      canRequestFineLocation: typeof navigator !== 'undefined' && 'geolocation' in navigator,
      canBackgroundGeofence: false,
      note:
        'Browser / WebView cannot run unrestricted background geofencing. ' +
        'Home detection works only while the app is open (foreground). ' +
        'Install the Android build for geofence + background attempts.',
    };
  }

  if (platform === 'android') {
    return {
      isNative: true,
      platform: 'android',
      canRequestFineLocation: true,
      canBackgroundGeofence: true, // attempted via native APIs; still OEM-dependent
      note:
        'Android: foreground location works with runtime permission. ' +
        'Background geofencing needs ACCESS_FINE_LOCATION, possibly ' +
        'ACCESS_BACKGROUND_LOCATION (Android 10+), and may be killed by OEM battery savers. ' +
        'Grant “Allow all the time” and disable battery optimization for reliable enter-home events.',
    };
  }

  return {
    isNative: true,
    platform,
    canRequestFineLocation: true,
    canBackgroundGeofence: false,
    note: 'iOS background geofence support is limited in this build; foreground detection is primary.',
  };
}

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
