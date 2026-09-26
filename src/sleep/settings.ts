import { getSetting, setSetting } from '../data/settings';

export interface SleepConfig {
  enabled: boolean;
  /** Target bedtime "HH:mm" — default around 22:00, fully editable. */
  targetBedtime: string;
  /**
   * Minutes after target still counted as on-time.
   * No fixed “% late nights” is stored or enforced.
   */
  toleranceMinutes: number;
  reminderEnabled: boolean;
  /** "HH:mm" reminder before target (optional). */
  reminderTime: string;
  /** Optional second soft target (e.g. 23:00) — informational only. */
  secondaryTargetBedtime: string;
}

export const SLEEP_CONFIG_KEY = 'sleep.config';

export const DEFAULT_SLEEP_CONFIG: SleepConfig = {
  enabled: true,
  targetBedtime: '22:00',
  toleranceMinutes: 30,
  reminderEnabled: false,
  reminderTime: '21:30',
  secondaryTargetBedtime: '23:00',
};

export async function getSleepConfig(): Promise<SleepConfig> {
  const stored = await getSetting<Partial<SleepConfig> | null>(SLEEP_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_SLEEP_CONFIG };
  return { ...DEFAULT_SLEEP_CONFIG, ...stored };
}

export async function setSleepConfig(patch: Partial<SleepConfig>): Promise<SleepConfig> {
  const current = await getSleepConfig();
  const next = { ...current, ...patch };
  await setSetting(SLEEP_CONFIG_KEY, next);
  return next;
}
