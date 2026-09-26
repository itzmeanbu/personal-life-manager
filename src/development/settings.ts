import { getSetting, setSetting } from '../data/settings';

/** Category labels only — not missions or scores. */
export interface DevelopmentConfig {
  categoryPresets: string[];
}

export const DEVELOPMENT_CONFIG_KEY = 'development.config';

export const DEFAULT_DEVELOPMENT_CONFIG: DevelopmentConfig = {
  categoryPresets: [
    'overcame stage fear',
    'talked to someone new',
    'spoke English with someone',
    'custom',
  ],
};

export async function getDevelopmentConfig(): Promise<DevelopmentConfig> {
  const stored = await getSetting<Partial<DevelopmentConfig> | null>(
    DEVELOPMENT_CONFIG_KEY,
    null
  );
  if (!stored) return { ...DEFAULT_DEVELOPMENT_CONFIG };
  return {
    categoryPresets: stored.categoryPresets ?? DEFAULT_DEVELOPMENT_CONFIG.categoryPresets,
  };
}

export async function setDevelopmentConfig(
  patch: Partial<DevelopmentConfig>
): Promise<DevelopmentConfig> {
  const current = await getDevelopmentConfig();
  const next = { ...current, ...patch };
  await setSetting(DEVELOPMENT_CONFIG_KEY, next);
  return next;
}
