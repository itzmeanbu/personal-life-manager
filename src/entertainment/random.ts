/**
 * Random watchlist selection for UI + spin-wheel integration.
 * Never invents titles — only picks from stored WatchlistItem rows.
 */

import type { EntertainmentCategory, WatchlistItem } from '../data/types';
import { watchlistItemsRepo, entertainmentCategoriesRepo } from '../data/repository';
import { getEntertainmentConfig } from './settings';

export interface RandomWatchlistPick {
  item: WatchlistItem;
  category: EntertainmentCategory | null;
  /** Effective binge/session minutes for this pick. */
  bingeMinutes: number;
}

export async function pickRandomFromWatchlist(opts?: {
  categoryId?: string;
  systemKey?: EntertainmentCategory['systemKey'];
  unwatchedOnly?: boolean;
}): Promise<RandomWatchlistPick | null> {
  const config = await getEntertainmentConfig();
  const categories = (await entertainmentCategoriesRepo.list()).filter(
    (c) => !c.deleted && c.enabled
  );
  let category: EntertainmentCategory | null = null;
  if (opts?.categoryId) {
    category = categories.find((c) => c.id === opts.categoryId) ?? null;
  } else if (opts?.systemKey) {
    category = categories.find((c) => c.systemKey === opts.systemKey) ?? null;
  }

  let items = (await watchlistItemsRepo.list()).filter((i) => !i.deleted);
  if (category) {
    items = items.filter((i) => i.categoryId === category!.id);
  }
  const preferUnwatched = opts?.unwatchedOnly ?? config.randomPreferUnwatched;
  if (preferUnwatched) {
    const unwatched = items.filter((i) => !i.watched && i.status !== 'completed');
    if (unwatched.length > 0) items = unwatched;
  }
  if (items.length === 0) return null;

  const item = items[Math.floor(Math.random() * items.length)];
  const bingeMinutes =
    item.bingeMinutes ??
    category?.defaultBingeMinutes ??
    config.defaultBingeMinutes;

  return { item, category, bingeMinutes };
}

/** Resolve binge minutes for a category system key (spin duration hints). */
export async function bingeMinutesForSystemKey(
  systemKey: NonNullable<EntertainmentCategory['systemKey']>
): Promise<number> {
  const config = await getEntertainmentConfig();
  const categories = await entertainmentCategoriesRepo.list();
  const cat = categories.find((c) => c.systemKey === systemKey && !c.deleted);
  return cat?.defaultBingeMinutes ?? config.defaultBingeMinutes;
}
