/**
 * Night prompt: set tomorrow's day mode + college day-order number (1–6).
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getTomorrowOrder,
  setDayStatus,
  effectiveDayStatus,
  answerCodingFinished,
  isCodingFinished,
  TOMORROW_OPTIONS,
  type TomorrowDayOrder,
  type TomorrowOrderState,
} from './spendPrompts';
import { setDayOrderForDate, suggestNextDayOrder, getDayOrderForDate } from '../college/dayOrder';

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function TomorrowPlanInner({ date = new Date() }: { date?: Date }) {
  const todayIso = toIsoDate(date);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const [state, setState] = useState<TomorrowOrderState | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const [needOrder, setNeedOrder] = useState(false);
  const [savedOrderNum, setSavedOrderNum] = useState<number | null>(null);

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
          body: 'College, leave, Coimbatore stay, bunk, or coding? Set it before sleep.',
        });
      }
    } catch {
      /* ignore */
    }
  }, [isNight, state, tomorrowIso, tick]);

  const pick = async (order: TomorrowDayOrder) => {
    const next = await setDayStatus(tomorrowIso, order);
    setState(next);
    setNeedOrder(order === 'college');
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

/** Night check on a coding day: finished → back to normal tomorrow; not yet → coding continues. */
function CodingFinishedCard({ date }: { date: Date }) {
  const todayIso = toIsoDate(date);
  const [coding, setCoding] = useState(false);
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    void (async () => {
      setCoding((await effectiveDayStatus(todayIso)) === 'coding');
      const done = await isCodingFinished(todayIso);
      const tomorrow = await getTomorrowOrder(addDaysIso(todayIso, 1));
      setAnswer(done ? 'yes' : tomorrow?.order === 'coding' ? 'no' : null);
    })();
  }, [todayIso]);

  const hour = new Date().getHours();
  if (!coding || !(hour >= 19 || hour < 5)) return null;

  const answerIt = async (finished: boolean) => {
    await answerCodingFinished(todayIso, finished);
    setAnswer(finished ? 'yes' : 'no');
  };

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      <strong>💻 Coding finished?</strong>
      {answer ? (
        <p style={{ margin: '6px 0 8px', fontSize: 'var(--text-sm)' }}>
          {answer === 'yes'
            ? 'Done — tomorrow goes back to a normal day. Pick its mode below.'
            : 'Not yet — tomorrow continues as a coding day.'}
        </p>
      ) : (
        <p
          style={{
            margin: '4px 0 12px',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Yes ends coding mode. No keeps the same coding-day routine tomorrow.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant={answer === 'yes' ? 'primary' : 'secondary'} onClick={() => answerIt(true)}>
          Yes, finished
        </Button>
        <Button variant={answer === 'no' ? 'primary' : 'secondary'} onClick={() => answerIt(false)}>
          No, continue
        </Button>
      </div>
    </Card>
  );
}

export function TomorrowOrderCard({ date = new Date() }: { date?: Date }) {
  return (
    <>
      <CodingFinishedCard date={date} />
      <TomorrowPlanInner date={date} />
    </>
  );
}
