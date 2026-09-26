/**
 * Home-arrival automation config — fully editable, Android-first.
 *
 * True background geofencing only works on native Android with proper
 * permissions + OEM battery exceptions. Browser/WebView cannot provide
 * unrestricted background location; the engine degrades honestly.
 */

export interface HomeLocation {
  /** Human label, e.g. "Home". */
  label: string;
  latitude: number;
  longitude: number;
  /** Geofence radius in meters (default 120). */
  radiusMeters: number;
}

export interface HomeArrivalConfig {
  /** Master switch for location-based home detection. */
  locationEnabled: boolean;
  /** Attempt native geofence when running on Android Capacitor. */
  geofenceEnabled: boolean;
  /** Play configurable sound on arrival. */
  homeSoundEnabled: boolean;
  /** Sound id / filename key (mapped in assets or system tone). */
  homeSoundId: string;
  /** After arrival, wait this many minutes before workout reminder. */
  postArrivalDelayMinutes: number;
  /** Auto workout reminder / cancel rules. */
  workoutAutomationEnabled: boolean;
  /** If true, arriving after lateArrivalCutoff cancels today's workout. */
  lateArrivalRuleEnabled: boolean;
  /**
   * "HH:mm" local — arrival after this triggers late-arrival cancel.
   * Default 19:30.
   */
  lateArrivalCutoff: string;
  /**
   * Up to 3 configurable possible workout start times ("HH:mm").
   * Examples only in seed: 19:30, 20:00, 21:00.
   */
  workoutTimes: string[];
  /** Allow user to manually start workout even after auto-cancel. */
  allowManualOverrideAfterLateCancel: boolean;
  home: HomeLocation | null;
  /**
   * Expected arrival windows (informational + used for UI hints).
   * Normal college day vs bunk day — times are editable.
   */
  normalArrivalWindow: { start: string; end: string };
  bunkArrivalWindow: { start: string; end: string };
}

export type ArrivalEventKind = 'enter_home' | 'leave_home';

export interface ArrivalEvent {
  id: string;
  kind: ArrivalEventKind;
  at: string; // ISO
  source: 'geofence' | 'manual' | 'foreground_poll';
  latitude?: number;
  longitude?: number;
}

export interface HomeArrivalRuntimeState {
  /** Whether native geolocation plugin is available. */
  nativeLocationAvailable: boolean;
  /** Whether we believe we are currently inside the home geofence. */
  insideHome: boolean | null;
  lastEvent: ArrivalEvent | null;
  /** Welcome-home banner active until dismissed or delay completes. */
  welcomeVisible: boolean;
  /** ISO time when post-arrival delay ends and workout prompt may show. */
  workoutPromptAt: string | null;
  /** Late-arrival auto-cancel already applied for this local date. */
  lateCancelAppliedDate: string | null;
  /** Platform capability note for UI honesty. */
  capabilityNote: string;
}

export const HOME_CONFIG_KEY = 'home.arrivalConfig';
export const HOME_RUNTIME_KEY = 'home.arrivalRuntime';

export const DEFAULT_HOME_CONFIG: HomeArrivalConfig = {
  locationEnabled: false,
  geofenceEnabled: false,
  homeSoundEnabled: false,
  homeSoundId: 'im_home',
  postArrivalDelayMinutes: 15,
  workoutAutomationEnabled: true,
  lateArrivalRuleEnabled: true,
  lateArrivalCutoff: '19:30',
  workoutTimes: ['19:30', '20:00', '21:00'],
  allowManualOverrideAfterLateCancel: true,
  home: null,
  normalArrivalWindow: { start: '19:00', end: '19:30' },
  bunkArrivalWindow: { start: '16:30', end: '18:00' },
};
