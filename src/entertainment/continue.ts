/**
 * Continue-where-you-left-off helpers for K-drama / series / movies.
 * Never invents titles — only reads WatchlistItem rows the user owns.
 */

import type { WatchlistItem, EntertainmentCategory } from '../data/types';
import { watchlistItemsRepo, entertainmentCategoriesRepo } from '../data/repository';

/** Next episode to watch (1-based). If none logged yet → 1. */
export function nextEpisode(item: WatchlistItem): number {
  const done = item.episode ?? 0;
  return done + 1;
}

/** Human suggestion line, e.g. "2 episodes watched — continue from ep 3". */
export function continueSuggestion(item: WatchlistItem): string {
  const done = item.episode ?? 0;
  const total = item.totalEpisodes;
  const nxt = nextEpisode(item);

  if (item.mediaType === 'movie' || (!item.totalEpisodes && !item.episode && item.status !== 'watching')) {
    if (item.status === 'watching' || (item.leftOffNote && !item.watched)) {
      return item.leftOffNote
        ? `Continue “${item.title}” — ${item.leftOffNote}`
        : `Continue “${item.title}” where you left off`;
    }
    if (!item.watched) return `Start “${item.title}”`;
    return `Finished “${item.title}”`;
  }

  if (done <= 0) {
    return total
      ? `Start “${item.title}” — ep 1 of ${total}`
      : `Start “${item.title}” from episode 1`;
  }

  if (total && done >= total) {
    return `You finished all ${total} episodes of “${item.title}”`;
  }

  const base = `${done} episode${done === 1 ? '' : 's'} watched — continue from ep ${nxt}`;
  return total ? `${base}/${total}` : base;
}

/** Encouraging one-liner based on progress. */
export function encourageWatch(item: WatchlistItem): string {
  const done = item.episode ?? 0;
  const total = item.totalEpisodes;
  if (total && done > 0) {
    const pct = Math.round((done / total) * 100);
    if (pct >= 80) return `Almost there — only ${total - done} left. You’ve got this.`;
    if (pct >= 40) return `Solid progress (${pct}%). One more episode counts.`;
    return `Showing up matters. Ep ${nextEpisode(item)} is waiting.`;
  }
  if (done > 0) return `You already logged ${done} — keep the streak, just press play.`;
  return `Starting is the hard part. Open it for 5 minutes.`;
}

export async function logEpisodesWatched(
  itemId: string,
  count: number
): Promise<WatchlistItem | undefined> {
  const items = await watchlistItemsRepo.list();
  const item = items.find((i) => i.id === itemId && !i.deleted);
  if (!item || count <= 0) return item;

  const prev = item.episode ?? 0;
  let next = prev + count;
  const total = item.totalEpisodes;
  let status: WatchlistItem['status'] = 'watching';
  let watched = false;
  if (total && next >= total) {
    next = total;
    status = 'completed';
    watched = true;
  }

  return watchlistItemsRepo.update(itemId, {
    episode: next,
    status,
    watched,
    lastWatchedAt: new Date().toISOString(),
    leftOffNote: watched
      ? undefined
      : `Left at episode ${next} — continue from ${next + 1}`,
  });
}

/** In-progress titles first (real continue targets). */
export async function getContinueCandidates(limit = 5): Promise<
  Array<{ item: WatchlistItem; category: EntertainmentCategory | null; suggestion: string; nudge: string }>
> {
  const [items, cats] = await Promise.all([
    watchlistItemsRepo.list(),
    entertainmentCategoriesRepo.list(),
  ]);
  const catMap = new Map(cats.filter((c) => !c.deleted).map((c) => [c.id, c]));

  const open = items
    .filter((i) => !i.deleted && !i.watched && i.status !== 'completed' && i.status !== 'dropped')
    .sort((a, b) => {
      const aWatch = a.status === 'watching' || (a.episode ?? 0) > 0 ? 1 : 0;
      const bWatch = b.status === 'watching' || (b.episode ?? 0) > 0 ? 1 : 0;
      if (aWatch !== bWatch) return bWatch - aWatch;
      const at = a.lastWatchedAt ? new Date(a.lastWatchedAt).getTime() : 0;
      const bt = b.lastWatchedAt ? new Date(b.lastWatchedAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);

  return open.map((item) => ({
    item,
    category: catMap.get(item.categoryId) ?? null,
    suggestion: continueSuggestion(item),
    nudge: encourageWatch(item),
  }));
}
