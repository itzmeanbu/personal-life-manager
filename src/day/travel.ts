/**
 * Bus / travel log for the day: boarded, reached college, left college,
 * reached home. Fares go into the money module (category "bus").
 */
import { getSetting, setSetting } from '../data/settings';
import { moneyTransactionsRepo } from '../data/repository';

const KEY = 'day.travel.v1';
const FARE_KEY = 'day.travel.fare.v1';

export type TravelKind = 'boarded_out' | 'reached_college' | 'boarded_back' | 'reached_home';

export interface TravelEvent {
  kind: TravelKind;
  at: string; // ISO time
  fare?: number;
}

export interface TravelState {
  date: string;
  events: TravelEvent[];
}

export const TRAVEL_FLOW: { kind: TravelKind; label: string; emoji: string }[] = [
  { kind: 'boarded_out', label: 'Boarded bus', emoji: '🚌' },
  { kind: 'reached_college', label: 'Reached college', emoji: '🏫' },
  { kind: 'boarded_back', label: 'Boarded bus home', emoji: '🚌' },
  { kind: 'reached_home', label: 'Reached home', emoji: '🏠' },
];

export async function getTravel(dateIso: string): Promise<TravelState> {
  const s = await getSetting<TravelState | null>(KEY, null);
  if (!s || s.date !== dateIso) return { date: dateIso, events: [] };
  return s;
}

export function nextTravelStep(state: TravelState): (typeof TRAVEL_FLOW)[number] | null {
  const done = new Set(state.events.map((e) => e.kind));
  return TRAVEL_FLOW.find((f) => !done.has(f.kind)) ?? null;
}

export function hasBoardedOut(state: TravelState): boolean {
  return state.events.some((e) => e.kind === 'boarded_out');
}

export async function getDefaultFare(): Promise<number> {
  return getSetting<number>(FARE_KEY, 0);
}
export async function setDefaultFare(n: number): Promise<void> {
  await setSetting(FARE_KEY, Math.max(0, n));
}

export async function logTravel(
  dateIso: string,
  kind: TravelKind,
  fare?: number
): Promise<TravelState> {
  const s = await getTravel(dateIso);
  const ev: TravelEvent = { kind, at: new Date().toISOString() };
  if (fare && fare > 0) {
    ev.fare = fare;
    await moneyTransactionsRepo.create({
      date: dateIso,
      type: 'expense',
      amount: fare,
      category: 'bus',
      note: `Day Brief · travel_${kind}`,
      paidBy: 'self',
    });
  }
  const next: TravelState = {
    date: dateIso,
    events: [...s.events.filter((e) => e.kind !== kind), ev],
  };
  await setSetting(KEY, next);
  return next;
}

export async function undoLastTravel(dateIso: string): Promise<TravelState> {
  const s = await getTravel(dateIso);
  const next = { date: dateIso, events: s.events.slice(0, -1) };
  await setSetting(KEY, next);
  return next;
}
