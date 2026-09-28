import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../components/ui/Button';
import { useToday } from '../hooks/useToday';
import { toIsoDate, isRoutineScheduledOnDate, sortRoutines } from '../routine/engine';
import { completionRecordsRepo, collegeDayStatusesRepo, moneyTransactionsRepo, routinesRepo } from '../data/repository';
import type { CompletionRecord, Routine } from '../data/types';
import { getWakeTime, logWake } from '../day/wakeCoach';
import { getTravel, logTravel, type TravelState } from '../day/travel';
import { startTravelMusic, stopTravelMusic } from '../music/travelMusic';
import { musicPlayer } from '../music/player';
import { getDayOrderForDate } from '../college/dayOrder';
import { currentTimeSlot, formatMinHm, resolveCell } from '../college/timetable';
import { greetingForDate, greetingLine, type Greeting } from '../day/greeting';
import { formatHm12 } from '../lib/timeFormat';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';
import './journey.css';

const MORNING_END = 6 * 60 + 15;
const COLLEGE_START = 9 * 60 + 10;
const COLLEGE_END = 16 * 60 + 30;
const WORKOUT_CANCEL_AFTER = 19 * 60 + 30;

function mins(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function hmMin(hm?: string) { if (!hm) return 9999; const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
function fmt(min: number) { return formatHm12(formatMinHm(min)); }

function Page({ children }: { children: React.ReactNode }) {
  return <main className="journey-page">{children}</main>;
}

function Phase({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <section className="journey-phase">
      <div className="journey-phase__inner">
        {eyebrow && <div className="journey-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="journey-subtitle">{subtitle}</p>}
        {children && <div className="journey-actions">{children}</div>}
      </div>
    </section>
  );
}

function Expense({ label, date, category, compact = false }: { label: string; date: string; category: string; compact?: boolean }) {
  const [amount, setAmount] = useState('');
  const save = async () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    await moneyTransactionsRepo.create({ date, type: 'expense', amount: n, category, note: `Day Journey · ${label}`, paidBy: 'self' });
    setAmount('');
  };
  return (
    <div className={`journey-expense${compact ? ' journey-expense--compact' : ''}`}>
      <span>{label}</span>
      <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" type="number" placeholder="₹" />
      <Button variant="secondary" onClick={save}>Save</Button>
    </div>
  );
}

function TravelPhase({ date, iso, state, setState, home }: { date: Date; iso: string; state: TravelState; setState: (s: TravelState) => void; home: boolean }) {
  const [fare, setFare] = useState('');
  const [track, setTrack] = useState(musicPlayer.current);
  const [playing, setPlaying] = useState(musicPlayer.playing);

  useEffect(() => musicPlayer.subscribe(() => { setTrack(musicPlayer.current); setPlaying(musicPlayer.playing); }), []);

  const kind = home ? 'boarded_back' : 'boarded_out';
  const hasBoarded = state.events.some(e => e.kind === kind);
  const reached = state.events.some(e => e.kind === (home ? 'reached_home' : 'reached_college'));

  const board = async () => {
    const n = Number(fare);
    const next = await logTravel(iso, kind, n > 0 ? n : undefined);
    setState(next);
    const r = await startTravelMusic(`${iso}:${kind}:${Date.now()}`);
    if (!r.ok) window.setTimeout(() => musicPlayer.play(), 0);
  };

  const arrive = async () => {
    const reachedKind = home ? 'reached_home' : 'reached_college';
    const next = await logTravel(iso, reachedKind);
    setState(next);
    stopTravelMusic();
  };

  if (!hasBoarded) {
    return <Phase eyebrow={home ? 'HOME COMMUTE' : 'MORNING COMMUTE'} title={home ? 'Board the bus home' : 'Board the bus'} subtitle={home ? 'College is over. This is your return commute phase.' : 'Once you board, this full-screen bus phase takes over.'}>
      <div className="journey-time">{formatHm12(formatMinHm(mins(date)))}</div>
      <input className="journey-fare" value={fare} onChange={e => setFare(e.target.value)} type="number" inputMode="decimal" placeholder="Commute expense ₹" />
      <Button onClick={board}>🚌 I boarded the bus</Button>
    </Phase>;
  }

  return <Phase eyebrow={home ? 'GOING HOME' : 'GOING TO COLLEGE'} title="Bus phase" subtitle="Music stays in this phase. It starts with a fresh random queue and avoids repeats until the library cycle is used.">
    <div className="journey-now-card">
      <div className="journey-track-label">NOW PLAYING</div>
      <strong>{track?.title ?? 'Your travel playlist'}</strong>
      <span>{track ? 'Local offline track' : 'Import songs in Music to start playback'}</span>
    </div>
    <div className="journey-row">
      <Button variant="secondary" onClick={() => musicPlayer.toggle()}>{playing ? 'Pause' : 'Play'}</Button>
      <Button variant="secondary" onClick={() => musicPlayer.next()}>Next random →</Button>
    </div>
    <div className="journey-progress">{state.events.filter(e => e.kind.includes(home ? 'back' : 'out') || e.kind.includes(home ? 'home' : 'college')).length > 0 ? 'Commute logged' : 'Commute active'}</div>
    {!reached && <Button onClick={arrive}>{home ? '🏠 I reached home' : '🏫 I reached class / got off bus'}</Button>}
  </Phase>;
}

function RoutinePhase({ routine, iso, onDone, eyebrow = 'ONE PHASE' }: { routine: Routine; iso: string; onDone: () => void; eyebrow?: string }) {
  const complete = async (status: CompletionRecord['status']) => {
    const existing = (await completionRecordsRepo.list()).find(c => c.date === iso && c.refType === 'routine' && c.refId === routine.id && !c.deleted);
    if (existing) await completionRecordsRepo.update(existing.id, { status });
    else await completionRecordsRepo.create({ date: iso, refType: 'routine', refId: routine.id, status });
    onDone();
  };
  return <Phase eyebrow={eyebrow} title={routine.title} subtitle={`${routine.category}${routine.time ? ` · ${formatHm12(routine.time)}` : ''}${routine.durationMinutes ? ` · ${routine.durationMinutes} min` : ''}`}>
    {routine.notes && <p className="journey-note">{routine.notes}</p>}
    <Button onClick={() => complete('done')}>✓ Finished</Button>
    <Button variant="ghost" onClick={() => complete('skipped')}>Skip this phase</Button>
  </Phase>;
}

function CollegePhase({ date, iso, dayOrder, onBunk }: { date: Date; iso: string; dayOrder: number; onBunk: () => void }) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const nowMin = mins(date);
  const slot = currentTimeSlot(date);
  const isGap = nowMin >= 14 * 60 + 30 && nowMin < 14 * 60 + 35;
  const active = slot ?? (isGap ? { id: 'gap', periodNo: null, label: 'Interval', startMin: 14 * 60 + 30, endMin: 14 * 60 + 35, kind: 'break' as const } : null);
  const subject = active && active.id !== 'gap' ? resolveCell(dayOrder, active.id) : null;
  const title = active?.kind === 'lunch' ? 'Lunch' : active?.kind === 'break' ? 'Interval' : subject?.subject?.name ?? active?.label ?? 'College';
  const detail = active?.kind === 'class' ? `${active.label} · ${fmt(active.startMin)} – ${fmt(active.endMin)}` : active ? `${fmt(active.startMin)} – ${fmt(active.endMin)}` : 'College time';
  return <Phase eyebrow="COLLEGE PHASE" title={title} subtitle={detail}>
    {active?.kind === 'class' && subject?.cell?.isLab && <div className="journey-pill">LAB{subject.cell.room ? ` · ${subject.cell.room}` : ''}</div>}
    {active?.kind === 'break' && <Button variant="secondary" onClick={() => setExpenseOpen(v => !v)}>💸 Log interval expense</Button>}
    {active?.kind === 'lunch' && <Button variant="secondary" onClick={() => setExpenseOpen(v => !v)}>🍱 Log lunch expense</Button>}
    {expenseOpen && <Expense label={active?.kind === 'lunch' ? 'Lunch' : 'Interval'} date={iso} category={active?.kind === 'lunch' ? 'food' : 'canteen'} />}
    <Button variant="ghost" onClick={onBunk}>🏃 Bunk / leave college now</Button>
  </Phase>;
}

export default function Home() {
  const today = useToday();
  const [tick, setTick] = useState(0);
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [travel, setTravel] = useState<TravelState>({ date: toIsoDate(today.date), events: [] });
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [wakeAt, setWakeAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = subscribeDemoDay(() => setTick(v => v + 1));
    const timer = window.setInterval(() => setTick(v => v + 1), 1000);
    return () => { unsub(); window.clearInterval(timer); };
  }, []);
  const date = getDemoDate();
  const iso = toIsoDate(date);
  const minute = mins(date);
  const status = useLiveQuery(async () => (await collegeDayStatusesRepo.list()).find(x => x.date === iso && !x.deleted) ?? null, [iso], null);
  const routines = useLiveQuery(async () => sortRoutines((await routinesRepo.list()).filter(r => !r.deleted && isRoutineScheduledOnDate(r, date))), [iso, tick], []);
  const completions = useLiveQuery(async () => (await completionRecordsRepo.list()).filter(c => c.date === iso && !c.deleted), [iso, tick], []);

  useEffect(() => {
    let alive = true;
    void Promise.all([greetingForDate(iso), getTravel(iso), getDayOrderForDate(iso), getWakeTime(iso)]).then(([g, t, d, w]) => {
      if (!alive) return;
      setGreeting(g); setTravel(t); setDayOrder(d); setWakeAt(w);
    });
    return () => { alive = false; };
  }, [iso, tick]);

  const refreshTravel = useCallback(async (s: TravelState) => setTravel(s), []);
  const doneIds = useMemo(() => new Set(completions.map(c => c.refType === 'routine' && (c.status === 'done' || c.status === 'skipped') ? c.refId : '')), [completions]);
  const scheduled = useMemo(() => routines.filter(r => !doneIds.has(r.id)), [routines, doneIds]);

  const wakeDone = !!wakeAt;

  const morningRoutines = scheduled.filter(r => {
    const t = hmMin(r.time);
    return t < MORNING_END && !/wake up/i.test(r.title) && !r.moduleTag && !['Rest'].includes(r.category) && !/sleep/i.test(r.title);
  });
  const postHomeRoutines = scheduled.filter(r => {
    const t = hmMin(r.time);
    return t >= 19 * 60 && !/sleep/i.test(r.title) && (r.moduleTag === 'workout' || r.moduleTag === 'guitar' || t >= 20 * 60);
  });
  const nightRoutines = scheduled.filter(r => /sleep/i.test(r.title) || r.category === 'Rest');

  const boardedOut = travel.events.some(e => e.kind === 'boarded_out');
  const reachedCollege = travel.events.some(e => e.kind === 'reached_college');
  const boardedBack = travel.events.some(e => e.kind === 'boarded_back');
  const reachedHome = travel.events.some(e => e.kind === 'reached_home');
  const bunked = status?.status === 'bunked';

  const markWake = async () => {
    await logWake(iso, date);
    setTick(v => v + 1);
  };

  const markBunk = async () => {
    const existing = status;
    if (existing) await collegeDayStatusesRepo.update(existing.id, { status: 'bunked', homeArrivalTime: '16:30' });
    else await collegeDayStatusesRepo.create({ date: iso, status: 'bunked', homeArrivalTime: '16:30' });
    setTick(v => v + 1);
  };

  if (!greeting) return <Page><div className="journey-loading">Loading your day…</div></Page>;

  if (!wakeDone && !bunked && minute < 24 * 60) {
    return <Page><div className="journey-welcome"><div className="journey-language">{greeting.language}</div><div className="journey-greeting">{greetingLine(greeting, '')}</div><div className="journey-date">{date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div><Button onClick={markWake}>I’m awake · {formatHm12(formatMinHm(minute))}</Button></div></Page>;
  }

  // Morning: every routine is its own screen, then the bus takes over.
  if (!boardedOut && !bunked && morningRoutines.length > 0) {
    return <Page><RoutinePhase routine={morningRoutines[0]} iso={iso} eyebrow="MORNING ROUTINE" onDone={() => setTick(v => v + 1)} /></Page>;
  }
  if (!boardedOut && !bunked && minute < COLLEGE_START) {
    return <Page><Phase eyebrow="MORNING COMMUTE" title="Ready for the bus?" subtitle={minute <= 6 * 60 + 15 ? 'Your first bus is 6:15 AM. If you miss it, the 6:50 AM bus is the fallback.' : 'You are past the first bus. Use the fallback if you still can.'}><div className="journey-time">Wake → {formatHm12(formatMinHm(minute))}</div><Button onClick={async () => { const next = await logTravel(iso, 'boarded_out'); setTravel(next); await startTravelMusic(`${iso}:boarded_out:${Date.now()}`); }}>🚌 Board 6:15 / 6:50 bus</Button></Phase></Page>;
  }
  if (boardedOut && !reachedCollege) return <Page><TravelPhase date={date} iso={iso} state={travel} setState={refreshTravel} home={false} /></Page>;

  // College / bunk. Timetable advances naturally with the clock; past phases vanish.
  if (!bunked && !reachedHome && (reachedCollege || minute >= COLLEGE_START) && !boardedBack && minute < COLLEGE_END) {
    if (!dayOrder) return <Page><Phase eyebrow="COLLEGE" title="Set today's day order" subtitle="Choose Day Order 1–6 once. The timetable then controls each college phase."><Link to="/college"><Button>Open College →</Button></Link></Phase></Page>;
    return <Page><CollegePhase date={date} iso={iso} dayOrder={dayOrder} onBunk={markBunk} /></Page>;
  }

  if (bunked && !boardedBack && !reachedHome) {
    return <Page><TravelPhase date={date} iso={iso} state={travel} setState={refreshTravel} home /></Page>;
  }
  if (!bunked && minute >= COLLEGE_END && !boardedBack) {
    return <Page><TravelPhase date={date} iso={iso} state={travel} setState={refreshTravel} home /></Page>;
  }
  if (boardedBack && !reachedHome) return <Page><TravelPhase date={date} iso={iso} state={travel} setState={refreshTravel} home /></Page>;

  // After home: still one routine per page. Workout disappears if home after 7:30.
  if (reachedHome && postHomeRoutines.length > 0) {
    const r = postHomeRoutines[0];
    if (r.moduleTag === 'workout' && minute > WORKOUT_CANCEL_AFTER) {
      void completionRecordsRepo.create({ date: iso, refType: 'routine', refId: r.id, status: 'skipped', note: 'Cancelled because home arrival was after 7:30 PM.' });
      setTick(v => v + 1);
    } else {
      return <Page><RoutinePhase routine={r} iso={iso} onDone={() => setTick(v => v + 1)} /></Page>;
    }
  }
  if (reachedHome && nightRoutines.length > 0) return <Page><RoutinePhase routine={nightRoutines[0]} iso={iso} onDone={() => setTick(v => v + 1)} /></Page>;

  return <Page><Phase eyebrow="DAY COMPLETE" title="Good night" subtitle="Every phase for today is finished. Tomorrow starts fresh." ><Link to="/settings"><Button variant="secondary">Settings</Button></Link></Phase></Page>;
}
