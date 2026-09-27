/** Encouragement + consequence nudges — sharp, memorable, not endless shame. */

const GENERAL = [
  'You don’t need a perfect day. One small win is enough.',
  'Open the next thing for two minutes. Momentum beats motivation.',
  'Future you is watching — make them proud of one choice.',
  'Hard days still count. Show up messy.',
  'The gap between wanting and doing is one tiny step.',
];

const WEEKEND = [
  'Weekend free time is yours — spin, play, or rest on purpose.',
  'Guilt isn’t a plan. Pick one enjoyable thing and do it fully.',
];

const CONTINUE = [
  'Continue beats restart. Pick up where you left off.',
];

/** Skip / neglect consequences — funny-scary, tied to real habits */
const CONSEQUENCES: Record<string, string[]> = {
  hair: [
    'Skip hair care enough times and the mirror starts saying “bald arc.”',
    'Serum isn’t optional lore — skip it and the hairline files a complaint.',
  ],
  face: [
    'Skip face care and “main character” becomes “extra with texture.”',
    'Sunscreen / treatment ignored → future you looks tired in every photo.',
  ],
  sleep: [
    'Skip sleep and your brain runs on potato mode. Sleep or suffer.',
    'No sleep = you die a little socially, academically, and in the gym.',
  ],
  bath: [
    'Skip the night bath and tomorrow’s you will smell the consequences.',
  ],
  workout: [
    'Skip workout streaks and the body remembers — strength doesn’t wait.',
  ],
  guitar: [
    'Skip guitar and the frets forget your fingers. Ten minutes still counts.',
  ],
  phone: [
    'Forget to charge and morning-you will hate night-you.',
  ],
  switch: [
    'Plugged in but switch off? The device is charging… nothing. Flip it.',
  ],
  sunscreen: [
    'Skip sunscreen — the sun does not care about your timetable.',
  ],
  general_skip: [
    'Skipping once is human. Skipping the reminder is how habits die.',
    'The app isn’t nagging — it’s the version of you that still wants results.',
  ],
};

export function pickEncouragement(kind: 'general' | 'weekend' | 'continue' = 'general'): string {
  const pool = kind === 'weekend' ? WEEKEND : kind === 'continue' ? CONTINUE : GENERAL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function consequenceForTitle(title: string): string {
  const t = title.trim().toLowerCase();
  if (t.includes('hair') || t.includes('serum')) return pick(CONSEQUENCES.hair);
  if (t.includes('face') || t.includes('wash') || t.includes('treatment')) return pick(CONSEQUENCES.face);
  if (t.includes('sunscreen')) return pick(CONSEQUENCES.sunscreen);
  if (t.includes('sleep')) return pick(CONSEQUENCES.sleep);
  if (t.includes('bath') || t.includes('shower')) return pick(CONSEQUENCES.bath);
  if (t.includes('workout') || t.includes('gym')) return pick(CONSEQUENCES.workout);
  if (t.includes('guitar')) return pick(CONSEQUENCES.guitar);
  if (t.includes('charge') || t.includes('phone')) return pick(CONSEQUENCES.phone);
  if (t.includes('switch') || t.includes('plug')) return pick(CONSEQUENCES.switch);
  return pick(CONSEQUENCES.general_skip);
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Bunk free-time ends ~19:30 → evening like a normal day */
export const BUNK_SPIN_END_HM = '19:30';

export function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function hmToMins(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isPastBunkSpinWindow(d = new Date()): boolean {
  return minutesNow(d) >= hmToMins(BUNK_SPIN_END_HM);
}
