/**
 * Random "good morning" in many languages, written in English letters.
 * Different language each day, no repeat until the list is used up.
 */
import { getSetting, setSetting } from '../data/settings';

const CFG_KEY = 'day.greetings.config.v1';
const TODAY_KEY = 'day.greetings.today.v1';
const USED_KEY = 'day.greetings.used.v1';

export interface Greeting {
  language: string;
  text: string;
  meaning: string;
}

export interface GreetingConfig {
  enabled: boolean;
  /** Optional name shown after the greeting. Empty = none. */
  name: string;
  list: Greeting[];
}

export const DEFAULT_GREETINGS: Greeting[] = [
  { language: 'English', text: 'Good morning', meaning: 'Good morning' },
  { language: 'Japanese', text: 'Ohayou gozaimasu', meaning: 'Good morning (polite)' },
  { language: 'Korean', text: 'Joeun achim', meaning: 'Good morning' },
  { language: 'French', text: 'Bonjour', meaning: 'Good day / hello' },
  { language: 'Tamil', text: 'Kaalai vanakkam', meaning: 'Good morning' },
  { language: 'Spanish', text: 'Buenos dias', meaning: 'Good morning' },
  { language: 'German', text: 'Guten Morgen', meaning: 'Good morning' },
  { language: 'Italian', text: 'Buongiorno', meaning: 'Good morning' },
];

export async function getGreetingConfig(): Promise<GreetingConfig> {
  const s = await getSetting<Partial<GreetingConfig> | null>(CFG_KEY, null);
  return {
    enabled: s?.enabled ?? true,
    name: s?.name ?? '',
    list: s?.list && s.list.length > 0 ? s.list : DEFAULT_GREETINGS,
  };
}

export async function setGreetingConfig(patch: Partial<GreetingConfig>): Promise<void> {
  const cur = await getGreetingConfig();
  await setSetting(CFG_KEY, { ...cur, ...patch });
}

interface TodayGreeting {
  date: string;
  greeting: Greeting;
}

/** Same greeting all day; a new random one each new day. */
export async function greetingForDate(dateIso: string): Promise<Greeting | null> {
  const cfg = await getGreetingConfig();
  if (!cfg.enabled || cfg.list.length === 0) return null;

  const today = await getSetting<TodayGreeting | null>(TODAY_KEY, null);
  if (today && today.date === dateIso) return today.greeting;

  let used = (await getSetting<string[] | null>(USED_KEY, null)) ?? [];
  const keyOf = (g: Greeting) => `${g.language}|${g.text}`;
  let pool = cfg.list.filter((g) => !used.includes(keyOf(g)));
  if (pool.length === 0) {
    used = [];
    pool = cfg.list;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  await setSetting(USED_KEY, [...used, keyOf(pick)]);
  await setSetting(TODAY_KEY, { date: dateIso, greeting: pick });
  return pick;
}

export function greetingLine(g: Greeting, name: string): string {
  return name.trim() ? `${g.text}, ${name.trim()}` : g.text;
}
