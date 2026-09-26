import { getSetting, setSetting } from '../data/settings';

export interface GamificationConfig {
  enabled: boolean;
  xpEnabled: boolean;
  streaksEnabled: boolean;
  achievementsEnabled: boolean;
  badgesEnabled: boolean;
  statsEnabled: boolean;
  completionEnabled: boolean;
  /** XP weights per event type — editable */
  xpWeights: {
    workoutCompleted: number;
    guitarMinutes: number; // per minute
    learningMinutes: number;
    routineDone: number;
    collegeDay: number;
    socialRecord: number;
    bucketDone: number;
    sleepLogged: number;
  };
}

export const GAMIFICATION_CONFIG_KEY = 'gamification.config';

export const DEFAULT_GAMIFICATION_CONFIG: GamificationConfig = {
  enabled: true,
  xpEnabled: true,
  streaksEnabled: true,
  achievementsEnabled: true,
  badgesEnabled: true,
  statsEnabled: true,
  completionEnabled: true,
  xpWeights: {
    workoutCompleted: 50,
    guitarMinutes: 1,
    learningMinutes: 1,
    routineDone: 10,
    collegeDay: 15,
    socialRecord: 8,
    bucketDone: 40,
    sleepLogged: 12,
  },
};

export async function getGamificationConfig(): Promise<GamificationConfig> {
  const stored = await getSetting<Partial<GamificationConfig> | null>(
    GAMIFICATION_CONFIG_KEY,
    null
  );
  if (!stored) return { ...DEFAULT_GAMIFICATION_CONFIG };
  return {
    ...DEFAULT_GAMIFICATION_CONFIG,
    ...stored,
    xpWeights: { ...DEFAULT_GAMIFICATION_CONFIG.xpWeights, ...(stored.xpWeights ?? {}) },
  };
}

export async function setGamificationConfig(
  patch: Partial<GamificationConfig>
): Promise<GamificationConfig> {
  const current = await getGamificationConfig();
  const next = {
    ...current,
    ...patch,
    xpWeights: { ...current.xpWeights, ...(patch.xpWeights ?? {}) },
  };
  await setSetting(GAMIFICATION_CONFIG_KEY, next);
  return next;
}
