import { achievementDefsRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'achievementsSeeded';

const DEFAULTS: {
  key: string;
  title: string;
  description: string;
  metric: string;
  threshold: number;
  xpReward: number;
  icon?: string;
}[] = [
  {
    key: 'first_workout',
    title: 'First Workout',
    description: 'Complete your first workout session.',
    metric: 'workout_completed',
    threshold: 1,
    xpReward: 50,
    icon: '💪',
  },
  {
    key: 'guitar_10h',
    title: '10 Guitar Hours',
    description: 'Log 600 minutes of guitar practice.',
    metric: 'guitar_minutes',
    threshold: 600,
    xpReward: 120,
    icon: '🎸',
  },
  {
    key: 'college_50',
    title: '50 College Days',
    description: 'Log 50 college day statuses.',
    metric: 'college_days',
    threshold: 50,
    xpReward: 100,
    icon: '🏫',
  },
  {
    key: 'social_100',
    title: '100 Social Records',
    description: 'Log 100 social interactions.',
    metric: 'social_records',
    threshold: 100,
    xpReward: 100,
    icon: '💬',
  },
  {
    key: 'bucket_first',
    title: 'First Bucket List Completion',
    description: 'Mark your first bucket-list item done.',
    metric: 'bucket_done',
    threshold: 1,
    xpReward: 80,
    icon: '✨',
  },
];

export function seedAchievementsIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await achievementDefsRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }
  let order = 0;
  for (const d of DEFAULTS) {
    await achievementDefsRepo.create({
      ...d,
      enabled: true,
      order: order++,
    });
  }
  await setFeatureEnabled(SEED_FLAG, true);
});
}
