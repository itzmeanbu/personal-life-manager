/**
 * Wake gate — the welcome page. Full screen, one question: "Did you wake up?"
 * The answer (now, or an earlier time) is saved as the day's wake time, ticks
 * the Wake up items, and everything after it runs off that time: the morning
 * block starts when you actually got up, not at a fixed 5:00.
 *
 * Shown from 04:00 until 15:00 while no wake time is logged for today.
 * "Not yet" hides it for a few minutes, then it asks again.
 */
import { useEffect, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { useNow } from '../hooks/useNow';
import { toIsoDate } from '../routine/engine';
import { Button } from '../components/ui/Button';
import { itemsForSlot, type AskItem } from '../day/dayAsks';
import { getWakeTime, getTomorrowOrder } from '../day/spendPrompts';
import { logWake, WAKE_LOGGED_EVENT } from '../day/wakeGate';
import { minToHm } from '../day/timeline';
import { getDayOrderForDate } from '../college/dayOrder';
import { scheduleForDayOrder, formatMinHm } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { collegeDayStatusesRepo } from '../data/repository';
import './home.css';
import './wakeGate.css';

const GATE_START_HOUR = 4;
const GATE_END_HOUR = 15;
const SNOOZE_MIN = 10;

export function MorningGreeting() {
  const today = useToday();
  const now = useNow(today.date);
  const iso = toIsoDate(today.date);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();

  const [checked, setChecked] = useState(false);
  const [logged, setLogged] = useState(false);
  const [attending, setAttending] = useState(false);
  const [things, setThings] = useState<AskItem[]>([]);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [earlier, setEarlier] = useState(false);
  const [time, setTime] = useState(() => minToHm(nowMin));
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const wake = await getWakeTime(iso);
      if (cancelled) return;
      if (wake) {
        setLogged(true);
        setChecked(true);
        return;
      }
      setLogged(false);

      const order = await getTomorrowOrder(iso);
      let isAttending = order?.order === 'college';
      if (!order || order.order === 'unset') {
        const rows = await collegeDayStatusesRepo.list();
        const row = rows.find((r) => r.date === iso && !r.deleted);
        isAttending = row?.status === 'attended' || row?.status === 'left_early';
      }
      if (cancelled) return;
      setAttending(isAttending);
      if (isAttending) {
        setThings(await itemsForSlot('leave'));
        setDayOrder(await getDayOrderForDate(iso));
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [iso]);

  // Wake time logged from anywhere else (e.g. Demo tools) closes the gate too.
  useEffect(() => {
    const onLogged = () => setLogged(true);
    window.addEventListener(WAKE_LOGGED_EVENT, onLogged);
    return () => window.removeEventListener(WAKE_LOGGED_EVENT, onLogged);
  }, []);

  if (!checked || logged) return null;
  if (hour < GATE_START_HOUR || hour >= GATE_END_HOUR) return null;
  if (snoozedUntil != null && now.getTime() < snoozedUntil) return null;

  const schedule = attending && dayOrder ? scheduleForDayOrder(dayOrder) : [];
  const hasPlan = attending && (things.length > 0 || schedule.length > 0);

  const saveWake = async (at: Date) => {
    setSaving(true);
    try {
      await logWake(today.date, at);
      setLogged(true);
    } finally {
      setSaving(false);
    }
  };

  const saveEarlier = () => {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    // Can't have woken up in the future.
    void saveWake(at.getTime() > now.getTime() ? new Date(now) : at);
  };

  return (
    <div className="wake-gate" role="dialog" aria-modal="true" aria-labelledby="wake-gate-question">
      <div className="wake-gate__inner">
        <div className="wake-gate__greeting">{today.greeting}</div>
        <h1 id="wake-gate-question" className="wake-gate__question">
          Did you wake up?
        </h1>
        <div className="wake-gate__meta">
          {today.dayName}, {formatHm12(minToHm(nowMin))}
        </div>

        <div className="wake-gate__actions">
          <Button variant="primary" disabled={saving} onClick={() => void saveWake(new Date(now))}>
            Yes, I&apos;m up
          </Button>

          {earlier ? (
            <div className="wake-gate__earlier">
              <label htmlFor="wake-gate-time">I woke up at</label>
              <input
                id="wake-gate-time"
                type="time"
                value={time}
                max={minToHm(nowMin)}
                onChange={(e) => setTime(e.target.value)}
              />
              <Button variant="secondary" disabled={saving || !time} onClick={saveEarlier}>
                Save
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setEarlier(true)}>
              I woke up earlier
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => setSnoozedUntil(now.getTime() + SNOOZE_MIN * 60_000)}
          >
            Not yet, ask again in {SNOOZE_MIN} min
          </Button>
        </div>

        {hasPlan && (
          <details className="wake-gate__plan">
            <summary>Today&apos;s plan</summary>
            {things.length > 0 && (
              <>
                <strong>Take with you</strong>
                <ul>
                  {things.map((t) => (
                    <li key={t.id}>{t.label}</li>
                  ))}
                </ul>
              </>
            )}
            {schedule.length > 0 && (
              <>
                <strong>Schedule{dayOrder ? ` (order ${dayOrder})` : ''}</strong>
                <ul>
                  {schedule.map(({ slot, line }) => (
                    <li key={slot.id}>
                      {formatHm12(formatMinHm(slot.startMin))} — {line}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
