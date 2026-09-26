/**
 * Seeds example recursive wheels once. All of this is DATA — the user can
 * delete, rename, restructure, or ignore every row. Nothing is hard-coded
 * in spin logic beyond reading options from the DB.
 */

import type { SpinWheelOption } from '../data/types';
import { spinWheelsRepo, generateId } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'spinWheelsSeeded';

function oid(): string {
  return generateId();
}

function opt(
  label: string,
  extra: Partial<SpinWheelOption> = {}
): SpinWheelOption {
  return {
    id: oid(),
    label,
    enabled: true,
    order: extra.order ?? 0,
    weight: 1,
    ...extra,
  };
}

export function seedSpinWheelsIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await spinWheelsRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }

  // --- Nested study path: Main → Study → Full-stack → Backend → 1 hour ---
  const backendLeaf = await spinWheelsRepo.create({
    name: 'Backend session',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 100,
    options: [
      opt('1 hour backend', { order: 0, durationMinutes: 60, notes: 'Focus block' }),
      opt('30 min backend', { order: 1, durationMinutes: 30 }),
      opt('2 hour deep work', { order: 2, durationMinutes: 120 }),
    ],
  });

  const fullstack = await spinWheelsRepo.create({
    name: 'Full-stack',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 101,
    options: [
      opt('Backend', { order: 0, childWheelId: backendLeaf.id }),
      opt('Frontend', { order: 1, durationMinutes: 60 }),
      opt('DevOps / deploy', { order: 2, durationMinutes: 45 }),
    ],
  });

  const study = await spinWheelsRepo.create({
    name: 'Study',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 102,
    options: [
      opt('Full-stack', { order: 0, childWheelId: fullstack.id }),
      opt('Algorithms', { order: 1, durationMinutes: 45 }),
      opt('Reading docs', { order: 2, durationMinutes: 30 }),
    ],
  });

  // --- K-drama path: Main → K-drama → Watchlist → random show → binge ---
  const binge = await spinWheelsRepo.create({
    name: 'K-drama binge length',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 110,
    options: [
      opt('1 episode', { order: 0, durationMinutes: 70 }),
      opt('2 episodes', { order: 1, durationMinutes: 140 }),
      opt('4-hour binge', { order: 2, durationMinutes: 240, notes: 'Default K-drama binge; duration editable on option & category' }),
    ],
  });

  const kWatchlist = await spinWheelsRepo.create({
    name: 'K-drama watchlist',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 111,
    options: [
      opt('Random show from list', { order: 0, childWheelId: binge.id, tags: ['random_kdrama'], notes: 'Picks from K-drama watchlist when completed' }),
      opt('Continue current drama', { order: 1, childWheelId: binge.id, tags: ['random_kdrama'] }),
    ],
  });

  const kdrama = await spinWheelsRepo.create({
    name: 'K-drama',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 112,
    options: [
      opt('Watchlist', { order: 0, childWheelId: kWatchlist.id }),
      opt('New recommendation', { order: 1, childWheelId: binge.id }),
    ],
  });

  // --- Friends path: Main → Call friend → random friend ---
  const callFriend = await spinWheelsRepo.create({
    name: 'Call friend',
    parentWheelId: null,
    isRoot: false,
    enabled: true,
    order: 120,
    notes: 'Other friends — not Naveen Anna (that is its own main option).',
    options: [
      opt('Random friend', {
        order: 0,
        durationMinutes: 30,
        availableAfterHm: '18:00',
        notes: 'Evening calls preferred',
      }),
      opt('Friend A', { order: 1, durationMinutes: 20, availableAfterHm: '18:00' }),
      opt('Friend B', { order: 2, durationMinutes: 20, availableAfterHm: '18:00' }),
    ],
  });

  // --- Root main wheel ---
  await spinWheelsRepo.create({
    name: 'Main Wheel',
    parentWheelId: null,
    isRoot: true,
    enabled: true,
    order: 0,
    notes: 'Weekend / rest-day entry wheel. Fully editable.',
    options: [
      opt('Full-stack learning', { order: 0, childWheelId: study.id }),
      opt('K-drama', { order: 1, childWheelId: kdrama.id }),
      opt('Anime', { order: 2, durationMinutes: 24 * 3, notes: '~3 episodes' }),
      opt('Watch TV', { order: 3, durationMinutes: 60 }),
      opt('Guitar', { order: 4, durationMinutes: 60 }),
      opt('Call friends', {
        order: 5,
        childWheelId: callFriend.id,
        availableAfterHm: '18:00',
      }),
      opt('Spend time with Naveen Anna', {
        order: 6,
        durationMinutes: 90,
        availableAfterHm: '18:00',
        tags: ['naveen_anna'],
        notes: 'Specifically for Naveen Anna — not other friends.',
      }),
      opt('Custom activity', { order: 7, durationMinutes: 30 }),
    ],
  });

  // Link parentWheelId for navigation clarity (optional)
  for (const [childId, parentName] of [
    [backendLeaf.id, 'Full-stack'],
    [fullstack.id, 'Study'],
    [study.id, 'Main Wheel'],
    [binge.id, 'K-drama watchlist'],
    [kWatchlist.id, 'K-drama'],
    [kdrama.id, 'Main Wheel'],
    [callFriend.id, 'Main Wheel'],
  ] as const) {
    // parent ids resolved after create — set parentWheelId by re-fetching main names is messy;
    // parentWheelId is informational; childWheelId on options drives nesting.
    void childId;
    void parentName;
  }

  await setFeatureEnabled(SEED_FLAG, true);
  });
}
