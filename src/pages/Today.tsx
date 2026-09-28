import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useActiveDayProfile, useDayProgress } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { moneyTransactionsRepo } from '../data/repository';
import { getSetting, setSetting } from '../data/settings';
import { getDayOrderForDate } from '../college/dayOrder';
import { currentTimeSlot, formatMinHm, liveClassLine, resolveCell } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';
import { Button } from '../components/ui/Button';
import { markPhaseComplete } from '../day/phaseEngine';
import { toIsoDate } from '../routine/engine';
import '../day/day.css';
import './daily-flow.css';

const WAKE_KEY = 'dailyFlow.wakeAt.v1';

function hm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMinutes(base: Date, minutes: number) {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function isDone(status?: string) {
  return status === 'done' || status === 'skipped';
}

/**
 * Daily Flow is intentionally a single-phase surface. It does not render the
 * old dashboard/cards stack: the current phase owns the whole screen.
 */
export default function Today() {
  const [clock, setClock] = useState(() => getDemoDate());
  const iso = toIsoDate(clock);
  const { profile } = useActiveDayProfile(clock);
  const { agenda, setStatus } = useDailyAgenda(clock);
  const journey = useDayProgress(clock);
  const [wakeAt, setWakeAt] = useState<string | null>(null);
  const [dayOrder, setDayOrder] = useState<number | null>(null);

  useEffect(() => {
    const refreshClock = () => setClock(getDemoDate());
    const unsub = subscribeDemoDay(refreshClock);
    const timer = window.setInterval(refreshClock, 15000);
    refreshClock();
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void getSetting<string | null>(`${WAKE_KEY}.${iso}`, null).then((v) => {
      if (alive) setWakeAt(v);
    });
    void getDayOrderForDate(iso).then((v) => {
      if (alive) setDayOrder(v);
    });
    return () => { alive = false; };
  }, [iso]);

  const moneyToday = useLiveQuery(
    async () => (await moneyTransactionsRepo.list()).filter((r) => r.date === iso && r.type === 'expense' && !r.deleted),
    [iso],
    []
  );

  const agendaById = useMemo(
    () => new Map(agenda.map((a) => [a.routine.id, a.status])),
    [agenda]
  );

  const currentRoutine = useMemo(() => {
    for (const r of journey.phaseRoutines) {
      if (!isDone(agendaById.get(r.id))) return r;
    }
    return null;
  }, [journey.phaseRoutines, agendaById]);

  const slot = currentTimeSlot(clock);
  const isCollegeProfile = !profile || ['normal', 'bunk'].includes(profile.systemKey ?? '');
  const inCollegeWindow = Boolean(slot && isCollegeProfile && dayOrder);
  const dayName = clock.toLocaleDateString([], { weekday: 'long' });
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();

  const busPlan = useMemo(() => {
    if (!wakeAt) return null;
    const [h, m] = wakeAt.split(':').map(Number);
    const wake = new Date(clock);
    wake.setHours(h, m, 0, 0);
    const busHm = h < 5 || (h === 5 && m <= 20) ? '06:15' : '06:50';
    const [bh, bm] = busHm.split(':').map(Number);
    const bus = new Date(clock);
    bus.setHours(bh, bm, 0, 0);
    const leave = addMinutes(bus, -20);
    return { wake, bus, leave, busHm };
  }, [wakeAt, clock]);

  const morningSchedule = useMemo(() => {
    if (!wakeAt || journey.phaseRoutines.length === 0) return [];
    const [h, m] = wakeAt.split(':').map(Number);
    let cursor = new Date(clock);
    cursor.setHours(h, m, 0, 0);
    return journey.phaseRoutines.map((r) => {
      const title = r.title.toLowerCase();
      const duration = r.durationMinutes ?? (title.includes('eat') || title.includes('breakfast') ? 15 : 5);
      const start = new Date(cursor);
      cursor = addMinutes(cursor, duration);
      return { routine: r, start, end: new Date(cursor) };
    });
  }, [wakeAt, journey.phaseRoutines, clock]);

  const completeRoutine = async () => {
    if (!currentRoutine) return;
    await setStatus(currentRoutine.id, 'done');
    await journey.refresh();
  };

  const startWake = async () => {
    const value = hm(clock);
    await setSetting(`${WAKE_KEY}.${iso}`, value);
    setWakeAt(value);
  };

  const finishCurrentPhase = async () => {
    if (!journey.currentPhase) return;
    await markPhaseComplete(clock, journey.currentPhase.id);
    await journey.refresh();
  };

  if (!wakeAt && nowMinutes < 10 * 60) {
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>{dayName}</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">☀️</div>
          <p className="flow-kicker">MORNING START</p>
          <h1>Good morning.</h1>
          <p>Whenever you actually wake up, tap below. I&apos;ll generate the morning timings from that exact time.</p>
          <Button variant="primary" onClick={startWake}>I&apos;m awake</Button>
        </section>
        <div className="flow-footer-note">Demo clock: {formatHm12(hm(clock))}</div>
      </main>
    );
  }

  if (inCollegeWindow && slot && dayOrder) {
    const { subject } = resolveCell(dayOrder, slot.id);
    const title = slot.kind === 'class' ? subject?.name ?? liveClassLine(dayOrder, clock) : slot.label;
    const isBreak = slot.kind === 'break' || slot.kind === 'lunch';
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>Academic Day · Order {dayOrder}</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero flow-hero--academic">
          <div className="flow-progress">{slot.label} · {formatHm12(formatMinHm(slot.startMin))} – {formatHm12(formatMinHm(slot.endMin))}</div>
          <div className="flow-icon">{isBreak ? (slot.kind === 'lunch' ? '🍱' : '☕') : '🎓'}</div>
          <p className="flow-kicker">CURRENT PHASE</p>
          <h1>{title}</h1>
          {slot.kind === 'class' && subject?.faculty && <p>{subject.faculty}</p>}
          {isBreak && <p>Did you eat or buy anything? Record the spend while this phase is active.</p>}
          <div className="flow-actions">
            {isBreak && <Link to="/spending"><Button variant="secondary">Record spending</Button></Link>}
            <Link to="/activity-log"><Button variant="ghost">View activity log</Button></Link>
          </div>
        </section>
        <div className="flow-footer-note">The phase changes automatically with the clock.</div>
      </main>
    );
  }

  if (busPlan && nowMinutes >= Math.max(0, busPlan.leave.getHours() * 60 + busPlan.leave.getMinutes()) && nowMinutes < busPlan.bus.getHours() * 60 + busPlan.bus.getMinutes()) {
    const waiting = nowMinutes >= busPlan.leave.getHours() * 60 + busPlan.leave.getMinutes();
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>Morning Transit</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">🚌</div>
          <p className="flow-kicker">NEXT PHASE</p>
          <h1>{waiting ? 'Get to the bus stop.' : 'Get ready to leave.'}</h1>
          <p>Target bus: <strong>{formatHm12(busPlan.busHm)}</strong>. You have a real gap for getting there and waiting for the bus.</p>
        </section>
      </main>
    );
  }

  if (busPlan && nowMinutes >= busPlan.bus.getHours() * 60 + busPlan.bus.getMinutes() && nowMinutes < 9 * 60 + 10) {
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>Morning Transit</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">🎵</div>
          <p className="flow-kicker">IN TRANSIT</p>
          <h1>Bus journey</h1>
          <p>Music is on. English + Tamil are shuffled together. No repeat until the available songs cycle.</p>
          {nowMinutes >= 8 * 60 + 50 && nowMinutes < 9 * 60 && (
            <div className="flow-alert">WAKE UP BRO 😭 You have 5 mins to get the hell up.</div>
          )}
          {nowMinutes >= 9 * 60 && <div className="flow-alert">College wake-up. Get ready — you reach around 9:10.</div>}
        </section>
      </main>
    );
  }

  if (journey.loading) {
    return <main className="flow-screen"><section className="flow-hero"><p className="flow-kicker">DAILY FLOW</p><h1>Loading your next phase…</h1></section></main>;
  }

  if (currentRoutine) {
    const scheduleRow = morningSchedule.find((x) => x.routine.id === currentRoutine.id);
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>{profile?.name ?? 'Daily Flow'}</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-progress">Phase {journey.position.current} of {journey.position.total}</div>
          <div className="flow-icon">{journey.currentPhase?.icon ?? '◉'}</div>
          <p className="flow-kicker">{journey.currentPhase?.name ?? 'CURRENT PHASE'}</p>
          <h1>{currentRoutine.title}</h1>
          <p>{currentRoutine.notes ?? currentRoutine.category}</p>
          {scheduleRow && journey.currentPhase?.name.toLowerCase().includes('morning') && (
            <div className="flow-time-chip">Generated: {formatHm12(hm(scheduleRow.start))} → {formatHm12(hm(scheduleRow.end))}</div>
          )}
          <Button variant="primary" onClick={completeRoutine}>Done — next phase</Button>
        </section>
        <div className="flow-footer-note">Nothing else is shown until this phase is completed.</div>
      </main>
    );
  }

  if (journey.currentPhase && journey.currentPhase.moduleTags.includes('spin')) {
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>Free Time</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">🎡</div>
          <p className="flow-kicker">MANDATORY FREE-TIME PHASE</p>
          <h1>Spin the wheel.</h1>
          <p>Spin is available only when your day has an actual free-time window. The result gets a time budget and is saved to your Activity Log.</p>
          <Link to="/spin"><Button variant="primary">Open Spin Wheel</Button></Link>
          <Button variant="ghost" onClick={finishCurrentPhase}>Finish free-time phase</Button>
        </section>
      </main>
    );
  }

  if (journey.isComplete) {
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>Daily Flow complete</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">✓</div>
          <p className="flow-kicker">COMPLETE</p>
          <h1>Day complete.</h1>
          <p>Your completed phases and spending are preserved in Activity Log and Spending.</p>
          <div className="flow-actions">
            <Link to="/activity-log"><Button variant="secondary">Activity Log</Button></Link>
            <Link to="/settings"><Button variant="ghost">Plan next day</Button></Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flow-screen">
      <section className="flow-hero">
        <div className="flow-icon">◌</div>
        <p className="flow-kicker">NO ACTIVE PHASE</p>
        <h1>You&apos;re between phases.</h1>
        <p>Current spend recorded today: ₹{moneyToday.reduce((s, x) => s + x.amount, 0).toFixed(0)}.</p>
        <Link to="/settings"><Button variant="secondary">Check day setup</Button></Link>
      </section>
    </main>
  );
}
