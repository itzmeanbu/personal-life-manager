/**
 * Adds two playlists for travel: English and Tamil.
 * Separate from the original seed so existing installs get them too.
 * No audio is bundled; the user imports their own folders/files.
 */
import { musicPlaylistsRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const FLAG = 'musicTravelPlaylistsSeeded_v1';

export function seedDayBriefMusicIfNeeded(): Promise<void> {
  return runSeedOnce(FLAG, async () => {
    if (await isFeatureEnabled(FLAG, false)) return;
    const all = (await musicPlaylistsRepo.list()).filter((p) => !p.deleted);
    let order = all.reduce((m, p) => Math.max(m, p.order), -1);

    if (!all.some((p) => p.systemKey === 'english' || /^english/i.test(p.name))) {
      await musicPlaylistsRepo.create({
        name: 'English Songs',
        systemKey: 'english',
        enabled: true,
        order: ++order,
        shuffleDefault: true,
        notes: 'Travel music. Import your English songs here.',
      });
    }
    if (!all.some((p) => p.systemKey === 'tamil' || /^tamil/i.test(p.name))) {
      await musicPlaylistsRepo.create({
        name: 'Tamil Songs',
        systemKey: 'tamil',
        enabled: true,
        order: ++order,
        shuffleDefault: true,
        notes: 'Travel music. Import your Tamil songs here.',
      });
    }
    await setFeatureEnabled(FLAG, true);
  });
}
