import { getSetting, setSetting } from '../data/settings';

/** Global entertainment prefs — binge defaults also live per-category. */
export interface EntertainmentConfig {
  /** Fallback binge minutes when category has none (default 4h for drama-style). */
  defaultBingeMinutes: number;
  /** When spinning “random from watchlist”, only unwatched items. */
  randomPreferUnwatched: boolean;
}

export const ENTERTAINMENT_CONFIG_KEY = 'entertainment.config';

export const DEFAULT_ENTERTAINMENT_CONFIG: EntertainmentConfig = {
  defaultBingeMinutes: 240, // 4 hours — editable, not a hard-coded show list
  randomPreferUnwatched: true,
};

export async function getEntertainmentConfig(): Promise<EntertainmentConfig> {
  const stored = await getSetting<Partial<EntertainmentConfig> | null>(
    ENTERTAINMENT_CONFIG_KEY,
    null
  );
  if (!stored) return { ...DEFAULT_ENTERTAINMENT_CONFIG };
  return { ...DEFAULT_ENTERTAINMENT_CONFIG, ...stored };
}

export async function setEntertainmentConfig(
  patch: Partial<EntertainmentConfig>
): Promise<EntertainmentConfig> {
  const current = await getEntertainmentConfig();
  const next = { ...current, ...patch };
  await setSetting(ENTERTAINMENT_CONFIG_KEY, next);
  return next;
}
