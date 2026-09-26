import {
  routinesRepo,
  spinWheelsRepo,
  bucketListItemsRepo,
  dayProfilesRepo,
  exerciseDefsRepo,
  workoutTemplatesRepo,
  achievementDefsRepo,
  musicPlaylistsRepo,
  entertainmentCategoriesRepo,
  collegeCategoriesRepo,
  phasesRepo,
} from './repository';
import { isFeatureEnabled, setFeatureEnabled } from './settings';
import { runSeedOnce } from './seedGuard';
import type { BaseEntity } from './types';

const CLEANUP_FLAG = 'duplicateSeedCleanupV1';

interface RepoLike<T extends BaseEntity> {
  list(): Promise<T[]>;
  remove(id: string, hard?: boolean): Promise<void>;
}

/**
 * Removes exact duplicate rows left behind by the old seeding race
 * condition (see seedGuard.ts) — e.g. every default routine showing up
 * twice. Two rows are treated as duplicates when `signatureOf` returns
 * the same value for both (id, order, createdAt/updatedAt are ignored on
 * purpose, since those are exactly the fields that differ between an
 * original row and its accidental double). The oldest copy in each group
 * is kept; the rest are hard-deleted. This only ever removes rows that
 * are indistinguishable from another row already kept — it never touches
 * a row the user has since edited to be different from its sibling.
 */
async function dedupeRepo<T extends BaseEntity>(
  repo: RepoLike<T>,
  signatureOf: (row: T) => string
): Promise<void> {
  const rows = await repo.list();
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const sig = signatureOf(row);
    const list = groups.get(sig) ?? [];
    list.push(row);
    groups.set(sig, list);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const extras = sorted.slice(1);
    for (const extra of extras) {
      await repo.remove(extra.id, true);
    }
  }
}

function sig(...parts: unknown[]): string {
  return JSON.stringify(parts);
}

/** Runs once per install, after seeding, to clean up any pre-existing doubles. */
export function cleanupDuplicateSeedData(): Promise<void> {
  return runSeedOnce(CLEANUP_FLAG, async () => {
    if (await isFeatureEnabled(CLEANUP_FLAG, false)) return;

    await dedupeRepo(routinesRepo, (r) => sig(r.title, r.time, r.category, r.cadence));
    await dedupeRepo(spinWheelsRepo, (w) => sig(w.name, w.parentWheelId));
    await dedupeRepo(bucketListItemsRepo, (b) => sig(b.title, b.category));
    await dedupeRepo(dayProfilesRepo, (d) => sig(d.name));
    await dedupeRepo(exerciseDefsRepo, (e) => sig(e.name));
    await dedupeRepo(workoutTemplatesRepo, (t) => sig(t.name));
    await dedupeRepo(achievementDefsRepo, (a) => sig(a.key));
    await dedupeRepo(musicPlaylistsRepo, (p) => sig(p.name));
    await dedupeRepo(entertainmentCategoriesRepo, (c) => sig(c.name));
    await dedupeRepo(collegeCategoriesRepo, (c) => sig(c.name));
    await dedupeRepo(phasesRepo, (p) => sig(p.name));

    await setFeatureEnabled(CLEANUP_FLAG, true);
  });
}
