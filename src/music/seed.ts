/**
 * Seeds empty Workout / Night playlists only — no sample audio files.
 * User must explicitly import MP3s via the file picker.
 */

import { musicPlaylistsRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'musicPlaylistsSeeded';

export function seedMusicPlaylistsIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  const existing = await musicPlaylistsRepo.list();
  if (await isFeatureEnabled(SEED_FLAG, false)) {
    if (!existing.some((p) => !p.deleted && p.systemKey === 'commute')) {
      await musicPlaylistsRepo.create({
        name: 'Commute Music',
        systemKey: 'commute',
        enabled: true,
        order: 2,
        shuffleDefault: true,
        notes: 'Morning and evening bus rides. Fresh random queue each commute.',
      });
    }
    return;
  }
  if (existing.length > 0) {
    if (!existing.some((p) => !p.deleted && p.systemKey === 'commute')) {
      await musicPlaylistsRepo.create({
        name: 'Commute Music',
        systemKey: 'commute',
        enabled: true,
        order: Math.max(-1, ...existing.map((p) => p.order)) + 1,
        shuffleDefault: true,
        notes: 'Morning and evening bus rides. Fresh random queue each commute.',
      });
    }
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }

  await musicPlaylistsRepo.create({
    name: 'Workout Music',
    systemKey: 'workout',
    enabled: true,
    order: 0,
    shuffleDefault: true,
    notes: 'Never forced to start at song #1 when shuffle is on.',
  });

  await musicPlaylistsRepo.create({
    name: 'Night Music',
    systemKey: 'night',
    enabled: true,
    order: 1,
    shuffleDefault: true,
    notes: 'Optional YES/NO prompt before play (configurable).',
  });

  await musicPlaylistsRepo.create({
    name: 'Commute Music',
    systemKey: 'commute',
    enabled: true,
    order: 2,
    shuffleDefault: true,
    notes: 'Morning and evening bus rides. Fresh random queue each commute.',
  });

  await setFeatureEnabled(SEED_FLAG, true);
});
}
