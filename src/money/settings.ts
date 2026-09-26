import { getSetting, setSetting } from '../data/settings';

export interface MoneyConfig {
  /** Default daily transport / pocket budget (₹). Fully editable. */
  dailyBudget: number;
  currencySymbol: string;
  /** Suggested expense categories — user can still type custom. */
  expenseCategories: string[];
  enabled: boolean;
}

export const MONEY_CONFIG_KEY = 'money.config';

export const DEFAULT_MONEY_CONFIG: MoneyConfig = {
  dailyBudget: 200,
  currencySymbol: '₹',
  expenseCategories: [
    'bus',
    'canteen',
    'snacks',
    'food',
    'transport',
    'custom',
  ],
  enabled: true,
};

export async function getMoneyConfig(): Promise<MoneyConfig> {
  const stored = await getSetting<Partial<MoneyConfig> | null>(MONEY_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_MONEY_CONFIG };
  return {
    ...DEFAULT_MONEY_CONFIG,
    ...stored,
    expenseCategories: stored.expenseCategories ?? DEFAULT_MONEY_CONFIG.expenseCategories,
  };
}

export async function setMoneyConfig(patch: Partial<MoneyConfig>): Promise<MoneyConfig> {
  const current = await getMoneyConfig();
  const next = { ...current, ...patch };
  await setSetting(MONEY_CONFIG_KEY, next);
  return next;
}
