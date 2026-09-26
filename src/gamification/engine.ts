/**
 * Computes XP, streaks, metrics from real user data only — no invented activity.
 */

import type {
  WorkoutSession,
  GuitarSession,
  LearningSession,
  CompletionRecord,
  CollegeDayStatus,
  SocialRecord,
  BucketListItem,
  SleepRecord,
  AchievementDef,
  AchievementUnlock,
} from '../data/types';
import type { GamificationConfig } from './settings';
import { toIsoDate } from '../routine/engine';

export interface Metrics {
  workout_completed: number;
  guitar_minutes: number;
  learning_minutes: number;
  routine_done: number;
  college_days: number;
  social_records: number;
  bucket_done: number;
  sleep_logged: number;
}

export interface StreakInfo {
  key: string;
  label: string;
  count: number;
}

export interface GamificationSnapshot {
  metrics: Metrics;
  xp: number;
  streaks: StreakInfo[];
  longestStreak: number;
  unlockedKeys: Set<string>;
  newlyUnlocked: AchievementDef[];
  completionPct: number | null;
}

/** Consecutive days ending today (or yesterday if today empty). */
export function computeStreak(doneDates: string[], ref = new Date()): number {
  const set = new Set(doneDates);
  let cursor = new Date(ref);
  cursor.setHours(12, 0, 0, 0);
  const today = toIsoDate(cursor);
  if (!set.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let count = 0;
  for (let i = 0; i < 400; i++) {
    const iso = toIsoDate(cursor);
    if (!set.has(iso)) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function buildMetrics(input: {
  workouts: WorkoutSession[];
  guitar: GuitarSession[];
  learning: LearningSession[];
  completions: CompletionRecord[];
  collegeDays: CollegeDayStatus[];
  social: SocialRecord[];
  bucket: BucketListItem[];
  sleep: SleepRecord[];
}): Metrics {
  const workout_completed = input.workouts.filter(
    (w) => !w.deleted && w.status === 'completed'
  ).length;
  const guitar_minutes = input.guitar
    .filter((g) => !g.deleted && g.status !== 'skipped')
    .reduce((s, g) => s + (g.durationMinutes || 0), 0);
  const learning_minutes = input.learning
    .filter((l) => !l.deleted && l.status !== 'skipped')
    .reduce((s, l) => s + (l.durationMinutes || 0), 0);
  const routine_done = input.completions.filter(
    (c) => !c.deleted && c.status === 'done'
  ).length;
  const college_days = input.collegeDays.filter((c) => !c.deleted).length;
  const social_records = input.social.filter((s) => !s.deleted).length;
  const bucket_done = input.bucket.filter((b) => !b.deleted && b.status === 'done').length;
  const sleep_logged = input.sleep.filter((s) => !s.deleted).length;
  return {
    workout_completed,
    guitar_minutes,
    learning_minutes,
    routine_done,
    college_days,
    social_records,
    bucket_done,
    sleep_logged,
  };
}

export function computeXp(metrics: Metrics, config: GamificationConfig): number {
  if (!config.xpEnabled) return 0;
  const w = config.xpWeights;
  return Math.round(
    metrics.workout_completed * w.workoutCompleted +
      metrics.guitar_minutes * w.guitarMinutes +
      metrics.learning_minutes * w.learningMinutes +
      metrics.routine_done * w.routineDone +
      metrics.college_days * w.collegeDay +
      metrics.social_records * w.socialRecord +
      metrics.bucket_done * w.bucketDone +
      metrics.sleep_logged * w.sleepLogged
  );
}

export function buildStreaks(input: {
  workouts: WorkoutSession[];
  guitar: GuitarSession[];
  learning: LearningSession[];
  completions: CompletionRecord[];
}): StreakInfo[] {
  const workoutDays = [
    ...new Set(
      input.workouts
        .filter((w) => !w.deleted && w.status === 'completed')
        .map((w) => w.date)
    ),
  ];
  const guitarDays = [
    ...new Set(
      input.guitar
        .filter((g) => !g.deleted && g.status !== 'skipped')
        .map((g) => g.date)
    ),
  ];
  const learningDays = [
    ...new Set(
      input.learning
        .filter((l) => !l.deleted && l.status !== 'skipped')
        .map((l) => l.date)
    ),
  ];
  const routineDays = [
    ...new Set(
      input.completions
        .filter((c) => !c.deleted && c.status === 'done')
        .map((c) => c.date)
    ),
  ];
  return [
    { key: 'workout', label: 'Workout streak', count: computeStreak(workoutDays) },
    { key: 'guitar', label: 'Guitar streak', count: computeStreak(guitarDays) },
    { key: 'learning', label: 'Learning streak', count: computeStreak(learningDays) },
    { key: 'routine', label: 'Routine streak', count: computeStreak(routineDays) },
  ];
}

export function evaluateAchievements(
  defs: AchievementDef[],
  metrics: Metrics,
  unlocks: AchievementUnlock[]
): { unlockedKeys: Set<string>; newlyUnlocked: AchievementDef[] } {
  const unlockedKeys = new Set(
    unlocks.filter((u) => !u.deleted).map((u) => u.achievementKey)
  );
  const newlyUnlocked: AchievementDef[] = [];
  for (const d of defs.filter((x) => x.enabled && !x.deleted)) {
    if (unlockedKeys.has(d.key)) continue;
    const value = (metrics as unknown as Record<string, number>)[d.metric] ?? 0;
    if (value >= d.threshold) {
      newlyUnlocked.push(d);
      unlockedKeys.add(d.key);
    }
  }
  return { unlockedKeys, newlyUnlocked };
}

/** Rough day completion from optional checklist counts. */
export function completionPercent(done: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(100, Math.round((done / total) * 100));
}

export function greetingForHour(h: number): string {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
