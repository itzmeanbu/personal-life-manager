/**
 * Shuffle / queue order — does not always start at index 0.
 * Avoids immediate repeat of the previous track when practical.
 */

import type { MusicTrack } from '../data/types';
import type { MusicConfig } from './settings';

function weightedShuffle(tracks: MusicTrack[], preferLessPlayed: boolean): MusicTrack[] {
  const arr = [...tracks];
  // Fisher–Yates; optional bias by inverting playCount for sort keys mid-shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    if (preferLessPlayed && arr.length > 2) {
      // Occasionally swap toward a less-played track at position j
      const a = arr[i];
      const b = arr[j];
      if ((a.playCount ?? 0) + 1 < (b.playCount ?? 0) && Math.random() < 0.35) {
        j = i; // keep less-played later in swap sense — still random overall
      }
    }
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a play queue.
 * @param lastTrackId if set, try not to put that track first (and avoid it as next if possible).
 */
export function buildQueue(
  tracks: MusicTrack[],
  opts: {
    shuffle: boolean;
    config: MusicConfig;
    lastTrackId?: string | null;
  }
): MusicTrack[] {
  const active = tracks.filter((t) => !t.deleted);
  if (active.length === 0) return [];

  if (!opts.shuffle) {
    return [...active].sort((a, b) => a.order - b.order);
  }

  let queue = weightedShuffle(active, opts.config.preferLessPlayed);

  if (opts.config.avoidImmediateRepeat && opts.lastTrackId && queue.length > 1) {
    if (queue[0].id === opts.lastTrackId) {
      // rotate so we don't start with the same song
      queue = [...queue.slice(1), queue[0]];
    }
  }

  // Extra: if still same as last, swap first with a random other
  if (opts.config.avoidImmediateRepeat && opts.lastTrackId && queue.length > 1 && queue[0].id === opts.lastTrackId) {
    const idx = 1 + Math.floor(Math.random() * (queue.length - 1));
    [queue[0], queue[idx]] = [queue[idx], queue[0]];
  }

  return queue;
}

/** Pick a single random track, avoiding last if possible. */
export function pickRandomTrack(
  tracks: MusicTrack[],
  lastTrackId?: string | null
): MusicTrack | null {
  const active = tracks.filter((t) => !t.deleted);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  const pool = lastTrackId ? active.filter((t) => t.id !== lastTrackId) : active;
  return pool[Math.floor(Math.random() * pool.length)] ?? active[0];
}
