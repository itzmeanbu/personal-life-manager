/**
 * Timed spend prompts for Day Brief — commute, break, lunch, tea/canteen.
 * Answers log into moneyTransactions (same store as Money module).
 */
import { getSetting, setSetting } from '../data/settings';
import { moneyTransactionsRepo } from '../data/repository';

const STATE_KEY = 'day.spendPrompts.v1';

export type SpendPromptId =
  | 'commute_morning'
  | 'break_1050'
  | 'lunch_1150'
  | 'tea_1630'
  | 'commute_evening';

export interface SpendPromptDef {
  id: SpendPromptId;
  /** Minutes from midnight when this prompt becomes active */
  startMin: number;
  /** Minutes from midnight when it stops being the primary ask (still show if unanswered until next day) */
  endMin: number;
  question: string;
  /** If true, first ask yes/no (e.g. did you go to canteen?) then amount */
  yesNoFirst: boolean;
  yesNoLabel?: string;
  category: string;
  /** Browser notification title when window opens */
  notifyTitle: string;
  notifyBody: string;
}

export const SPEND_PROMPTS: SpendPromptDef[] = [
  {
    id: 'commute_morning',
    startMin: 7 * 60, // 07:00
    endMin: 9 * 60 + 30, // 09:30
    question: 'How much did you spend for commute?',
    yesNoFirst: false,
    category: 'transport',
    notifyTitle: 'Commute spend',
    notifyBody: 'Before 9 — log what you spent getting to college.',
  },
  {
    id: 'break_1050',
    startMin: 10 * 60 + 50,
    endMin: 11 * 60 + 20,
    question: 'Break — did you buy anything?',
    yesNoFirst: true,
    yesNoLabel: 'Did you spend during break?',
    category: 'snacks',
    notifyTitle: 'Break check',
    notifyBody: '10:50–11:00 break — any spend?',
  },
  {
    id: 'lunch_1150',
    startMin: 11 * 60 + 50,
    endMin: 13 * 60 + 30,
    question: 'Lunch — how much did you spend?',
    yesNoFirst: true,
    yesNoLabel: 'Did you eat / buy lunch?',
    category: 'food',
    notifyTitle: 'Lunch spend',
    notifyBody: 'Around 11:50 — log lunch if you spent.',
  },
  {
    id: 'tea_1630',
    startMin: 16 * 60 + 30,
    endMin: 18 * 60,
    question: 'Tea stall / canteen — how much?',
    yesNoFirst: true,
    yesNoLabel: 'Did you go to canteen / tea stall?',
    category: 'canteen',
    notifyTitle: 'Canteen / tea',
    notifyBody: 'After 4:30 — did you go to canteen? Log the amount.',
  },
  {
    id: 'commute_evening',
    startMin: 16 * 60, // after 4
    endMin: 21 * 60,
    question: 'How much did you spend for commute (return)?',
    yesNoFirst: false,
    category: 'transport',
    notifyTitle: 'Evening commute',
    notifyBody: 'After 4 — log return commute spend.',
  },
];

export interface SpendPromptAnswer {
  /** null = not answered; false = said no (no spend); true = logged amount */
  answered: boolean | null;
  /** User said no to yes/no first */
  declined?: boolean;
  amount?: number;
  loggedTxId?: string;
  answeredAt?: string;
}

export interface SpendPromptsState {
  date: string;
  answers: Partial<Record<SpendPromptId, SpendPromptAnswer>>;
  /** Prompt ids we already fired a browser notification for today */
  notified: SpendPromptId[];
}

function empty(date: string): SpendPromptsState {
  return { date, answers: {}, notified: [] };
}

export async function getSpendPromptsState(dateIso: string): Promise<SpendPromptsState> {
  const s = await getSetting<SpendPromptsState | null>(STATE_KEY, null);
  if (!s || s.date !== dateIso) return empty(dateIso);
  return s;
}

export async function setSpendPromptsState(state: SpendPromptsState): Promise<void> {
  await setSetting(STATE_KEY, state);
}

export function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Active unanswered prompts in the current time window (primary first). */
export function activeSpendPrompts(
  now: Date,
  state: SpendPromptsState
): SpendPromptDef[] {
  const m = minutesNow(now);
  return SPEND_PROMPTS.filter((p) => {
    const ans = state.answers[p.id];
    if (ans?.answered) return false;
    if (ans?.declined) return false;
    return m >= p.startMin && m <= p.endMin;
  });
}

/** Mark notification fired so we don't spam. */
export async function markNotified(
  dateIso: string,
  id: SpendPromptId
): Promise<SpendPromptsState> {
  const s = await getSpendPromptsState(dateIso);
  if (s.notified.includes(id)) return s;
  const next = { ...s, date: dateIso, notified: [...s.notified, id] };
  await setSpendPromptsState(next);
  return next;
}

export async function answerSpendNo(
  dateIso: string,
  id: SpendPromptId
): Promise<SpendPromptsState> {
  const s = await getSpendPromptsState(dateIso);
  const next: SpendPromptsState = {
    ...s,
    date: dateIso,
    answers: {
      ...s.answers,
      [id]: {
        answered: true,
        declined: true,
        answeredAt: new Date().toISOString(),
      },
    },
  };
  await setSpendPromptsState(next);
  return next;
}

export async function answerSpendAmount(
  dateIso: string,
  id: SpendPromptId,
  amount: number,
  category: string
): Promise<SpendPromptsState> {
  const n = Math.round(amount * 100) / 100;
  if (!(n > 0)) throw new Error('amount');

  const tx = await moneyTransactionsRepo.create({
    date: dateIso,
    type: 'expense',
    amount: n,
    category,
    note: `Day Brief · ${id}`,
    paidBy: 'self',
  });

  const s = await getSpendPromptsState(dateIso);
  const next: SpendPromptsState = {
    ...s,
    date: dateIso,
    answers: {
      ...s.answers,
      [id]: {
        answered: true,
        amount: n,
        loggedTxId: tx.id,
        answeredAt: new Date().toISOString(),
      },
    },
  };
  await setSpendPromptsState(next);
  return next;
}

/** Tomorrow day-order selection (night). */
export type TomorrowDayOrder =
  | 'college'
  | 'leave'
  | 'coimbatore_stay'
  | 'bunk'
  | 'event'
  | 'rest'
  | 'coding'
  | 'coimbatore_stay'
  | 'unset';

const TOMORROW_KEY = 'day.tomorrowOrder.v1';

export interface TomorrowOrderState {
  /** Date this was set for (the "tomorrow" iso when saved from tonight) */
  forDate: string;
  order: TomorrowDayOrder;
  setAt: string;
}

export async function getTomorrowOrder(forDateIso: string): Promise<TomorrowOrderState | null> {
  const s = await getSetting<TomorrowOrderState | null>(TOMORROW_KEY, null);
  if (!s || s.forDate !== forDateIso) return null;
  return s;
}

export async function setTomorrowOrder(
  forDateIso: string,
  order: TomorrowDayOrder
): Promise<TomorrowOrderState> {
  const next: TomorrowOrderState = {
    forDate: forDateIso,
    order,
    setAt: new Date().toISOString(),
  };
  await setSetting(TOMORROW_KEY, next);
  return next;
}

export const TOMORROW_OPTIONS: { id: TomorrowDayOrder; label: string; emoji: string }[] = [
  { id: 'college', label: 'College', emoji: '🎓' },
  { id: 'leave', label: 'Leave / holiday', emoji: '🏠' },
  { id: 'coimbatore_stay', label: 'Coimbatore stay', emoji: '🌆' },
  { id: 'bunk', label: 'Partial Attendance Day', emoji: '🏃' },
  { id: 'event', label: 'Campus Function Day', emoji: '🎉' },
  { id: 'rest', label: 'Rest & Recharge Day', emoji: '🛋️' },
  { id: 'coding', label: 'Coding Focus Day', emoji: '💻' },
  { id: 'coimbatore_stay', label: 'Coimbatore Stay', emoji: '🌆' },
];

/** Default college period slots (editable later via settings). */
export interface PeriodSlot {
  id: string;
  label: string;
  startMin: number;
  endMin: number;
}

export const DEFAULT_PERIODS: PeriodSlot[] = [
  { id: 'p1', label: 'Period 1', startMin: 9 * 60, endMin: 9 * 60 + 50 },
  { id: 'p2', label: 'Period 2', startMin: 9 * 60 + 50, endMin: 10 * 60 + 40 },
  { id: 'break1', label: 'Break', startMin: 10 * 60 + 40, endMin: 11 * 60 },
  { id: 'p3', label: 'Period 3', startMin: 11 * 60, endMin: 11 * 60 + 50 },
  { id: 'lunch', label: 'Lunch', startMin: 11 * 60 + 50, endMin: 12 * 60 + 40 },
  { id: 'p4', label: 'Period 4', startMin: 12 * 60 + 40, endMin: 13 * 60 + 30 },
  { id: 'p5', label: 'Period 5', startMin: 13 * 60 + 30, endMin: 14 * 60 + 20 },
  { id: 'p6', label: 'Period 6', startMin: 14 * 60 + 20, endMin: 15 * 60 + 10 },
  { id: 'p7', label: 'Period 7', startMin: 15 * 60 + 10, endMin: 16 * 60 },
];

export function currentPeriod(now = new Date(), periods = DEFAULT_PERIODS): PeriodSlot | null {
  const m = minutesNow(now);
  return periods.find((p) => m >= p.startMin && m < p.endMin) ?? null;
}

export function formatMinHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
