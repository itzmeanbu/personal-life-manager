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

  // Bus phases: two separate files (playlists). App picks a random playlist
  // then a random song each day — never forced sequential 1→2→3.
  await musicPlaylistsRepo.create({
    name: 'Bus English',
    systemKey: 'bus_english',
    enabled: true,
    order: 2,
    shuffleDefault: true,
    notes: 'Morning/evening bus — English tracks. Import MP3s; every ride picks a random song (not line-by-line order).',
  });

  await musicPlaylistsRepo.create({
    name: 'Bus Tamil',
    systemKey: 'bus_tamil',
    enabled: true,
    order: 3,
    shuffleDefault: true,
    notes: 'Morning/evening bus — Tamil tracks. Import MP3s; random song each day, random playlist mix with English.',
  });

  await setFeatureEnabled(SEED_FLAG, true);
});
}

/** One-time: add Bus English / Bus Tamil playlists if missing (existing installs). */
export async function ensureBusPlaylistsExist(): Promise<void> {
  const all = await musicPlaylistsRepo.list();
  const keys = new Set(all.filter((p) => !p.deleted).map((p) => p.systemKey));
  if (!keys.has('bus_english')) {
    await musicPlaylistsRepo.create({
      name: 'Bus English',
      systemKey: 'bus_english',
      enabled: true,
      order: 2,
      shuffleDefault: true,
      notes: 'Morning/evening bus — English tracks. Random song each ride.',
    });
  }
  if (!keys.has('bus_tamil')) {
    await musicPlaylistsRepo.create({
      name: 'Bus Tamil',
      systemKey: 'bus_tamil',
      enabled: true,
      order: 3,
      shuffleDefault: true,
      notes: 'Morning/evening bus — Tamil tracks. Random song each ride.',
    });
  }
}
