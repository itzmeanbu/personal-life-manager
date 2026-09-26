import { getSetting, setSetting } from '../data/settings';
import {
  DEFAULT_HOME_CONFIG,
  HOME_CONFIG_KEY,
  type HomeArrivalConfig,
  type HomeLocation,
} from './types';

export async function getHomeConfig(): Promise<HomeArrivalConfig> {
  const stored = await getSetting<Partial<HomeArrivalConfig> | null>(HOME_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_HOME_CONFIG };
  return {
    ...DEFAULT_HOME_CONFIG,
    ...stored,
    workoutTimes: (stored.workoutTimes ?? DEFAULT_HOME_CONFIG.workoutTimes).slice(0, 3),
    home: stored.home ?? null,
    normalArrivalWindow: {
      ...DEFAULT_HOME_CONFIG.normalArrivalWindow,
      ...(stored.normalArrivalWindow ?? {}),
    },
    bunkArrivalWindow: {
      ...DEFAULT_HOME_CONFIG.bunkArrivalWindow,
      ...(stored.bunkArrivalWindow ?? {}),
    },
  };
}

export async function setHomeConfig(patch: Partial<HomeArrivalConfig>): Promise<HomeArrivalConfig> {
  const current = await getHomeConfig();
  const next: HomeArrivalConfig = {
    ...current,
    ...patch,
    workoutTimes: (patch.workoutTimes ?? current.workoutTimes).slice(0, 3),
    home:
      patch.home === undefined
        ? current.home
        : patch.home
          ? { ...current.home, ...patch.home } as HomeLocation
          : null,
    normalArrivalWindow: patch.normalArrivalWindow
      ? { ...current.normalArrivalWindow, ...patch.normalArrivalWindow }
      : current.normalArrivalWindow,
    bunkArrivalWindow: patch.bunkArrivalWindow
      ? { ...current.bunkArrivalWindow, ...patch.bunkArrivalWindow }
      : current.bunkArrivalWindow,
  };
  await setSetting(HOME_CONFIG_KEY, next);
  return next;
}

export async function setHomeLocation(loc: HomeLocation | null): Promise<HomeArrivalConfig> {
  return setHomeConfig({ home: loc });
}
