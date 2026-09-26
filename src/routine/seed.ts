import type { Routine } from '../data/types';
import { routinesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

/**
 * Default seed for a first-run install, modelled on the "normal college day"
 * routine that was described when this engine was built. This is DATA, not
 * logic — every row is a normal Routine row the user can rename, retime,
 * recategorize, disable, reorder, or delete the moment the app opens. No
 * page or component ever special-cases these rows by name; deleting all of
 * them leaves a completely empty, still-fully-functional engine.
 *
 * Seeding runs at most once per install, gated by a FeatureToggle flag
 * (`routineEngineSeeded`) so it never re-inserts rows the user removed.
 */
type SeedRoutine = Omit<
  Routine,
  keyof import('../data/types').BaseEntity | 'order'
>;

const WEEKDAYS = [1, 2, 3, 4, 5];

const DEFAULT_ROUTINES: SeedRoutine[] = [
  { title: 'Wake up', category: 'Morning', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:00', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 0 } },
  { title: 'Brush', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:05', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } },
  { title: 'Face wash', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:10', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } },
  { title: 'Hair serum', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:15', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } },
  { title: 'Breakfast', category: 'Meals', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:25', durationMinutes: 25, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } },
  { title: 'Leave for college', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '06:00', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 10 }, moduleTag: 'college' },
  { title: 'Bus to college', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '06:05', durationMinutes: 175, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'College', category: 'College', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '09:00', durationMinutes: 450, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'Bus home', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '16:30', durationMinutes: 150, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'Workout', category: 'Fitness', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '19:30', durationMinutes: 45, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 5 }, moduleTag: 'workout' },
  { title: 'Guitar practice', category: 'Music', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '20:15', durationMinutes: 30, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'guitar' },
  { title: 'Bath', category: 'Hygiene', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '20:45', durationMinutes: 15, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } },
  {
    title: 'Night hair & face routine',
    notes: 'Includes the hair tablet — this reminder is deliberately at night, not morning.',
    category: 'Hygiene',
    kind: 'recurring',
    cadence: 'weekdays',
    activeDays: WEEKDAYS,
    time: '21:00',
    durationMinutes: 15,
    enabled: true,
    archived: false,
    reminder: { enabled: true, offsetMinutes: 0 },
  },
  { title: 'Sleep', category: 'Rest', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '22:00', durationMinutes: 0, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 15 } },
];

const SEED_FLAG = 'routineEngineSeeded';

/** Inserts the default routine list exactly once per install (device). Safe to call on every app boot. */
export function ensureDefaultRoutinesSeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
    const alreadySeeded = await isFeatureEnabled(SEED_FLAG, false);
    if (alreadySeeded) return;

    const existing = await routinesRepo.list();
    if (existing.length === 0) {
      let order = 0;
      for (const routine of DEFAULT_ROUTINES) {
        await routinesRepo.create({ ...routine, order: order++ });
      }
    }
    await setFeatureEnabled(SEED_FLAG, true);
  });
}
