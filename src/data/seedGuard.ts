/**
 * Prevents a seed function from ever running two inserts at once.
 *
 * The bug this fixes: every "seed default data" function used to do
 * `if (await isFeatureEnabled(FLAG, false)) return;` then insert, then
 * set the flag. That check-then-act has a gap — if the function is
 * called twice close together (React StrictMode intentionally double-
 * invokes effects in dev; a fast remount can do the same in production),
 * both calls can read the flag as "not seeded yet" before either call
 * finishes writing it, so both proceed to insert the full default list.
 * Result: every seeded row appears twice.
 *
 * The fix: keep one in-memory promise per seed key. The very first thing
 * a caller does is a synchronous check of that map — no `await` happens
 * before it — so a second call arriving while the first is still running
 * gets handed the *same* promise instead of starting its own run.
 *
 * This only guards against races within one page load (one open tab).
 * That's all that's needed here: the flag itself already stops re-seeding
 * across separate app launches, once a single run has completed cleanly.
 */

const inFlight = new Map<string, Promise<void>>();

export function runSeedOnce(key: string, fn: () => Promise<void>): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
