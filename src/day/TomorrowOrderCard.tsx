/**
 * Night prompt: set tomorrow's day mode + college day-order number (1–6).
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getTomorrowOrder,
  setTomorrowOrder,
  TOMORROW_OPTIONS,
  type TomorrowDayOrder,
  type TomorrowOrderState,
} from './spendPrompts';
import { collegeDayStatusesRepo } from '../data/repository';
import { setDayOrderForDate, suggestNextDayOrder, getDayOrderForDate } from '../college/dayOrder';
import { assignDayType, type DayTypeKey } from './dayTypes';
import { rescheduleAllNotifications } from '../notifications/scheduler';

const ORDER_TO_TYPE: Record<string, DayTypeKey> = {
  college: 'normal',
  bunk: 'bunk',
  event: 'event',
  rest: 'rest',
  leave: 'rest',
  deep_work: 'deep_work',
  coimbatore_stay: 'coimbatore_stay',
};
const DURATION_CHOICES = [1, 2, 3, 5, 7, 14];

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function TomorrowOrderCard({ date = new Date() }: { date?: Date }) {
  const todayIso = toIsoDate(date);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const [state, setState] = useState<TomorrowOrderState | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [needOrder, setNeedOrder] = useState(false);
  const [savedOrderNum, setSavedOrderNum] = useState<number | null>(null);
  const [pendingLong, setPendingLong] = useState<TomorrowDayOrder | null>(null);

  const reload = useCallback(async () => {
    setState(await getTomorrowOrder(tomorrowIso));
    setSavedOrderNum(await getDayOrderForDate(tomorrowIso));
  }, [tomorrowIso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour = new Date().getHours();
  const isNight = hour >= 21 || hour < 5;

  useEffect(() => {
    if (!isNight || state === undefined) return;
    if (state?.order && state.order !== 'unset') return;
    const key = `tomorrow-order-notified-${tomorrowIso}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("Tomorrow's day order", {
          body: 'Campus, Early Exit, Event, Recharge, Deep Work or Coimbatore Stay? Set it before sleep.',
        });
      }
    } catch {
      /* ignore */
    }
  }, [isNight, state, tomorrowIso, tick]);

  const applyPick = async (order: TomorrowDayOrder, days = 1) => {
    const next = await setTomorrowOrder(tomorrowIso, order);
    setState(next);

    const typeKey = ORDER_TO_TYPE[order];
    if (typeKey) await assignDayType(tomorrowIso, typeKey, days);

    const rows = await collegeDayStatusesRepo.list();
    const existing = rows.find((r) => r.date === tomorrowIso && !r.deleted);
    if (order === 'bunk' || order === 'college') {
      const status = order === 'bunk' ? 'bunked' : 'attended';
      if (existing) {
        await collegeDayStatusesRepo.update(existing.id, { status });
      } else {
        await collegeDayStatusesRepo.create({ date: tomorrowIso, status });
      }
    } else if (existing && existing.status === 'bunked') {
      // Switching away from Early Exit: drop the stale bunk status.
      await collegeDayStatusesRepo.remove(existing.id);
    }
    setNeedOrder(order === 'college');
    setPendingLong(null);
    void rescheduleAllNotifications();
  };

  const pick = async (order: TomorrowDayOrder) => {
    if (order === 'deep_work' || order === 'coimbatore_stay') {
      setPendingLong(order); // ask how many days first
      return;
    }
    await applyPick(order, 1);
  };

  const pickDayOrderNum = async (n: number) => {
    await setDayOrderForDate(tomorrowIso, n);
    setSavedOrderNum(n);
    setNeedOrder(false);
  };

  if (state === undefined) return null;
  if (!isNight && hour < 19 && !state) return null;

  if (state?.order && state.order !== 'unset' && !needOrder) {
    const opt = TOMORROW_OPTIONS.find((o) => o.id === state.order);
    return (
      <Card style={{ marginBottom: 12, opacity: 0.9 }}>
        <strong>🌙 Tomorrow set</strong>
        <p style={{ margin: '6px 0 8px', fontSize: 'var(--text-sm)' }}>
          {opt?.emoji} {opt?.label ?? state.order}
          {state.order === 'college' && savedOrderNum != null && (
            <> · day order <strong>{savedOrderNum}</strong></>
          )}
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setState({ ...state, order: 'unset' });
            setNeedOrder(false);
          }}
        >
          Change
        </Button>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      <strong>🌙 Tomorrow&apos;s plan</strong>
      <p
        style={{
          margin: '4px 0 12px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Before sleep, pick tomorrow's day type. Any day can be any type. For Campus Day, also pick the day order 1–6.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TOMORROW_OPTIONS.map((o) => (
          <Button key={o.id} variant="secondary" onClick={() => pick(o.id)}>
            {o.emoji} {o.label}
          </Button>
        ))}
      </div>
      {pendingLong && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>
            {pendingLong === 'deep_work'
              ? 'How many days of Deep Work, starting tomorrow?'
              : 'How many days in Coimbatore, starting tomorrow?'}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DURATION_CHOICES.map((n) => (
              <Button key={n} variant="primary" onClick={() => applyPick(pendingLong, n)}>
                {n} {n === 1 ? 'day' : 'days'}
              </Button>
            ))}
          </div>
        </div>
      )}
      {needOrder && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>
            Day order tomorrow? (1 = first row on timetable)
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Button key={n} variant="primary" onClick={() => pickDayOrderNum(n)}>
                {n}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={async () => {
                const n = await suggestNextDayOrder(tomorrowIso);
                await pickDayOrderNum(n);
              }}
            >
              Suggest next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
