/**
 * Live period notifications — fires an OS notification the moment the
 * clock crosses into a new period/break/lunch slot for today's day order.
 * Foreground-only (same limit as src/notify/engine.ts) — there is no
 * lock-screen push here, just an in-app Notification while the tab/app
 * is open.
 */
import { getSetting, setSetting } from '../data/settings';
import { toIsoDate } from '../routine/engine';
import { fireOsNotification } from '../notify/engine';
import { currentTimeSlot, type TimeSlot } from './timetable';

const FIRED_KEY = 'college.periodNotify.fired.v1';

interface FiredState {
  date: string;
  slotIds: string[];
}

async function getFired(dateIso: string): Promise<FiredState> {
  const s = await getSetting<FiredState | null>(FIRED_KEY, null);
  if (!s || s.date !== dateIso) return { date: dateIso, slotIds: [] };
  return s;
}

function titleForSlot(slot: TimeSlot): string {
  if (slot.kind === 'break') return 'Break started';
  if (slot.kind === 'lunch') return 'Lunch started';
  return `${slot.label} started`;
}

/**
 * Call this on a ~30s tick while status === 'attending'. Compares the
 * current time slot against the list already fired today and fires a new
 * notification exactly once per slot per date.
 */
export async function checkPeriodTransition(
  dayOrder: number | null,
  now = new Date()
): Promise<void> {
  if (!dayOrder) return;
  const slot = currentTimeSlot(now);
  if (!slot) return;

  const iso = toIsoDate(now);
  const fired = await getFired(iso);
  if (fired.slotIds.includes(slot.id)) return;

  fired.slotIds.push(slot.id);
  await setSetting(FIRED_KEY, fired);
  await fireOsNotification(titleForSlot(slot), slot.kind === 'class' ? `Day order ${dayOrder}` : '');
}
