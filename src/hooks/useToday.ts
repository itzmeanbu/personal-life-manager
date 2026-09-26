import { useMemo, useState, useEffect } from 'react';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';

export type DayName =
  | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday'
  | 'Thursday' | 'Friday' | 'Saturday';

export interface TodayInfo {
  date: Date;
  dayName: DayName;
  dayIndex: number; // 0 = Sunday
  isWeekend: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  greeting: string;
}

const DAY_NAMES: DayName[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const GREETINGS = {
  lateNight: [
    'Still up?', '¿Aún despierto?', 'Encore debout ?', 'இன்னும் விழித்திருக்கிறாயா?',
    'अभी भी जाग रहे हो?', 'まだ起きてるの？', 'Noch wach?', 'Ancora sveglio?',
    'Ainda acordado?', '아직 안 자?', 'Ещё не спишь?',
  ],
  morning: [
    'Good morning', 'Buenos días', 'Bonjour', 'காலை வணக்கம்', 'शुभ प्रभात',
    'おはようございます', 'Guten Morgen', 'Buongiorno', 'Bom dia', '좋은 아침',
    'Доброе утро', 'صباح الخير',
  ],
  afternoon: [
    'Good afternoon', 'Buenas tardes', 'Bon après-midi', 'மதிய வணக்கம்', 'नमस्कार',
    'こんにちは', 'Guten Tag', 'Buon pomeriggio', 'Boa tarde', '좋은 오후', 'Добрый день',
  ],
  evening: [
    'Good evening', 'Buenas noches', 'Bonsoir', 'மாலை வணக்கம்', 'शुभ संध्या',
    'こんばんは', 'Guten Abend', 'Buonasera', 'Boa noite', '좋은 저녁', 'Добрый вечер',
  ],
  night: [
    'Winding down', 'Hora de descansar', 'On se détend', 'ஓய்வெடுக்கும் நேரம்',
    'आराम का समय', 'そろそろ休もう', 'Zeit zum Entspannen', 'Momento di rilassarsi',
    'Hora de relaxar', '쉴 시간', 'Пора отдыхать',
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

/**
 * Single source of truth for "what day is it".
 * Respects DEMO day override when set. Greeting randomly chosen each evaluation.
 */
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
