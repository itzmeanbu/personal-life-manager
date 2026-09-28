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
 * All greetings in Latin/English script (romanized where needed).
 * Mix: English, Tamil, Korean, Japanese, Spanish, French, Hindi.
 */
const GREETINGS = {
  lateNight: [
    'Still up?',
    'Annyeong — still awake?',
    'Oyasumi soon?',
    'Innum thoongala?',
    'Hola, still here?',
    'Late night mode',
  ],
  morning: [
    'Good morning',
    'Kaalai vanakkam',
    'Annyeonghaseyo',
    'Ohayo',
    'Hola',
    'Bonjour',
    'Namaste',
    'Vanakkam',
    'Hi — good morning',
    'Morning vro',
  ],
  afternoon: [
    'Good afternoon',
    'Madhiya vanakkam',
    'Annyeong',
    'Konnichiwa',
    'Hola',
    'Bonjour',
    'Namaste',
  ],
  evening: [
    'Good evening',
    'Maalai vanakkam',
    'Annyeonghaseyo',
    'Konbanwa',
    'Hola',
    'Bonsoir',
    'Namaste',
  ],
  night: [
    'Winding down',
    'Jal jayo',
    'Oyasumi',
    'Nalla thoongu',
    'Buenas noches',
    'Bonne nuit',
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
