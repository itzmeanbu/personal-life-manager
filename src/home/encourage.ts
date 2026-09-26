/** Short nudges — rotate; never shame. Goal: make starting easier. */

const GENERAL = [
  'You don’t need a perfect day. One small win is enough.',
  'Open the next thing for two minutes. Momentum beats motivation.',
  'Future you is watching — make them proud of one choice.',
  'Rest is allowed. Quitting on yourself isn’t required today.',
  'Hard days still count. Show up messy.',
  'You already started by opening the app. Keep going.',
  'The gap between wanting and doing is one tiny step.',
  'No streak is worth burning out. Consistency > intensity.',
];

const WEEKEND = [
  'Weekend free time is yours — spin, play, or rest on purpose.',
  'Guitar later still counts if you protect a block for it.',
  'Guilt isn’t a plan. Pick one enjoyable thing and do it fully.',
];

const CONTINUE = [
  'Your show is waiting at the next episode — not from zero.',
  'Continue beats restart. Pick up where you left off.',
];

export function pickEncouragement(kind: 'general' | 'weekend' | 'continue' = 'general'): string {
  const pool =
    kind === 'weekend' ? WEEKEND : kind === 'continue' ? CONTINUE : GENERAL;
  return pool[Math.floor(Math.random() * pool.length)];
}
