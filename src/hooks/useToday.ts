import { useMemo, useState, useEffect } from 'react';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';

export type DayName =
  | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday'
  | 'Thursday' | 'Friday' | 'Saturday';

export interface TodayInfo {
  date: Date;
  dayName: DayName;
  dayIndex: number;
  isWeekend: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  greeting: string;
}

const DAY_NAMES: DayName[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/**
 * English letters only. English + French + Korean + Japanese (romanized).
 * No Tamil, Spanish, or Hindi.
 */
const GREETINGS = {
  lateNight: [
    'Still up?',
    'Annyeong — still awake?',
    'Oyasumi soon?',
    'Bonsoir from the night',
    'Late night mode',
  ],
  morning: [
    'Good morning',
    'Bonjour',
    'Annyeonghaseyo',
    'Ohayo',
    'Hi — good morning',
    'Morning',
  ],
  afternoon: [
    'Good afternoon',
    'Bonjour',
    'Annyeong',
    'Konnichiwa',
  ],
  evening: [
    'Good evening',
    'Bonsoir',
    'Annyeonghaseyo',
    'Konbanwa',
  ],
  night: [
    'Winding down',
    'Bonne nuit',
    'Jal jayo',
    'Oyasumi',
    'Good night',
    'Rest well',
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getGreeting(hour: number): string {
  if (hour < 5) return pickRandom(GREETINGS.lateNight);
  if (hour < 12) return pickRandom(GREETINGS.morning);
  if (hour < 17) return pickRandom(GREETINGS.afternoon);
  if (hour < 21) return pickRandom(GREETINGS.evening);
  return pickRandom(GREETINGS.night);
}

export function useToday(): TodayInfo {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeDemoDay(() => setTick((t) => t + 1)), []);

  return useMemo(() => {
    const date = getDemoDate();
    const dayIndex = date.getDay();
    const dayName = DAY_NAMES[dayIndex];
    const isSaturday = dayIndex === 6;
    const isSunday = dayIndex === 0;
    return {
      date,
      dayName,
      dayIndex,
      isWeekend: isSaturday || isSunday,
      isSunday,
      isSaturday,
      greeting: getGreeting(date.getHours()),
    };
  }, [tick]);
}
