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
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await musicPlaylistsRepo.list();
  if (existing.length > 0) {
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

  await setFeatureEnabled(SEED_FLAG, true);
});
}
