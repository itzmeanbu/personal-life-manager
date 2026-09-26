/**
 * Seeds the default bodyweight program + exercise library once.
 * Every row is fully editable in-app afterwards.
 */

import type { ExerciseDef, WorkoutTemplate, WorkoutTemplateItem } from '../data/types';
import { exerciseDefsRepo, workoutTemplatesRepo, generateId } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'workoutEngineSeeded';

function id(): string {
  return generateId();
}

type SeedEx = Omit<ExerciseDef, keyof import('../data/types').BaseEntity | 'order'>;

const EXERCISES: SeedEx[] = [
  {
    name: 'Push-ups',
    instructions: 'Chest to floor, full lockout at top.',
    tutorial: 'Hands under shoulders, body straight. Lower until chest nearly touches floor, press up.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 8,
    defaultRepsMax: 15,
    defaultRestSeconds: 60,
    benefits: ['chest', 'triceps', 'shoulders', 'core'],
    enabled: true,
  },
  {
    name: 'Incline / knee push-ups',
    instructions: 'Easier push-up variation — hands elevated or knees down.',
    tutorial: 'Same form as push-ups; reduce load via incline or knees.',
    defaultModality: 'sets_reps',
    defaultSets: 2,
    defaultRepsMin: 10,
    defaultRepsMax: 15,
    defaultRestSeconds: 45,
    benefits: ['chest', 'triceps'],
    enabled: true,
  },
  {
    name: 'Backpack rows',
    instructions: 'Hinge at hips, row backpack to ribs.',
    tutorial: 'Soft knees, flat back. Pull pack to lower chest/ribs, squeeze shoulder blades.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 10,
    defaultRepsMax: 15,
    defaultRestSeconds: 60,
    benefits: ['back', 'biceps', 'posture'],
    enabled: true,
  },
  {
    name: 'Pike push-ups',
    instructions: 'Hips high, lower head toward floor.',
    tutorial: 'Downward-dog shape. Bend elbows to lower head, press back up. Shoulder-focused.',
    defaultModality: 'sets_reps',
    defaultSets: 2,
    defaultRepsMin: 6,
    defaultRepsMax: 12,
    defaultRestSeconds: 60,
    benefits: ['shoulders', 'triceps'],
    enabled: true,
  },
  {
    name: 'Plank',
    instructions: 'Hold a straight body line.',
    tutorial: 'Forearms or hands. Brace core, no sagging hips. Breathe steadily.',
    defaultModality: 'duration',
    defaultSets: 3,
    defaultDurationSeconds: 45,
    defaultRestSeconds: 30,
    benefits: ['core', 'stability'],
    enabled: true,
  },
  {
    name: 'Bodyweight squats',
    instructions: 'Sit back, knees track toes, full depth as mobility allows.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 12,
    defaultRepsMax: 20,
    defaultRestSeconds: 60,
    benefits: ['quads', 'glutes', 'legs'],
    enabled: true,
  },
  {
    name: 'Reverse lunges',
    instructions: 'Step back into lunge; count each leg.',
    tutorial: 'Upright torso. Back knee toward floor, front shin vertical. Alternate or finish one leg first.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 8,
    defaultRepsMax: 12,
    defaultRestSeconds: 60,
    benefits: ['quads', 'glutes', 'balance'],
    enabled: true,
  },
  {
    name: 'Glute bridges',
    instructions: 'Drive hips up, squeeze glutes at top.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 12,
    defaultRepsMax: 20,
    defaultRestSeconds: 45,
    benefits: ['glutes', 'hamstrings', 'core'],
    enabled: true,
  },
  {
    name: 'Calf raises',
    instructions: 'Rise onto toes, controlled lower.',
    defaultModality: 'sets_reps',
    defaultSets: 3,
    defaultRepsMin: 15,
    defaultRepsMax: 25,
    defaultRestSeconds: 30,
    benefits: ['calves'],
    enabled: true,
  },
  {
    name: 'Wall sit',
    instructions: 'Back flat on wall, thighs parallel if possible.',
    defaultModality: 'duration',
    defaultSets: 2,
    defaultDurationSeconds: 45,
    defaultRestSeconds: 45,
    benefits: ['quads', 'endurance'],
    enabled: true,
  },
  {
    name: 'Side plank',
    instructions: 'Hold each side; stack or stagger feet.',
    defaultModality: 'duration',
    defaultSets: 2,
    defaultDurationSeconds: 30,
    defaultRestSeconds: 30,
    benefits: ['obliques', 'core', 'stability'],
    enabled: true,
  },
];

function item(
  name: string,
  modality: WorkoutTemplateItem['modality'],
  opts: Partial<WorkoutTemplateItem> & { order: number }
): WorkoutTemplateItem {
  return {
    id: id(),
    name,
    modality,
    restSeconds: 60,
    ...opts,
  };
}

type SeedTpl = Omit<WorkoutTemplate, keyof import('../data/types').BaseEntity | 'order'>;

const TEMPLATES: SeedTpl[] = [
  {
    name: 'Upper Body',
    dayIndex: 1, // Monday
    isRest: false,
    focus: 'Upper Body',
    benefits: ['push', 'pull', 'core'],
    enabled: true,
    items: [
      item('Push-ups', 'sets_reps', { order: 0, sets: 3, repsMin: 8, repsMax: 15 }),
      item('Incline / knee push-ups', 'sets_reps', { order: 1, sets: 2, repsMin: 10, repsMax: 15 }),
      item('Backpack rows', 'sets_reps', { order: 2, sets: 3, repsMin: 10, repsMax: 15 }),
      item('Pike push-ups', 'sets_reps', { order: 3, sets: 2, repsMin: 6, repsMax: 12 }),
      item('Plank', 'duration', {
        order: 4,
        sets: 3,
        durationSeconds: 45,
        customInstructions: 'Hold 30–45 sec each set.',
      }),
    ],
  },
  {
    name: 'Legs',
    dayIndex: 2, // Tuesday
    isRest: false,
    focus: 'Legs',
    benefits: ['quads', 'glutes', 'calves'],
    enabled: true,
    items: [
      item('Bodyweight squats', 'sets_reps', { order: 0, sets: 3, repsMin: 12, repsMax: 20 }),
      item('Reverse lunges', 'sets_reps', {
        order: 1,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        customInstructions: '8–12 each leg.',
      }),
      item('Glute bridges', 'sets_reps', { order: 2, sets: 3, repsMin: 12, repsMax: 20 }),
      item('Calf raises', 'sets_reps', { order: 3, sets: 3, repsMin: 15, repsMax: 25 }),
      item('Wall sit', 'duration', {
        order: 4,
        sets: 2,
        durationSeconds: 45,
        customInstructions: 'Hold 30–60 sec each set.',
      }),
    ],
  },
  {
    name: 'Rest',
    dayIndex: 3, // Wednesday
    isRest: true,
    focus: 'Rest',
    benefits: ['recovery'],
    enabled: true,
    items: [],
    notes: 'Full rest day. Optional light walk or mobility only.',
  },
  {
    name: 'Full Body A',
    dayIndex: 4, // Thursday
    isRest: false,
    focus: 'Full Body',
    benefits: ['full body', 'strength'],
    enabled: true,
    items: [
      item('Push-ups', 'sets_reps', { order: 0, sets: 3, repsMin: 8, repsMax: 15 }),
      item('Backpack rows', 'sets_reps', { order: 1, sets: 3, repsMin: 10, repsMax: 15 }),
      item('Bodyweight squats', 'sets_reps', { order: 2, sets: 3, repsMin: 12, repsMax: 20 }),
      item('Reverse lunges', 'sets_reps', {
        order: 3,
        sets: 2,
        repsMin: 8,
        repsMax: 12,
        customInstructions: '8–12 each leg.',
      }),
      item('Plank', 'duration', {
        order: 4,
        sets: 3,
        durationSeconds: 45,
        customInstructions: 'Hold 30–60 sec each set.',
      }),
    ],
  },
  {
    name: 'Full Body B',
    dayIndex: 5, // Friday
    isRest: false,
    focus: 'Full Body',
    benefits: ['full body', 'core'],
    enabled: true,
    items: [
      item('Push-ups', 'sets_reps', { order: 0, sets: 3, repsMin: 8, repsMax: 15 }),
      item('Backpack rows', 'sets_reps', { order: 1, sets: 3, repsMin: 10, repsMax: 15 }),
      item('Glute bridges', 'sets_reps', { order: 2, sets: 3, repsMin: 15, repsMax: 20 }),
      item('Bodyweight squats', 'sets_reps', { order: 3, sets: 3, repsMin: 15, repsMax: 20 }),
      item('Side plank', 'duration', {
        order: 4,
        sets: 2,
        durationSeconds: 30,
        customInstructions: '20–40 sec each side.',
      }),
    ],
  },
  {
    name: 'Weekend Rest',
    dayIndex: 6, // Saturday
    isRest: true,
    focus: 'Rest',
    benefits: ['recovery'],
    enabled: true,
    items: [],
    notes: 'Normally rest. Optional optional active recovery.',
  },
  {
    name: 'Sunday Rest',
    dayIndex: 0, // Sunday
    isRest: true,
    focus: 'Rest',
    benefits: ['recovery'],
    enabled: true,
    items: [],
    notes: 'Normally rest.',
  },
];

export function seedWorkoutEngineIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;

  const existingTpl = await workoutTemplatesRepo.list();
  const existingEx = await exerciseDefsRepo.list();
  if (existingTpl.length > 0 || existingEx.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }

  const nameToId = new Map<string, string>();
  let order = 0;
  for (const ex of EXERCISES) {
    const row = await exerciseDefsRepo.create({ ...ex, order: order++ });
    nameToId.set(ex.name, row.id);
  }

  order = 0;
  for (const tpl of TEMPLATES) {
    const items = tpl.items.map((it) => ({
      ...it,
      exerciseId: nameToId.get(it.name),
    }));
    await workoutTemplatesRepo.create({ ...tpl, items, order: order++ });
  }

  await setFeatureEnabled(SEED_FLAG, true);
});
}
