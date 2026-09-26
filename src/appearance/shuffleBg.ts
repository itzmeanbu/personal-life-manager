import type { AppearanceConfig } from './settings';
import type { MediaIndexEntry } from './media';
import { listBackgrounds } from './media';

/**
 * Daily background pick — avoids immediate repeat when multiple photos exist.
 */
export function pickDailyBackground(
  index: MediaIndexEntry[],
  config: AppearanceConfig,
  todayIso: string
): { key: string | null; history: string[] } {
  const bgs = listBackgrounds(index);
  if (bgs.length === 0) return { key: null, history: config.backgroundHistory };

  if (!config.randomBackgroundEnabled && config.fixedBackgroundKey) {
    if (bgs.some((b) => b.key === config.fixedBackgroundKey)) {
      return { key: config.fixedBackgroundKey, history: config.backgroundHistory };
    }
  }

  // Same day sticky
  if (
    config.todayBackgroundDate === todayIso &&
    config.todayBackgroundKey &&
    bgs.some((b) => b.key === config.todayBackgroundKey)
  ) {
    return { key: config.todayBackgroundKey, history: config.backgroundHistory };
  }

  const last = config.backgroundHistory[config.backgroundHistory.length - 1];
  let pool = bgs.map((b) => b.key);
  if (pool.length > 1 && last) pool = pool.filter((k) => k !== last);
  const key = pool[Math.floor(Math.random() * pool.length)];
  const history = [...config.backgroundHistory, key].slice(-20);
  return { key, history };
}
