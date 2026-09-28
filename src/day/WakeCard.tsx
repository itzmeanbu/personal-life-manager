/**
 * "I'm awake" + random good-morning + water/eat reminders (every day type)
 * + Wake Coach plan (Campus Day / Early Exit Day only).
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import { formatHm12 } from '../lib/timeFormat';
import {
  clearWake,
  coach,
  dateMinutes,
  getWakeCoachConfig,
  getWakeDone,
  getWakeTime,
  logWake,
  minToHm,
  setWakeDone,
  type CoachResult,
  type WakeCoachConfig,
  type WakeDone,
  DEFAULT_WAKE_COACH,
} from './wakeCoach';
import { getGreetingConfig, greetingForDate, greetingLine, type Greeting } from './greeting';
import { getTravel, hasBoardedOut } from './travel';
import { isCoachDay } from './dayContext';
import { rescheduleAllNotifications } from '../notifications/scheduler';

export function WakeCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [cfg, setCfg] = useState<WakeCoachConfig>(DEFAULT_WAKE_COACH);
  const [wakeAt, setWakeAt] = useState<Date | null>(null);
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [name, setName] = useState('');
  const [done, setDone] = useState<WakeDone>({ date: iso, water: false, eat: false });
  const [coachDay, setCoachDay] = useState(false);
  const [boarded, setBoarded] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    setCfg(await getWakeCoachConfig());
    setWakeAt(await getWakeTime(iso));
    setDone(await getWakeDone(iso));
    setCoachDay(await isCoachDay(date));
    setBoarded(hasBoardedOut(await getTravel(iso)));
    const gc = await getGreetingConfig();
    setName(gc.name);
    setGreeting(await greetingForDate(iso));
  }, [iso, date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setTick((x) => x + 1);
      void getTravel(iso).then((s) => setBoarded(hasBoardedOut(s)));
    }, 30_000);
    return () => window.clearInterval(t);
  }, [iso]);

  void tick;
  const now = new Date();

  const awake = async () => {
    await logWake(iso, new Date());
    await reload();
    void rescheduleAllNotifications();
  };
  const undoAwake = async () => {
    await clearWake(iso);
    await setWakeDone({ date: iso, water: false, eat: false });
    await reload();
    void rescheduleAllNotifications();
  };
  const mark = async (k: 'water' | 'eat') => {
    const next = { ...done, date: iso, [k]: !done[k] };
    await setWakeDone(next);
    setDone(next);
  };

  const result: CoachResult | null =
    coachDay && cfg.enabled ? coach(now, wakeAt, boarded, cfg) : null;

  const waterAt = wakeAt ? minToHm(dateMinutes(wakeAt) + cfg.waterAfterMin) : null;
  const eatAt = wakeAt ? minToHm(dateMinutes(wakeAt) + cfg.eatAfterMin) : null;

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      {greeting && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-lg, 20px)', fontWeight: 700 }}>
            {greetingLine(greeting, name)}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {greeting.language} · {greeting.meaning}
          </div>
        </div>
      )}

      {!wakeAt ? (
        <>
          <Button onClick={awake} style={{ width: '100%' }}>
            ☀️ I&apos;m awake
          </Button>
          {result && (
            <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>{result.message}</p>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)' }}>
              Awake at <strong>{formatHm12(minToHm(dateMinutes(wakeAt)))}</strong>
            </span>
            <Button variant="ghost" onClick={undoAwake}>
              Undo
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <Button variant={done.water ? 'ghost' : 'secondary'} onClick={() => mark('water')}>
              {done.water ? '✅' : '💧'} Water {waterAt ? `(${formatHm12(waterAt)})` : ''}
            </Button>
            <Button variant={done.eat ? 'ghost' : 'secondary'} onClick={() => mark('eat')}>
              {done.eat ? '✅' : '🍽️'} Eat something {eatAt ? `(${formatHm12(eatAt)})` : ''}
            </Button>
          </div>
        </>
      )}

      {result && wakeAt && (
        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 'var(--text-sm)' }}>
            {result.stage === 'on_track' && '🟢 Plan A'}
            {result.stage === 'plan_b' && '🟡 Plan B'}
            {result.stage === 'rush' && '🔴 Rush'}
            {result.stage === 'missed' && '⚪ Bus missed'}
            {result.stage === 'boarded' && '🚌 On the bus'}
          </strong>
          <p style={{ margin: '4px 0 8px', fontSize: 'var(--text-sm)' }}>{result.message}</p>

          {result.bus && result.minutesToBus !== null && (
            <p style={{ margin: '0 0 8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Bus {formatHm12(result.bus)} · leave by {result.leaveBy ? formatHm12(result.leaveBy) : ''} ·{' '}
              {result.minutesToBus} min left
            </p>
          )}

          {result.steps.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.steps.map((s) => (
                <li
                  key={s.label}
                  style={{
                    fontSize: 'var(--text-sm)',
                    marginBottom: 4,
                    opacity: s.dropped ? 0.5 : 1,
                    textDecoration: s.dropped ? 'line-through' : 'none',
                  }}
                >
                  {s.dropped ? `${s.label} (skip today)` : `${formatHm12(s.start)} to ${formatHm12(s.end)}  ${s.label}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
