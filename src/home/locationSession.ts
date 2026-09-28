/**
 * Location session — app-level ON during arrival window, OFF after "I'm home".
 *
 * Honest limits:
 * - We cannot flip the phone's system Location master switch (OS reserved).
 * - We CAN start/stop this app's GPS polling/watch, and stop as soon as home is registered.
 * - Web: only while app is open. Android APK: better with permissions.
 */
import { getSetting, setSetting } from '../data/settings';
import { getHomeConfig } from './settings';
import {
  isMonitorRunning,
  startHomeMonitor,
  setSessionOnEnterHome,
} from './monitor';
import type { HomeArrivalConfig } from './types';

const SESSION_KEY = 'home.locationSession.v1';

export type SessionPhase =
  | 'idle' // not tracking
  | 'asking' // prompt visible: near home? / when arrive?
  | 'tracking' // monitor ON, waiting for enter-home
  | 'home' // registered home today — monitor OFF
  | 'skipped'; // user said not going home / later

export interface LocationSessionState {
  date: string;
  phase: SessionPhase;
  /** User said they'll arrive at HH:mm */
  etaHm?: string;
  /** When tracking started */
  trackingSince?: string;
  /** When home was registered */
  homeAt?: string;
  /** Prompt already shown this window */
  prompted?: boolean;
}

function empty(date: string): LocationSessionState {
  return { date, phase: 'idle' };
}

export async function getLocationSession(dateIso: string): Promise<LocationSessionState> {
  const s = await getSetting<LocationSessionState | null>(SESSION_KEY, null);
  if (!s || s.date !== dateIso) return empty(dateIso);
  return s;
}

export async function setLocationSession(
  state: LocationSessionState
): Promise<LocationSessionState> {
  await setSetting(SESSION_KEY, state);
  return state;
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** True if now is inside normal or bunk arrival window (with small early buffer). */
export function isInArrivalWindow(
  config: HomeArrivalConfig,
  now = new Date(),
  opts?: { bunk?: boolean }
): boolean {
  const win = opts?.bunk ? config.bunkArrivalWindow : config.normalArrivalWindow;
  const start = parseHm(win.start) - 30; // 30 min early buffer
  const end = parseHm(win.end) + 45; // stay open a bit after
  const m = minutesNow(now);
  // also consider evening default 16:00–21:00 if windows odd
  if (m >= start && m <= end) return true;
  // fallback evening window for college return
  if (m >= 16 * 60 && m <= 21 * 60 + 30) return true;
  return false;
}

/**
 * Start app location tracking (monitor). Does not toggle OS Location switch.
 */
export async function turnLocationTrackingOn(
  dateIso: string,
  _reason: 'near_home' | 'eta' | 'manual'
): Promise<LocationSessionState> {
  const config = await getHomeConfig();
  if (!config.home) {
    throw new Error('Set home location in Home arrival settings first');
  }
  if (!config.locationEnabled) {
    await setHomeConfigEnabled(true);
  }

  if (!isMonitorRunning()) {
    await startHomeMonitor(await getHomeConfig());
  }

  // When enter-home fires → auto OFF (does not replace HomeArrivalProvider listener)
  setSessionOnEnterHome(() => {
    void turnLocationTrackingOff(dateIso, 'arrived');
  });

  const next: LocationSessionState = {
    date: dateIso,
    phase: 'tracking',
    trackingSince: new Date().toISOString(),
    prompted: true,
  };
  return setLocationSession(next);
}

async function setHomeConfigEnabled(on: boolean): Promise<void> {
  const { setHomeConfig } = await import('./settings');
  await setHomeConfig({ locationEnabled: on });
}

/**
 * Stop app location tracking after home registered (or user skip).
 */
export async function turnLocationTrackingOff(
  dateIso: string,
  reason: 'arrived' | 'skip' | 'manual'
): Promise<LocationSessionState> {
  setSessionOnEnterHome(null);
  // Do not stopHomeMonitor if provider wants continuous config —
  // only clear session callback. User can Stop tracking explicitly.
  if (reason === 'skip' || reason === 'manual' || reason === 'arrived') {
    // leave monitor to provider; session just marks home
  }

  const prev = await getLocationSession(dateIso);
  const next: LocationSessionState = {
    ...prev,
    date: dateIso,
    phase: reason === 'arrived' ? 'home' : reason === 'skip' ? 'skipped' : 'idle',
    homeAt: reason === 'arrived' ? new Date().toISOString() : prev.homeAt,
  };
  return setLocationSession(next);
}

export async function markAsking(dateIso: string): Promise<LocationSessionState> {
  return setLocationSession({
    date: dateIso,
    phase: 'asking',
    prompted: true,
  });
}

export async function setEta(
  dateIso: string,
  etaHm: string
): Promise<LocationSessionState> {
  const next: LocationSessionState = {
    date: dateIso,
    phase: 'tracking',
    etaHm,
    trackingSince: new Date().toISOString(),
    prompted: true,
  };
  await setLocationSession(next);
  return turnLocationTrackingOn(dateIso, 'eta');
}

/** Manual "I'm home" without GPS. */
export async function registerHomeManual(dateIso: string): Promise<LocationSessionState> {
  const config = await getHomeConfig();
  const { handleHomeArrival } = await import('./arrival');
  await handleHomeArrival(config, { playSound: true });
  return turnLocationTrackingOff(dateIso, 'arrived');
}

export const ETA_OPTIONS = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
