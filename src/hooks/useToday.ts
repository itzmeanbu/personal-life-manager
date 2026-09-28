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
 * Languages the user is familiar with (Tamil + English).
 * Tamil is written in Latin script for UI readability on any font.
 */
const GREETINGS = {
  lateNight: [
    'Still up?',
    'Innum thoongala?',
    'Late night mode',
    'Rest soon',
  ],
  morning: [
    'Good morning',
    'Kaalai vanakkam',
    'Hi — good morning',
    'Vanakkam',
    'Morning vro',
  ],
  afternoon: [
    'Good afternoon',
    'Madhiya vanakkam',
    'Hi',
    'Afternoon',
  ],
  evening: [
    'Good evening',
    'Maalai vanakkam',
    'Hi — evening',
    'Vanakkam',
  ],
  night: [
    'Winding down',
    'Nalla thoongu',
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
