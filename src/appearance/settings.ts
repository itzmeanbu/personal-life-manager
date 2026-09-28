import { getSetting, setSetting } from '../data/settings';

export interface AppearanceConfig {
  accentColor: string;
  colorMode: 'dark' | 'light';
  dailyBackgroundEnabled: boolean;
  randomBackgroundEnabled: boolean;
  specialDayBackgroundEnabled: boolean;
  fixedBackgroundKey: string | null;
  customLogoBlobKey: string | null;
  backgroundHistory: string[];
  todayBackgroundKey: string | null;
  todayBackgroundDate: string | null;
  /** Use the 15 built-in scenes when no photos are imported (or always, if forced). */
  builtinBackgroundsEnabled: boolean;
  forceBuiltinBackgrounds: boolean;
  lastBuiltinId: string | null;
  todayBuiltinId: string | null;
  /** Adapt accent + card tint to the current background. */
  adaptiveColors: boolean;
}

export const APPEARANCE_CONFIG_KEY = 'appearance.config';

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  accentColor: '',
  colorMode: 'dark',
  dailyBackgroundEnabled: true,
  randomBackgroundEnabled: true,
  specialDayBackgroundEnabled: true,
  fixedBackgroundKey: null,
  customLogoBlobKey: null,
  backgroundHistory: [],
  todayBackgroundKey: null,
  todayBackgroundDate: null,
  builtinBackgroundsEnabled: true,
  forceBuiltinBackgrounds: false,
  lastBuiltinId: null,
  todayBuiltinId: null,
  adaptiveColors: true,
};

export async function getAppearanceConfig(): Promise<AppearanceConfig> {
  const s = await getSetting<Partial<AppearanceConfig> | null>(APPEARANCE_CONFIG_KEY, null);
  if (!s) return { ...DEFAULT_APPEARANCE };
  return {
    ...DEFAULT_APPEARANCE,
    ...s,
    backgroundHistory: s.backgroundHistory ?? [],
  };
}

export async function setAppearanceConfig(
  patch: Partial<AppearanceConfig>
): Promise<AppearanceConfig> {
  const current = await getAppearanceConfig();
  const next = { ...current, ...patch };
  await setSetting(APPEARANCE_CONFIG_KEY, next);
  return next;
}

export const MEDIA_KEYS = {
  background: (id: string) => `media/backgrounds/${id}`,
  logo: (id: string) => `media/logos/${id}`,
  development: (id: string) => `media/development/${id}`,
  thumb: (key: string) => `media/thumbs/${key.replace(/\//g, '_')}`,
} as const;
