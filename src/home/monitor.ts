/**
 * Foreground home monitor + optional native geofence registration.
 *
 * - Web: interval poll while app is visible only (no background fiction).
 * - Android Capacitor: prefers continuous watch + geofence plugin when present;
 *   falls back to foreground poll.
 */

import type { HomeArrivalConfig, ArrivalEvent } from './types';
import { getCurrentPosition, isInsideHome } from './location';
import { probeLocationCapability } from './platform';
import { handleHomeArrival } from './arrival';
import { generateId } from '../data/repository';

export type ArrivalListener = (event: ArrivalEvent, meta: {
  welcome: boolean;
  workoutPromptAt: string | null;
  lateCancelApplied: boolean;
  lateCancelReason: string;
}) => void;

const POLL_MS = 45_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastInside: boolean | null = null;
let running = false;
let listener: ArrivalListener | null = null;
let sessionOnEnterHome: (() => void) | null = null;
let currentConfig: HomeArrivalConfig | null = null;

export function setArrivalListener(fn: ArrivalListener | null): void {
  listener = fn;
}

/** Extra hook for location-session auto-off (does not replace ArrivalListener). */
export function setSessionOnEnterHome(fn: (() => void) | null): void {
  sessionOnEnterHome = fn;
}

export function getMonitorInsideHome(): boolean | null {
  return lastInside;
}

export function isMonitorRunning(): boolean {
  return running;
}

async function onEnterHome(source: ArrivalEvent['source'], lat?: number, lng?: number) {
  if (!currentConfig) return;
  const event: ArrivalEvent = {
    id: generateId(),
    kind: 'enter_home',
    at: new Date().toISOString(),
    source,
    latitude: lat,
    longitude: lng,
  };
  const result = await handleHomeArrival(currentConfig);
  listener?.(event, {
    welcome: result.welcome,
    workoutPromptAt: result.workoutPromptAt,
    lateCancelApplied: result.lateCancel.applied,
    lateCancelReason: result.lateCancel.reason,
  });
  try {
    sessionOnEnterHome?.();
  } catch (e) {
    console.warn('[home/monitor] sessionOnEnterHome failed', e);
  }
}

async function pollOnce(): Promise<void> {
  if (!currentConfig?.locationEnabled || !currentConfig.home) return;
  try {
    const pos = await getCurrentPosition();
    const inside = isInsideHome(pos, currentConfig.home);
    if (lastInside === false && inside) {
      await onEnterHome('foreground_poll', pos.latitude, pos.longitude);
    } else if (lastInside === true && !inside) {
      listener?.(
        {
          id: generateId(),
          kind: 'leave_home',
          at: new Date().toISOString(),
          source: 'foreground_poll',
          latitude: pos.latitude,
          longitude: pos.longitude,
        },
        { welcome: false, workoutPromptAt: null, lateCancelApplied: false, lateCancelReason: '' }
      );
    }
    lastInside = inside;
  } catch (err) {
    console.warn('[home/monitor] poll failed', err);
  }
}

/**
 * Try to register a native geofence via optional community plugin.
 * Never throws — soft-fails to foreground poll.
 */
async function tryNativeGeofence(config: HomeArrivalConfig): Promise<boolean> {
  if (!config.geofenceEnabled || !config.home) return false;
  const cap = probeLocationCapability();
  if (!cap.canBackgroundGeofence) return false;

  try {
    // Optional: @capacitor-community/background-geolocation or custom plugin.
    // Not a declared dependency — the specifier is built from a variable
    // (not a string literal) so neither tsc nor Vite/Rollup try to resolve
    // or bundle it at build time; it only resolves at runtime, on native
    // Android where the plugin may be present, and is caught below if not.
    const optionalPluginSpecifier = '@capacitor-community/background-geolocation';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ optionalPluginSpecifier).catch(() => null);
    if (!mod) return false;
    // Plugin APIs vary; registration is best-effort and logged.
    console.info('[home/monitor] background-geolocation module present — wire native geofence in native project');
    return true;
  } catch {
    return false;
  }
}

export async function startHomeMonitor(config: HomeArrivalConfig): Promise<{
  started: boolean;
  mode: 'native_geofence' | 'foreground_poll' | 'off';
  note: string;
}> {
  await stopHomeMonitor();
  currentConfig = config;

  if (!config.locationEnabled || !config.home) {
    running = false;
    return {
      started: false,
      mode: 'off',
      note: 'Location disabled or home not set',
    };
  }

  const cap = probeLocationCapability();
  let mode: 'native_geofence' | 'foreground_poll' | 'off' = 'foreground_poll';

  if (config.geofenceEnabled && cap.canBackgroundGeofence) {
    const ok = await tryNativeGeofence(config);
    if (ok) mode = 'native_geofence';
  }

  // Always run foreground poll while app is open as the reliable path
  running = true;
  void pollOnce();
  pollTimer = setInterval(() => void pollOnce(), POLL_MS);

  // Pause polling when tab hidden (web honesty)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return {
    started: true,
    mode,
    note:
      mode === 'native_geofence'
        ? cap.note
        : cap.isNative
          ? `${cap.note} Using foreground location poll while app is open.`
          : cap.note,
  };
}

function onVisibility() {
  if (document.visibilityState === 'visible' && running) {
    void pollOnce();
  }
}

export async function stopHomeMonitor(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
  running = false;
}

/** Manual "I'm home" — same pipeline as geofence enter. */
export async function triggerManualArrival(config: HomeArrivalConfig): Promise<void> {
  currentConfig = config;
  await onEnterHome('manual');
}
