/**
 * Seeds default Day Profiles once. Fully editable afterwards — no code
 * changes required to create new custom day types.
 */

import type { DayProfile, DayProfileEffects } from '../data/types';
import { dayProfilesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';
import { emptyEffects } from './effects';
import { generateId } from '../data/repository';

const SEED_FLAG = 'dayProfilesSeeded';

function cid(): string {
  return generateId();
}

function fx(partial: Partial<DayProfileEffects>): DayProfileEffects {
  return { ...emptyEffects(), ...partial };
}

type SeedProfile = Omit<DayProfile, keyof import('../data/types').BaseEntity | 'order'>;

const DEFAULTS: SeedProfile[] = [
  {
    name: 'Normal College Day',
    icon: '🎓',
    description: 'Default weekday: college → bus → home ~7–7:30 PM.',
    enabled: true,
    systemKey: 'normal',
    effects: fx({
      bannerMessage: 'Normal college day',
      focusModules: [],
      hideModules: [],
    }),
  },
  {
    name: 'Bunk Day',
    icon: '🏃',
    description: 'Home early. Afternoon free for skills, coding, games, social.',
    enabled: true,
    systemKey: 'bunk',
    effects: fx({
      bannerMessage: 'Bunk day — out until you get home, then free time + spin',
      disableModuleTags: ['college'],
      hideModules: [],
      focusModules: ['today', 'spin', 'entertainment', 'social', 'learning', 'guitar'],
      foodPlan: 'Flexible — home or local.',
      travelPlan: 'No full college commute / early return.',
      checklist: [
        { id: cid(), title: 'Decide home arrival time' },
        { id: cid(), title: 'Plan afternoon skill block' },
      ],
    }),
  },
  {
    name: 'Exam Day',
    icon: '📝',
    description: 'Stay at college, study with friends, eat outside, no normal home routine.',
    enabled: true,
    systemKey: 'exam',
    effects: fx({
      replaceBaseRoutines: true,
      bannerMessage: 'Exam day — focus mode',
      disableModuleTags: ['workout'],
      hideModules: ['workout', 'bike', 'entertainment', 'guitar'],
      focusModules: ['today', 'college', 'learning', 'money'],
      foodPlan: 'Eat outside / canteen with friends.',
      travelPlan: 'Stay at college; no normal home routine.',
      checklist: [
        { id: cid(), title: 'Admit card / ID' },
        { id: cid(), title: 'Stationery' },
        { id: cid(), title: 'Water bottle' },
        { id: cid(), title: 'Notes / formula sheet if allowed' },
      ],
      extraAgendaItems: [
        {
          id: cid(),
          title: 'Stay at college',
          category: 'Exam',
          time: '09:00',
          durationMinutes: 480,
          notes: 'Study with friends between papers if any',
        },
        {
          id: cid(),
          title: 'Eat outside',
          category: 'Meals',
          time: '13:00',
          durationMinutes: 45,
        },
      ],
    }),
  },
  {
    name: 'Hackathon Day',
    icon: '💻',
    description: 'Laptop, charger, project, event, food outside, late return.',
    enabled: true,
    systemKey: 'hackathon',
    effects: fx({
      replaceBaseRoutines: true,
      bannerMessage: 'Hackathon day — build mode',
      disableModuleTags: ['workout'],
      hideModules: ['workout', 'guitar', 'bike'],
      focusModules: ['today', 'development', 'learning', 'college', 'money'],
      foodPlan: 'Food outside / event catering.',
      travelPlan: 'Event venue; late return expected.',
      checklist: [
        { id: cid(), title: 'Laptop' },
        { id: cid(), title: 'Charger' },
        { id: cid(), title: 'Project files / Git ready' },
        { id: cid(), title: 'ID / tickets' },
        { id: cid(), title: 'Power bank / earphones' },
        { id: cid(), title: 'Snacks / water' },
      ],
      extraAgendaItems: [
        {
          id: cid(),
          title: 'Hackathon event',
          category: 'Event',
          time: '09:00',
          durationMinutes: 720,
          notes: 'Late return',
          moduleTag: 'development',
        },
      ],
      activateSpinWheelNames: [],
    }),
  },
  {
    name: 'Event Day',
    icon: '🎉',
    description: 'Campus or external event — travel and timing differ from normal.',
    enabled: true,
    systemKey: 'event',
    effects: fx({
      replaceBaseRoutines: false,
      bannerMessage: 'Event day',
      hideModules: [],
      focusModules: ['today', 'college', 'social', 'money', 'bike'],
      travelPlan: 'Check event venue and leave buffer time.',
      foodPlan: 'Often outside / event food.',
      checklist: [
        { id: cid(), title: 'Tickets / registration' },
        { id: cid(), title: 'Outfit ready' },
        { id: cid(), title: 'Travel plan confirmed' },
      ],
    }),
  },
  {
    name: 'Holiday',
    icon: '🌴',
    description: 'No college. Rest, hobbies, optional light plans.',
    enabled: true,
    systemKey: 'holiday',
    effects: fx({
      replaceBaseRoutines: true,
      bannerMessage: 'Holiday — no college',
      hideModules: ['college'],
      focusModules: ['today', 'weekend', 'entertainment', 'workout', 'guitar', 'social', 'development'],
      foodPlan: 'Home / family / flexible.',
      travelPlan: 'None required.',
      checklist: [{ id: cid(), title: 'One fun thing planned' }],
      extraAgendaItems: [
        {
          id: cid(),
          title: 'Free day block',
          category: 'Holiday',
          time: '10:00',
          durationMinutes: 240,
        },
      ],
    }),
  },
  {
    name: 'Stay-Out Day',
    icon: '🌙',
    description: 'Staying out late or overnight — home routines deferred.',
    enabled: true,
    systemKey: 'stay_out',
    effects: fx({
      replaceBaseRoutines: false,
      bannerMessage: 'Stay-out day — home routine deferred',
      disableCategories: ['Hygiene'],
      hideModules: [],
      focusModules: ['today', 'social', 'money', 'bike'],
      travelPlan: 'Return time flexible / next morning.',
      foodPlan: 'Outside.',
      checklist: [
        { id: cid(), title: 'Tell family return plan' },
        { id: cid(), title: 'Charged phone + power bank' },
        { id: cid(), title: 'Cash / UPI ready' },
      ],
    }),
  },
  {
    name: 'Sunday',
    icon: '☀️',
    description: 'Sunday reset — plan the week, lighter schedule.',
    enabled: true,
    systemKey: 'sunday',
    effects: fx({
      replaceBaseRoutines: false,
      bannerMessage: 'Sunday — reset & plan',
      hideModules: ['college'],
      focusModules: ['today', 'weekend', 'routines', 'progress', 'workout', 'guitar', 'development'],
      checklist: [
        { id: cid(), title: 'Review last week' },
        { id: cid(), title: 'Plan next week routines' },
        { id: cid(), title: 'Laundry / room reset' },
      ],
    }),
  },
];

export function seedDayProfilesIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await dayProfilesRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }
  let order = 0;
  for (const p of DEFAULTS) {
    await dayProfilesRepo.create({ ...p, order: order++ });
  }
  await setFeatureEnabled(SEED_FLAG, true);
});
}
