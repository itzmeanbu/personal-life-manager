/**
 * Contextual day asks — morning, before leave (college/out), before night.
 * Defaults + user-added items (editable).
 */
import { getSetting, setSetting } from '../data/settings';

const STATE_KEY = 'day.asks.v1';
const CUSTOM_KEY = 'day.asks.custom.v1';

export type AskSlot = 'morning' | 'leave' | 'night';

export interface AskItem {
  id: string;
  label: string;
  enabled: boolean;
}

export interface DayAsksState {
  date: string;
  done: Record<string, boolean>;
  dismissed: Partial<Record<AskSlot, boolean>>;
}

export type CustomAsks = Record<AskSlot, AskItem[]>;

export const DEFAULT_ASKS: Record<AskSlot, AskItem[]> = {
  morning: [
    { id: 'm_wake', label: 'Actually out of bed', enabled: true },
    { id: 'm_water', label: 'First water / something light', enabled: true },
    { id: 'm_face', label: 'Face wash + treatment', enabled: true },
    { id: 'm_hair', label: 'Hair serum / hair', enabled: true },
    { id: 'm_sunscreen', label: 'Morning sunscreen', enabled: true },
    { id: 'm_lip', label: 'Lip balm', enabled: true },
    { id: 'm_phone', label: 'Phone charged enough', enabled: true },
  ],
  leave: [
    { id: 'l_id', label: 'ID / college card', enabled: true },
    { id: 'l_keys', label: 'Keys', enabled: true },
    { id: 'l_wallet', label: 'Wallet / UPI ready', enabled: true },
    { id: 'l_bottle', label: 'Water bottle filled', enabled: true },
    { id: 'l_books', label: 'Books / laptop / charger', enabled: true },
    { id: 'l_earphones', label: 'Earphones', enabled: false },
    { id: 'l_tell', label: 'Told someone if late', enabled: false },
  ],
  night: [
    { id: 'n_bath', label: 'Bath done', enabled: true },
    { id: 'n_treatment', label: 'Night face / hair treatment', enabled: true },
    { id: 'n_lip', label: 'Night lip balm', enabled: true },
    { id: 'n_charge', label: 'Phone on charge', enabled: true },
    { id: 'n_switch', label: 'Switch ON after plug', enabled: true },
    { id: 'n_bag', label: 'Bag ready for tomorrow', enabled: true },
    { id: 'n_clothes', label: 'Clothes for tomorrow', enabled: false },
    { id: 'n_alarm', label: 'Alarm set', enabled: true },
  ],
};

export function slotTitle(slot: AskSlot): string {
  switch (slot) {
    case 'morning':
      return 'Morning check';
    case 'leave':
      return 'Before you leave (college / out)';
    case 'night':
      return 'Before night';
  }
}

export function slotHint(slot: AskSlot): string {
  switch (slot) {
    case 'morning':
      return 'Quick yes/no so nothing like sunscreen slips.';
    case 'leave':
      return 'What to take — college or going out. Add anything.';
    case 'night':
      return 'Close the day so tomorrow is easier.';
  }
}

/**
 * When each slot is allowed to show + notify.
 * `morningStartMin` defaults to 05:00 but should be passed as the day's
 * logged wake time (see spendPrompts.getWakeTimeMinutes) once known, so the
 * morning window starts when the user actually got up instead of a fixed
 * clock time — same 11:00 end cap either way.
 */
export function isSlotActive(slot: AskSlot, now = new Date(), morningStartMin = 5 * 60): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  switch (slot) {
    case 'morning':
      return m >= morningStartMin && m < 11 * 60;
    case 'leave':
      return m >= 7 * 60 && m < 14 * 60;
    case 'night':
      return m >= 20 * 60 || m < 5 * 60; // 20:00–05:00
  }
}

export function suggestedSlot(now = new Date()): AskSlot {
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 10 * 60) return 'morning';
  if (m < 20 * 60) return 'leave';
  return 'night';
}

export async function getDayAsks(dateIso: string): Promise<DayAsksState> {
  const s = await getSetting<DayAsksState | null>(STATE_KEY, null);
  if (!s || s.date !== dateIso) {
    return { date: dateIso, done: {}, dismissed: {} };
  }
  return s;
}

export async function setDayAsks(state: DayAsksState): Promise<void> {
  await setSetting(STATE_KEY, state);
}

export async function getCustomAsks(): Promise<CustomAsks> {
  const s = await getSetting<CustomAsks | null>(CUSTOM_KEY, null);
  return {
    morning: s?.morning ?? [],
    leave: s?.leave ?? [],
    night: s?.night ?? [],
  };
}

export async function setCustomAsks(custom: CustomAsks): Promise<void> {
  await setSetting(CUSTOM_KEY, custom);
}

/** Defaults + user-added, enabled only */
export async function itemsForSlot(slot: AskSlot): Promise<AskItem[]> {
  const custom = await getCustomAsks();
  return [...DEFAULT_ASKS[slot], ...custom[slot]].filter((i) => i.enabled);
}

export async function addCustomAsk(slot: AskSlot, label: string): Promise<AskItem> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('empty');
  const custom = await getCustomAsks();
  const item: AskItem = {
    id: `c_${slot}_${Date.now()}`,
    label: trimmed,
    enabled: true,
  };
  custom[slot] = [...custom[slot], item];
  await setCustomAsks(custom);
  return item;
}

export async function removeCustomAsk(slot: AskSlot, id: string): Promise<void> {
  const custom = await getCustomAsks();
  custom[slot] = custom[slot].filter((i) => i.id !== id);
  await setCustomAsks(custom);
}

export async function toggleAskDone(
  dateIso: string,
  itemId: string,
  done: boolean
): Promise<DayAsksState> {
  const s = await getDayAsks(dateIso);
  const next = {
    ...s,
    date: dateIso,
    done: { ...s.done, [itemId]: done },
  };
  await setDayAsks(next);
  return next;
}

export async function dismissSlot(dateIso: string, slot: AskSlot): Promise<DayAsksState> {
  const s = await getDayAsks(dateIso);
  const next = {
    ...s,
    date: dateIso,
    dismissed: { ...s.dismissed, [slot]: true },
  };
  await setDayAsks(next);
  return next;
}
