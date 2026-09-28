/**
 * Morning Greeting — full-page overlay shown before the user has logged a
 * wake time for today. Surfaces the greeting big, morning to-dos, things to
 * take (if attending college), and today's schedule preview (if attending).
 * "I'm up" logs day.wakeTime.v1 and dismisses; won't show again same date.
 */
import { useEffect, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { toIsoDate } from '../routine/engine';
import { Button } from '../components/ui/Button';
import { itemsForSlot, type AskItem } from '../day/dayAsks';
import { getWakeTime, setWakeTime, getTomorrowOrder } from '../day/spendPrompts';
import { getDayOrderForDate } from '../college/dayOrder';
import { scheduleForDayOrder, formatMinHm } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { collegeDayStatusesRepo } from '../data/repository';
import './home.css';

export function MorningGreeting() {
  const today = useToday();
  const iso = toIsoDate(today.date);
  const hour = today.date.getHours();

  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [attending, setAttending] = useState(false);
  const [todos, setTodos] = useState<AskItem[]>([]);
  const [things, setThings] = useState<AskItem[]>([]);
  const [dayOrder, setDayOrder] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const wake = await getWakeTime(iso);
      if (wake) {
        setDismissed(true);
        setChecked(true);
        return;
      }

      const order = await getTomorrowOrder(iso);
      let isAttending = order?.order === 'college';
      if (!order || order.order === 'unset') {
        const rows = await collegeDayStatusesRepo.list();
        const row = rows.find((r) => r.date === iso && !r.deleted);
        isAttending = row?.status === 'attended' || row?.status === 'left_early';
      }
      setAttending(isAttending);

      setTodos(await itemsForSlot('morning'));
      if (isAttending) {
        setThings(await itemsForSlot('leave'));
        setDayOrder(await getDayOrderForDate(iso));
      }
      setChecked(true);
    })();
  }, [iso]);

  if (!checked || dismissed) return null;
  // Broad morning band — the point of this screen is to capture the wake
  // time itself, so it can't depend on it. Fixed cap at 11:00 either way.
  if (hour < 4 || hour >= 11) return null;

  const schedule = attending && dayOrder ? scheduleForDayOrder(dayOrder) : [];

  const imUp = async () => {
    await setWakeTime(iso);
    setDismissed(true);
  };

  return (
    <div className="morning-greeting" role="dialog" aria-label="Morning greeting">
      <div className="morning-greeting__sheet">
        <div className="morning-greeting__greeting">{today.greeting}</div>
        <div className="morning-greeting__day">{today.dayName}</div>

        {todos.length > 0 && (
          <div className="morning-greeting__section">
            <strong>Morning</strong>
            <ul>
              {todos.map((t) => (
                <li key={t.id}>{t.label}</li>
              ))}
            </ul>
          </div>
        )}

        {attending && things.length > 0 && (
          <div className="morning-greeting__section">
            <strong>Take with you</strong>
            <ul>
              {things.map((t) => (
                <li key={t.id}>{t.label}</li>
              ))}
            </ul>
          </div>
        )}

        {attending && schedule.length > 0 && (
          <div className="morning-greeting__section">
            <strong>Today's schedule{dayOrder ? ` (order ${dayOrder})` : ''}</strong>
            <ul>
              {schedule.map(({ slot, line }) => (
                <li key={slot.id}>
                  {formatHm12(formatMinHm(slot.startMin))} — {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="primary" onClick={imUp}>
          I&apos;m up
        </Button>
      </div>
    </div>
  );
}
