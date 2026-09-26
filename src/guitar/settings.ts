import { getSetting, setSetting } from '../data/settings';

export interface GuitarConfig {
  enabled: boolean;
  /** Default planned session length (minutes). Fully editable. */
  defaultDurationMinutes: number;
  /** Optional daily reminder time "HH:mm"; empty = off. */
  reminderTime: string;
  reminderEnabled: boolean;
  /** Optional focus tags the UI can suggest. */
  focusPresets: string[];
}

export const GUITAR_CONFIG_KEY = 'guitar.config';

export const DEFAULT_GUITAR_CONFIG: GuitarConfig = {
  enabled: true,
  defaultDurationMinutes: 60,
  reminderTime: '20:00',
  reminderEnabled: false,
  focusPresets: ['scales', 'song practice', 'technique', 'improv', 'theory'],
};

export async function getGuitarConfig(): Promise<GuitarConfig> {
  const stored = await getSetting<Partial<GuitarConfig> | null>(GUITAR_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_GUITAR_CONFIG };
  return {
    ...DEFAULT_GUITAR_CONFIG,
    ...stored,
    focusPresets: stored.focusPresets ?? DEFAULT_GUITAR_CONFIG.focusPresets,
  };
}

export async function setGuitarConfig(patch: Partial<GuitarConfig>): Promise<GuitarConfig> {
  const current = await getGuitarConfig();
  const next = { ...current, ...patch };
  await setSetting(GUITAR_CONFIG_KEY, next);
  return next;
}
