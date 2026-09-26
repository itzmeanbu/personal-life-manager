import { getSetting, setSetting } from '../data/settings';

export interface LearningConfig {
  mainGoal: string;
  categories: string[];
  defaultDurationMinutes: number;
}

export const LEARNING_CONFIG_KEY = 'learning.config';

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  mainGoal: 'FULL-STACK DEVELOPMENT',
  categories: [
    'Frontend',
    'Backend',
    'Database',
    'REST APIs',
    'Authentication',
    'Git/GitHub',
    'Deployment',
    'Testing',
    'DevOps',
    'Other',
  ],
  defaultDurationMinutes: 60,
};

export async function getLearningConfig(): Promise<LearningConfig> {
  const stored = await getSetting<Partial<LearningConfig> | null>(LEARNING_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_LEARNING_CONFIG };
  return {
    ...DEFAULT_LEARNING_CONFIG,
    ...stored,
    categories: stored.categories ?? DEFAULT_LEARNING_CONFIG.categories,
  };
}

export async function setLearningConfig(patch: Partial<LearningConfig>): Promise<LearningConfig> {
  const current = await getLearningConfig();
  const next = { ...current, ...patch };
  await setSetting(LEARNING_CONFIG_KEY, next);
  return next;
}
