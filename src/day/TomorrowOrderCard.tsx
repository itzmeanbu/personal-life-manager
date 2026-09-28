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
import { collegeDayStatusesRepo, dayAssignmentsRepo, dayProfilesRepo } from '../data/repository';
import { getDemoDate } from '../demo/DemoTools';
import { setDayOrderForDate, suggestNextDayOrder, getDayOrderForDate } from '../college/dayOrder';

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function TomorrowOrderCard({ date = new Date(), onConfigured }: { date?: Date; onConfigured?: () => void }) {
  const todayIso = toIsoDate(date);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const [state, setState] = useState<TomorrowOrderState | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [needOrder, setNeedOrder] = useState(false);
  const [savedOrderNum, setSavedOrderNum] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const next = await getTomorrowOrder(tomorrowIso);
    const orderNum = await getDayOrderForDate(tomorrowIso);
    setState(next);
    setSavedOrderNum(orderNum);
    setNeedOrder(next?.order === 'college' && orderNum == null);
  }, [tomorrowIso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour = getDemoDate().getHours();
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
          body: 'Choose tomorrow: Academic, Partial Attendance, Campus Function, Rest, Coding, or Coimbatore Stay.',
        });
      }
    } catch {
      /* ignore */
    }
  }, [isNight, state, tomorrowIso, tick]);

  const pick = async (order: TomorrowDayOrder) => {
    const next = await setTomorrowOrder(tomorrowIso, order);
    setState(next);

    const profiles = await dayProfilesRepo.list();
    const profileKey = order === 'college' ? 'normal' : order === 'bunk' ? 'bunk' : order;
    const profile = profiles.find((p) => !p.deleted && p.enabled && p.systemKey === profileKey);
    if (profile) {
      const assignments = await dayAssignmentsRepo.list();
      const existingAssignment = assignments.find((a) => a.date === tomorrowIso && !a.deleted);
      if (existingAssignment) {
        await dayAssignmentsRepo.update(existingAssignment.id, { profileId: profile.id, checklistDone: [] });
      } else {
        await dayAssignmentsRepo.create({ date: tomorrowIso, profileId: profile.id, checklistDone: [] });
      }
    }
    if (order === 'bunk' || order === 'college') {
      const rows = await collegeDayStatusesRepo.list();
      const existing = rows.find((r) => r.date === tomorrowIso && !r.deleted);
      const status = order === 'bunk' ? 'bunked' : 'attended';
      if (existing) await collegeDayStatusesRepo.update(existing.id, { status });
      else await collegeDayStatusesRepo.create({ date: tomorrowIso, status });
    }
    setNeedOrder(order === 'college');
    if (order !== 'college') onConfigured?.();
  };

  const pickDayOrderNum = async (n: number) => {
    await setDayOrderForDate(tomorrowIso, n);
    setSavedOrderNum(n);
    setNeedOrder(false);
    onConfigured?.();
  };

  if (state === undefined) return null;
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
        Before sleep — pick mode. If College, also pick day order 1–6 (row on your TT).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TOMORROW_OPTIONS.map((o) => (
          <Button key={o.id} variant="secondary" onClick={() => pick(o.id)}>
            {o.emoji} {o.label}
          </Button>
        ))}
      </div>
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
