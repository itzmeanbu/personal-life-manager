/**
 * Personal Day Journey — one full-screen step at a time.
 * This is deliberately a journey, not a dashboard:
 * wake → each routine → bus → each college period/break/lunch → bus home
 * → home → workout/guitar/night routines → tomorrow plan.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToday } from '../hooks/useToday';
import { useActiveDayProfile } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { deriveStatus, toIsoDate, isRoutineScheduledOnDate } from '../routine/engine';
import { routinesRepo, completionRecordsRepo, collegeDayStatusesRepo, moneyTransactionsRepo, musicPlaylistsRepo, musicTracksRepo } from '../data/repository';
import type { Routine } from '../data/types';
import { getDayOrderForDate, setDayOrderForDate, suggestNextDayOrder } from '../college/dayOrder';
import { currentTimeSlot, formatMinHm, resolveCell } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { TomorrowOrderCard } from '../day/TomorrowOrderCard';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';
import { getMusicConfig } from '../music/settings';
import { buildQueue } from '../music/shuffle';
import { musicPlayer } from '../music/player';
import '../day/day.css';

const MORNING_GREETINGS = [
  'Good morning',
  'おはようございます',
  '좋은 아침이에요',
  'Bonjour',
];

const iconFor = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('brush')) return '🪥';
  if (t.includes('face')) return '🫧';
  if (t.includes('hair') || t.includes('serum')) return '💆';
  if (t.includes('breakfast')) return '🍳';
  if (t.includes('bath')) return '🚿';
  if (t.includes('guitar')) return '🎸';
  if (t.includes('sleep')) return '😴';
  if (t.includes('workout')) return '🏋️';
  return '✓';
};

const hmToMin = (hm?: string) => {
  if (!hm) return Number.MAX_SAFE_INTEGER;
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

const isDone = (routine: Routine, completions: any[], iso: string, now: Date) => {
  const rec = completions.find(
    (c) => c.refType === 'routine' && c.refId === routine.id && c.date === iso && !c.deleted
  );
  return deriveStatus(routine, iso, rec, now) === 'done' || rec?.status === 'skipped';
};

function useJourneyNow() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeDemoDay(() => setTick((x) => x + 1));
    const timer = window.setInterval(() => setTick((x) => x + 1), 15000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);
  void tick;
  return getDemoDate();
}

function JourneyNav() {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 8,
        display: 'flex',
        gap: 7,
        overflowX: 'auto',
        padding: '10px 16px',
        background: 'color-mix(in srgb, var(--color-bg) 88%, transparent)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {[
        ['/', 'Journey'],
        ['/today', 'Today'],
        ['/routines', 'Routines'],
        ['/college', 'College'],
        ['/spin', 'Spin'],
      ].map(([to, label]) => (
        <Link key={to} to={to} style={{ flexShrink: 0 }}>
          <Button variant={to === '/' ? 'primary' : 'secondary'}>{label}</Button>
        </Link>
      ))}
    </div>
  );
}

function PhaseFrame({
  eyebrow,
  title,
  icon,
  time,
  position,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: string;
  time?: string;
  position?: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell day-journey">
      <JourneyNav />
      <header
        style={{
          minHeight: '28vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '34px 24px 20px',
        }}
      >
        <div style={{ fontSize: 54, lineHeight: 1, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--color-accent-strong)', fontWeight: 800 }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 9vw, 4rem)', lineHeight: 1.05, margin: '10px 0 0', letterSpacing: '-.04em' }}>
          {title}
        </h1>
        {time && <div style={{ marginTop: 12, color: 'var(--color-text-secondary)', fontSize: 15 }}>{time}</div>}
        {position && <div style={{ marginTop: 6, color: 'var(--color-text-tertiary)', fontSize: 12 }}>{position}</div>}
      </header>
      <main className="page-shell__content">{children}</main>
    </div>
  );
}

export default function Home() {
  const today = useToday();
  const now = useJourneyNow();
  const iso = toIsoDate(today.date);
  const { profile } = useActiveDayProfile(today.date);
  const { setStatus } = useDailyAgenda(today.date);
  const [greeting] = useState(() => MORNING_GREETINGS[Math.floor(Math.random() * MORNING_GREETINGS.length)]);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [expense, setExpense] = useState('');
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [busMusicStarted, setBusMusicStarted] = useState(false);

  const routines = useLiveQuery(
    () => routinesRepo.list().then((rows) =>
      rows.filter((r) => !r.deleted && r.enabled && !r.archived && isRoutineScheduledOnDate(r, today.date))
        .sort((a, b) => (a.order - b.order) || hmToMin(a.time) - hmToMin(b.time))
    ),
    [iso],
    []
  );

  const completions = useLiveQuery(
    () => completionRecordsRepo.list().then((rows) => rows.filter((c) => c.date === iso && !c.deleted)),
    [iso],
    []
  );

  const collegeStatus = useLiveQuery(
    () => collegeDayStatusesRepo.list().then((rows) => rows.find((r) => r.date === iso && !r.deleted) ?? null),
    [iso],
    null
  );

  const commutePlaylists = useLiveQuery(() => musicPlaylistsRepo.list(), [], []);
  const commuteTracks = useLiveQuery(() => musicTracksRepo.list(), [], []);

  useEffect(() => {
    void getDayOrderForDate(iso).then(setDayOrder);
  }, [iso]);

  const wake = useMemo(() => routines.find((r) => r.title.trim().toLowerCase() === 'wake up'), [routines]);
  const wakeDone = !!wake && isDone(wake, completions, iso, now);

  const morningRoutines = useMemo(() => {
    const wakeMin = hmToMin(wake?.time ?? '05:00');
    const busMin = hmToMin(routines.find((r) => /bus to college|leave for college/i.test(r.title))?.time ?? '06:05');
    return routines.filter((r) => {
      const m = hmToMin(r.time);
      return m >= wakeMin && m < busMin && r.id !== wake?.id;
    });
  }, [routines, wake]);

  const incompleteMorning = morningRoutines.filter((r) => !isDone(r, completions, iso, now));
  const morningComplete = wakeDone && incompleteMorning.length === 0;

  const collegeStart = 9 * 60;
  const timetableEnd = 16 * 60 + 10;
  const returnBusStart = 16 * 60 + 30;

  const isBunk = profile?.systemKey === 'bunk' || collegeStatus?.status === 'bunked';
  const bunkArrivalMin = hmToMin(collegeStatus?.homeArrivalTime);
  const effectiveCollegeEnd = isBunk && Number.isFinite(bunkArrivalMin) ? bunkArrivalMin : returnBusStart;

  const minute = now.getHours() * 60 + now.getMinutes();

  const eveningRoutines = useMemo(() => {
    const after = effectiveCollegeEnd;
    return routines.filter((r) => {
      const m = hmToMin(r.time);
      return m >= after && !/wake up|bus to college|leave for college|college|bus home/i.test(r.title);
    });
  }, [routines, effectiveCollegeEnd]);

  const incompleteEvening = eveningRoutines.filter((r) => !isDone(r, completions, iso, now));

  const nextMorning = incompleteMorning[0];
  const nextEvening = incompleteEvening[0];

  const saveOrder = async (n: number) => {
    await setDayOrderForDate(iso, n);
    setDayOrder(n);
  };

  const suggestOrder = async () => saveOrder(await suggestNextDayOrder(iso));

  const addCommuteExpense = async () => {
    const amount = Number(expense);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await moneyTransactionsRepo.create({
      date: iso,
      type: 'expense',
      amount,
      category: 'transport',
      note: 'College commute',
      paidBy: 'self',
    });
    setExpense('');
    setExpenseSaved(true);
  };

  const startBusMusic = async () => {
    const enabled = (commutePlaylists ?? []).filter((p) => !p.deleted && p.enabled);
    const preferred =
      enabled.find((p) => p.systemKey === 'commute') ??
      enabled.find((p) => p.systemKey === 'workout') ??
      enabled[0];
    if (!preferred) return;
    const tracks = (commuteTracks ?? []).filter((t) => !t.deleted && t.playlistId === preferred.id);
    if (!tracks.length) return;
    const config = await getMusicConfig();
    const queue = buildQueue(tracks, { shuffle: true, config, lastTrackId: musicPlayer.lastTrackId });
    musicPlayer.setQueue(queue, 0);
    await musicPlayer.playTrackAt(0);
    setBusMusicStarted(true);
  };

  const markRoutine = useCallback(async (routine: Routine, status: 'done' | 'skipped' = 'done') => {
    await setStatus(routine.id, status);
  }, [setStatus]);

  // First screen: always a large four-language good-morning gate.
  if (!wakeDone) {
    return (
      <PhaseFrame eyebrow="Start of day" title={greeting} icon="☀️" time={formatHm12(wake?.time ?? '05:00')}>
        <Card style={{ textAlign: 'center', padding: '28px 20px' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 18 }}>
            Your day starts when <strong>you</strong> say you are awake.
          </p>
          <Button variant="primary" onClick={() => wake && markRoutine(wake)}>
            I’m awake · {formatHm12(wake?.time ?? '05:00')}
          </Button>
        </Card>
        <TomorrowOrderCard date={today.date} />
      </PhaseFrame>
    );
  }

  // Morning = one routine per screen.
  if (nextMorning) {
    return (
      <PhaseFrame
        eyebrow="Morning routine"
        title={nextMorning.title}
        icon={iconFor(nextMorning.title)}
        time={nextMorning.time ? formatHm12(nextMorning.time) : undefined}
        position={`One step at a time · ${morningRoutines.indexOf(nextMorning) + 1} / ${morningRoutines.length}`}
      >
        {nextMorning.notes && <Card><p>{nextMorning.notes}</p></Card>}
        <Card style={{ textAlign: 'center', padding: '30px 20px' }}>
          <Button variant="primary" onClick={() => markRoutine(nextMorning)}>
            ✓ Finish {nextMorning.title}
          </Button>
          <Button variant="ghost" style={{ marginTop: 8 }} onClick={() => markRoutine(nextMorning, 'skipped')}>
            Skip this step
          </Button>
        </Card>
      </PhaseFrame>
    );
  }

  // Morning bus phase. It remains the active page until college time.
  if (minute < collegeStart && morningComplete) {
    const hasTracks = (commuteTracks ?? []).some((t) => !t.deleted && (commutePlaylists ?? []).some((p) => !p.deleted && p.enabled && p.id === t.playlistId));
    return (
      <PhaseFrame eyebrow="Morning commute" title="Bus to college" icon="🚌" time="Boarded · college arrival around 9:10 AM">
        <Card>
          <strong>🎵 Commute playlist</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6 }}>
            Random queue every commute. The immediate previous song is avoided and the queue is shuffled.
          </p>
          <Button variant="primary" disabled={!hasTracks} onClick={startBusMusic} style={{ marginTop: 12 }}>
            {busMusicStarted ? '♫ Playing commute music' : hasTracks ? '▶ Start random playlist' : 'Add songs in Music first'}
          </Button>
          <Link to="/music" style={{ display: 'inline-block', marginTop: 8 }}>
            <Button variant="ghost">Open Music</Button>
          </Link>
        </Card>
        <Card>
          <strong>₹ Commute expense</strong>
          <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 10px' }}>Log the amount for this bus ride.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="Amount"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
            />
            <Button variant="secondary" onClick={addCommuteExpense}>Save</Button>
          </div>
          {expenseSaved && <p style={{ color: 'var(--color-accent)', marginTop: 8 }}>✓ Commute expense saved</p>}
        </Card>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          At 9:00 the bus screen automatically changes to your college timetable.
        </p>
      </PhaseFrame>
    );
  }

  // College journey: exact timetable slot, break, lunch, and the 2:30–2:35 gap.
  if (minute >= collegeStart && minute < effectiveCollegeEnd && (!isBunk || minute < effectiveCollegeEnd)) {
    if (!dayOrder) {
      return (
        <PhaseFrame eyebrow="College setup" title="Choose your day order" icon="🎓" time="1–6 · used for today's timetable">
          <Card>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 14 }}>
              Pick the timetable row for today. It is saved for this date and future days auto-advance from it.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[1,2,3,4,5,6].map((n) => (
                <Button key={n} variant="secondary" onClick={() => saveOrder(n)}>Day {n}</Button>
              ))}
            </div>
            <Button variant="ghost" style={{ marginTop: 10 }} onClick={suggestOrder}>Suggest next day order</Button>
          </Card>
          <TomorrowOrderCard date={today.date} />
        </PhaseFrame>
      );
    }

    // 9:00 notification: the actual Web Notification fires once per date.
    if (minute >= 9 * 60 && minute < 9 * 60 + 10) {
      try {
        const key = `college-wake-notified-${iso}`;
        if (sessionStorage.getItem(key) !== '1' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('9:00 AM — wake up', { body: 'You are getting off the bus. Get to class by 9:10.' });
          sessionStorage.setItem(key, '1');
        }
      } catch { /* notification permission may be unavailable */ }
    }

    if (minute >= 9 * 60 && minute < 9 * 60 + 10) {
      return (
        <PhaseFrame
          eyebrow={`College · Day order ${dayOrder}`}
          title="Get to class"
          icon="🏃"
          time="9:00 AM wake-up · 9:10 AM class"
          position="Bus journey finished · move to your classroom"
        >
          <Card style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 14 }}>
              You slept in the bus. This is the 10-minute transition from waking up at 9:00 to reaching class at 9:10.
            </p>
          </Card>
        </PhaseFrame>
      );
    }

    const slot = currentTimeSlot(now);
    if (slot) {
      const resolved = resolveCell(dayOrder, slot.id);
      const subjectName = slot.kind === 'break'
        ? 'Break'
        : slot.kind === 'lunch'
          ? 'Lunch'
          : resolved.subject?.name ?? 'Class';
      const detail = slot.kind === 'class'
        ? `${formatMinHm(slot.startMin)} – ${formatMinHm(slot.endMin)}`
        : `${formatMinHm(slot.startMin)} – ${formatMinHm(slot.endMin)}`;

      return (
        <PhaseFrame
          eyebrow={slot.kind === 'class' ? `College · Day order ${dayOrder}` : 'College interval'}
          title={subjectName}
          icon={slot.kind === 'class' ? '📚' : slot.kind === 'lunch' ? '🍱' : '☕'}
          time={detail}
          position="This screen changes automatically when the clock reaches the next slot"
        >
          <Card>
            {slot.kind === 'class' && resolved.subject?.faculty && (
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>Faculty · {resolved.subject.faculty}</p>
            )}
            {slot.kind === 'class' && resolved.cell?.isLab && (
              <p style={{ color: 'var(--color-accent)', marginBottom: 8 }}>🧪 Lab {resolved.cell.room ? `· ${resolved.cell.room}` : ''}</p>
            )}
            {slot.kind === 'break' && <p>Interval — no class. The next timetable screen appears automatically.</p>}
            {slot.kind === 'lunch' && (
              <>
                <p style={{ marginBottom: 10 }}>Lunch expense</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expense}
                    onChange={(e) => setExpense(e.target.value)}
                    placeholder="Amount"
                    style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
                  />
                  <Button variant="secondary" onClick={addCommuteExpense}>Save expense</Button>
                </div>
              </>
            )}
          </Card>
          <Link to="/college"><Button variant="secondary">Open College records</Button></Link>
        </PhaseFrame>
      );
    }

    // Timetable has a 5-minute gap at 2:30–2:35.
    if (minute >= 14 * 60 + 30 && minute < 14 * 60 + 35) {
      return (
        <PhaseFrame eyebrow={`College · Day order ${dayOrder}`} title="Interval" icon="☕" time="2:30 PM – 2:35 PM">
          <Card><p>Five-minute interval. Next period appears at 2:35 PM.</p></Card>
        </PhaseFrame>
      );
    }

    if (minute >= timetableEnd && minute < returnBusStart) {
      return (
        <PhaseFrame eyebrow="College finished" title="College ends" icon="🏫" time="4:10 PM timetable · 4:30 PM departure">
          <Card>
            <p>Last timetable slot is complete. Your return bus opens at 4:30 PM.</p>
          </Card>
        </PhaseFrame>
      );
    }
  }

  // Bunk: once home early, the college portion is over and the mandatory
  // free-time/spin window runs until the evening routine starts.
  if (isBunk && minute >= effectiveCollegeEnd && minute < 19 * 60 + 30) {
    return (
      <PhaseFrame eyebrow="Bunk day" title="Free time / Spin" icon="🎡" time="Home early → 7:30 PM">
        <Card style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            Bunk means the college portion ended early. This is your free-time window; spin is the required activity before the normal evening routine resumes.
          </p>
          <Link to="/spin">
            <Button variant="primary">Open Spin Wheel</Button>
          </Link>
        </Card>
        <Card>
          <strong>₹ Early-return commute expense</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="number"
              inputMode="decimal"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="Amount"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
            />
            <Button variant="secondary" onClick={addCommuteExpense}>Save</Button>
          </div>
          {expenseSaved && <p style={{ color: 'var(--color-accent)', marginTop: 8 }}>✓ Saved</p>}
        </Card>
      </PhaseFrame>
    );
  }

  // Normal return bus: dedicated full-screen commute phase until the evening routine begins.
  if (!isBunk && minute >= effectiveCollegeEnd && minute < 19 * 60 + 30) {
    return (
      <PhaseFrame eyebrow="Evening commute" title="Bus home" icon="🚌" time="College → home · around 7:00–7:30 PM">
        <Card>
          <strong>🎵 Commute playlist</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 6 }}>
            A fresh random queue for the ride home. It will not start with the previous track when possible.
          </p>
          <Button variant="primary" onClick={startBusMusic} style={{ marginTop: 12 }}>
            {busMusicStarted ? '♫ Playing commute music' : '▶ Start random playlist'}
          </Button>
        </Card>
        <Card>
          <strong>₹ Commute expense</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="number"
              inputMode="decimal"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="Amount"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
            />
            <Button variant="secondary" onClick={addCommuteExpense}>Save</Button>
          </div>
          {expenseSaved && <p style={{ color: 'var(--color-accent)', marginTop: 8 }}>✓ Saved</p>}
        </Card>
      </PhaseFrame>
    );
  }

  // After arriving home, show each evening routine alone.
  if (nextEvening) {
    return (
      <PhaseFrame
        eyebrow="Home routine"
        title={nextEvening.title}
        icon={iconFor(nextEvening.title)}
        time={nextEvening.time ? formatHm12(nextEvening.time) : undefined}
        position={`One step at a time · ${eveningRoutines.indexOf(nextEvening) + 1} / ${eveningRoutines.length}`}
      >
        {nextEvening.notes && <Card><p>{nextEvening.notes}</p></Card>}
        <Card style={{ textAlign: 'center', padding: '30px 20px' }}>
          <Button variant="primary" onClick={() => markRoutine(nextEvening)}>
            ✓ Finish {nextEvening.title}
          </Button>
          <Button variant="ghost" style={{ marginTop: 8 }} onClick={() => markRoutine(nextEvening, 'skipped')}>
            Skip this step
          </Button>
        </Card>
      </PhaseFrame>
    );
  }

  // End screen + next-day controls.
  return (
    <PhaseFrame eyebrow="Journey complete" title="Good night" icon="🌙" time="Today is finished">
      <Card style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Everything scheduled for today is complete.
        </p>
        <TomorrowOrderCard date={today.date} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <Link to="/routines"><Button variant="secondary">Edit routines</Button></Link>
          <Link to="/college"><Button variant="ghost">College</Button></Link>
          <Link to="/settings"><Button variant="ghost">Settings</Button></Link>
        </div>
      </Card>
    </PhaseFrame>
  );
}
