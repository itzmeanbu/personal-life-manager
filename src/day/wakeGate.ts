/**
 * Logging the wake-up: stores the wake time for the day, ticks the
 * "Wake up" routine and the "Actually out of bed" ask so the person isn't
 * asked the same thing twice, then tells the rest of the app.
 */
import { completionRecordsRepo, routinesRepo } from '../data/repository';
import { isRoutineScheduledOnDate, toIsoDate } from '../routine/engine';
import { setWakeTime } from './spendPrompts';
import { toggleAskDone } from './dayAsks';

const WAKE_ROUTINE_RE = /^\s*(wake\s*up|woke\s*up|wake)\s*$/i;

/** Event fired after a wake time is saved — Home and the gate listen for it. */
export const WAKE_LOGGED_EVENT = 'wake-logged';

export async function logWake(date: Date, at: Date): Promise<void> {
  const iso = toIsoDate(date);
  await setWakeTime(iso, at);
  await toggleAskDone(iso, 'm_wake', true);

  const [routines, completions] = await Promise.all([
    routinesRepo.list(),
    completionRecordsRepo.list(),
  ]);
  const wakeRoutine = routines.find(
    (r) => !r.deleted && WAKE_ROUTINE_RE.test(r.title) && isRoutineScheduledOnDate(r, date)
  );
  if (wakeRoutine) {
    const existing = completions.find(
      (c) =>
        !c.deleted &&
        c.refType === 'routine' &&
        c.refId === wakeRoutine.id &&
        c.date === iso
    );
    if (existing) {
      await completionRecordsRepo.update(existing.id, { status: 'done' });
    } else {
      await completionRecordsRepo.create({
        date: iso,
        refType: 'routine',
        refId: wakeRoutine.id,
        status: 'done',
      });
    }
  }

  window.dispatchEvent(new Event(WAKE_LOGGED_EVENT));
}
