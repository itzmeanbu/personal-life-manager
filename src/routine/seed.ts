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
  { title: 'Wake up', category: 'Morning', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:00', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Brush', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:05', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Face wash', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:10', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Hair serum', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:15', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Sunscreen', category: 'Hygiene', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:20', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Dress', category: 'Morning', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:25', durationMinutes: 10, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Breakfast', category: 'Meals', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '05:30', durationMinutes: 25, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'morning' },
  { title: 'Leave for college', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '06:00', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 10 }, moduleTag: 'college' },
  { title: 'Bus to college', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '06:05', durationMinutes: 175, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'College', category: 'College', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '09:00', durationMinutes: 450, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'Bus home', category: 'Commute', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '16:30', durationMinutes: 150, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'college' },
  { title: 'Workout', category: 'Fitness', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '19:30', durationMinutes: 60, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 5 }, moduleTag: 'workout' },
  { title: 'Bath', category: 'Hygiene', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '20:30', durationMinutes: 15, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'night' },
  { title: 'Guitar practice', category: 'Music', kind: 'recurring', cadence: 'custom', activeDays: [1, 2, 3, 4, 5], time: '20:45', durationMinutes: 60, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'night' },
  { title: 'Serum', category: 'Hygiene', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '21:45', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'night' },
  { title: 'Face serum', category: 'Hygiene', kind: 'recurring', cadence: 'weekdays', activeDays: WEEKDAYS, time: '21:50', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 }, moduleTag: 'night' },
  { title: 'Sleep', category: 'Rest', kind: 'recurring', cadence: 'daily', activeDays: [0,1,2,3,4,5,6], time: '22:00', durationMinutes: 0, enabled: true, archived: false, reminder: { enabled: true, offsetMinutes: 15 } },
];

const SEED_FLAG = 'routineEngineSeeded';
const ROUTINE_V2_FLAG = 'routineFlowV2';

/** Inserts the default routine list exactly once per install (device). Safe to call on every app boot. */
async function applyRoutineFlowV2(): Promise<void> {
  if (await isFeatureEnabled(ROUTINE_V2_FLAG, false)) return;
  const rows = await routinesRepo.list();
  const active = rows.filter((r) => !r.deleted);
  const find = (title: string) => active.find((r) => r.title.trim().toLowerCase() === title.toLowerCase());

  const addIfMissing = async (routine: SeedRoutine) => {
    if (find(routine.title)) return;
    const maxOrder = active.reduce((m, r) => Math.max(m, r.order), -1);
    await routinesRepo.create({ ...routine, order: maxOrder + 1 });
    active.push({ ...routine, id: `seed-${routine.title}`, createdAt: '', updatedAt: '', deleted: false, syncedAt: null, order: maxOrder + 1 });
  };

  const sunscreen = { title: 'Sunscreen', category: 'Hygiene', kind: 'recurring' as const, cadence: 'daily' as const, activeDays: [0,1,2,3,4,5,6], time: '05:20', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } };
  const dress = { title: 'Dress', category: 'Morning', kind: 'recurring' as const, cadence: 'daily' as const, activeDays: [0,1,2,3,4,5,6], time: '05:25', durationMinutes: 10, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } };
  const faceSerum = { title: 'Face serum', category: 'Hygiene', kind: 'recurring' as const, cadence: 'weekdays' as const, activeDays: WEEKDAYS, time: '21:50', durationMinutes: 5, enabled: true, archived: false, reminder: { enabled: false, offsetMinutes: 0 } };
  await addIfMissing(sunscreen);
  await addIfMissing(dress);
  await addIfMissing(faceSerum);

  for (const title of ['Wake up', 'Brush', 'Face wash', 'Hair serum', 'Sunscreen', 'Dress', 'Breakfast']) {
    const row = find(title);
    if (row) await routinesRepo.update(row.id, { moduleTag: 'morning' });
  }

  const face = find('Face serum');
  if (face) await routinesRepo.update(face.id, { moduleTag: 'night' });
  const combined = find('Night hair & face routine');
  if (combined) await routinesRepo.update(combined.id, { title: 'Serum', time: '21:45', durationMinutes: 5, moduleTag: 'night' });
  const workout = find('Workout');
  if (workout) await routinesRepo.update(workout.id, { durationMinutes: 60 });
  const guitar = find('Guitar practice');
  if (guitar) await routinesRepo.update(guitar.id, { activeDays: WEEKDAYS, time: '20:45', durationMinutes: 60, moduleTag: 'night' });
  const bath = find('Bath');
  if (bath) await routinesRepo.update(bath.id, { time: '20:30', moduleTag: 'night' });
  await setFeatureEnabled(ROUTINE_V2_FLAG, true);
}

export async function ensureDefaultRoutinesSeeded(): Promise<void> {
  await runSeedOnce(SEED_FLAG, async () => {
    const alreadySeeded = await isFeatureEnabled(SEED_FLAG, false);
    const existing = await routinesRepo.list();
    if (!alreadySeeded && existing.length === 0) {
      let order = 0;
      for (const routine of DEFAULT_ROUTINES) {
        await routinesRepo.create({ ...routine, order: order++ });
      }
    }
    await setFeatureEnabled(SEED_FLAG, true);
  });
  await applyRoutineFlowV2();
}
