/**
 * Initial bucket-list titles — DATA ONLY. Fully editable/deletable after seed.
 */

import { bucketListItemsRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';
import { toIsoDate } from '../routine/engine';

const SEED_FLAG = 'bucketListSeeded';

const INITIAL: { title: string; category?: string }[] = [
  { title: 'Get a new bike', category: 'gear' },
  { title: 'Get Wi-Fi', category: 'home' },
  { title: 'Get room chair', category: 'home' },
  { title: 'Learn everything about job', category: 'career' },
  { title: 'Get a job', category: 'career' },
  { title: 'Get total 200 songs you like', category: 'music' },
  { title: 'Go to Japan', category: 'travel' },
  { title: 'Get laptop skin', category: 'gear' },
  { title: 'Learn guitar', category: 'skill' },
  { title: 'Get a guitar', category: 'gear' },
  { title: 'Start a business', category: 'career' },
  { title: 'Become an extrovert', category: 'personal' },
  { title: 'Get rid of stage fear', category: 'personal' },
  { title: 'Ace skills', category: 'skill' },
  { title: 'Build healthy body', category: 'health' },
  { title: 'Do room setup', category: 'home' },
  { title: 'Talk English fluently with others', category: 'skill' },
  { title: 'Get a diary', category: 'gear' },
  { title: 'Get checked by dermatologist', category: 'health' },
  { title: 'Get a mouse', category: 'gear' },
  { title: 'Get RGB mouse pad', category: 'gear' },
  { title: 'Get RGB keyboard', category: 'gear' },
  { title: 'Get cooler and blue-ray glasses', category: 'gear' },
  { title: 'Get laptop bag', category: 'gear' },
  { title: 'Get laptop stand', category: 'gear' },
  { title: 'Get AirPods Mustang', category: 'gear' },
];

export function seedBucketListIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await bucketListItemsRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }
  const today = toIsoDate(new Date());
  let order = 0;
  for (const item of INITIAL) {
    await bucketListItemsRepo.create({
      title: item.title,
      category: item.category,
      status: 'planned',
      createdDate: today,
      order: order++,
    });
  }
  await setFeatureEnabled(SEED_FLAG, true);
});
}
