import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useActiveDayProfile, useDayProgress } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { moneyTransactionsRepo, musicPlaylistsRepo, musicTracksRepo } from '../data/repository';
import { getSetting, setSetting } from '../data/settings';
import { getDayOrderForDate } from '../college/dayOrder';
import { currentTimeSlot, formatMinHm, liveClassLine, resolveCell } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { getDemoDate, subscribeDemoDay } from '../demo/DemoTools';
import { Button } from '../components/ui/Button';
import { markPhaseComplete } from '../day/phaseEngine';
import { TomorrowOrderCard } from '../day/TomorrowOrderCard';
import { getTomorrowOrder } from '../day/spendPrompts';
import { toIsoDate } from '../routine/engine';
import { getMusicConfig } from '../music/settings';
import { buildQueue } from '../music/shuffle';
import { musicPlayer } from '../music/player';
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

function phaseIcon(title: string, moduleTag?: string) {
  const t = `${title} ${moduleTag ?? ''}`.toLowerCase();
  if (/bus|commute|travel/.test(t)) return '🚌';
  if (/breakfast|eat|food|lunch|canteen|tea/.test(t)) return '🍽️';
  if (/brush/.test(t)) return '🪥';
  if (/face|wash/.test(t)) return '🫧';
  if (/serum|hair|skin/.test(t)) return '💆';
  if (/workout|gym|exercise/.test(t)) return '🏋️';
  if (/guitar/.test(t)) return '🎸';
  if (/sleep|bed/.test(t)) return '😴';
  if (/naveen|social/.test(t)) return '👥';
  return '✓';
}

function ExpenseCapture({ iso, category, note }: { iso: string; category: string; note: string }) {
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    await moneyTransactionsRepo.create({
      date: iso,
      type: 'expense',
      amount: n,
      category,
      note,
      paidBy: 'self',
    });
    setAmount('');
    setSaved(true);
  };

  return (
    <div className="phase-tool">
      <div className="phase-tool__title">₹ Spending</div>
      <p>Record the money spent during this phase. It will appear in your daily, weekly, monthly and yearly spending history.</p>
      <div className="phase-tool__row">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="phase-input"
        />
        <Button variant="secondary" onClick={() => void save()}>Save</Button>
      </div>
      {saved && <div className="phase-success">✓ Saved to Spending</div>}
    </div>
  );
}

export default function Today() {
  const [clock, setClock] = useState(() => getDemoDate());
  const iso = toIsoDate(clock);
  const { profile } = useActiveDayProfile(clock);
  const { agenda, setStatus } = useDailyAgenda(clock);
  const journey = useDayProgress(clock);
  const [wakeAt, setWakeAt] = useState<string | null>(null);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [musicTick, setMusicTick] = useState(0);
  const [tomorrowConfigured, setTomorrowConfigured] = useState(false);

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

  useEffect(() => musicPlayer.subscribe(() => setMusicTick((n) => n + 1)), []);

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
  useEffect(() => {
    if (!journey.currentPhase || !journey.currentPhase.name.toLowerCase().includes('sleep')) return;
    const tomorrow = new Date(clock);
    tomorrow.setDate(tomorrow.getDate() + 1);
    void getTomorrowOrder(toIsoDate(tomorrow)).then((v) => setTomorrowConfigured(Boolean(v?.order && v.order !== 'unset')));
  }, [journey.currentPhase, clock]);

  const moneyToday = useLiveQuery(
    async () => (await moneyTransactionsRepo.list()).filter((r) => r.date === iso && r.type === 'expense' && !r.deleted),
    [iso],
    []
  );

  const commutePlaylists = useLiveQuery(() => musicPlaylistsRepo.list(), [], []);
  const commuteTracks = useLiveQuery(() => musicTracksRepo.list(), [], []);

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
  const isCollegeProfile = !profile || ['normal', 'bunk', 'coimbatore_stay'].includes(profile.systemKey ?? '');
  const inCollegeWindow = Boolean(slot && isCollegeProfile && dayOrder);
  const dayName = clock.toLocaleDateString([], { weekday: 'long' });
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();

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
    const wakeRoutine = journey.phaseRoutines.find((r) => /^wake up$/i.test(r.title));
    if (wakeRoutine) await setStatus(wakeRoutine.id, 'done');
    setWakeAt(value);
    await journey.refresh();
  };

  const finishCurrentPhase = async () => {
    if (!journey.currentPhase) return;
    await markPhaseComplete(clock, journey.currentPhase.id);
    await journey.refresh();
  };

  const startCommuteMusic = async () => {
    const enabled = (commutePlaylists ?? []).filter((p) => !p.deleted && p.enabled);
    const preferred = enabled.find((p) => p.systemKey === 'commute') ?? enabled[0];
    if (!preferred) return;
    const tracks = (commuteTracks ?? []).filter((t) => !t.deleted && t.playlistId === preferred.id);
    if (!tracks.length) return;
    const config = await getMusicConfig();
    const queue = buildQueue(tracks, { shuffle: true, config, lastTrackId: musicPlayer.lastTrackId });
    musicPlayer.setQueue(queue, 0);
    await musicPlayer.playTrackAt(0);
  };

  if (!wakeAt && nowMinutes < 10 * 60) {
    return (
      <main className="flow-screen">
        <div className="flow-topline"><span>{dayName}</span><span>{formatHm12(hm(clock))}</span></div>
        <section className="flow-hero">
          <div className="flow-icon">☀️</div>
          <p className="flow-kicker">MORNING START</p>
          <h1>Good morning.</h1>
          <p>Tap when you actually wake up. Morning timings are generated from that exact time.</p>
          <Button variant="primary" onClick={() => void startWake()}>I&apos;m awake</Button>
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
          <p className="flow-kicker">{slot.kind === 'class' ? 'COLLEGE PERIOD' : 'COLLEGE INTERVAL'}</p>
          <h1>{title}</h1>
          {slot.kind === 'class' && subject?.faculty && <p>Faculty · {subject.faculty}</p>}
          {slot.kind === 'class' && subject && <p>Day order {dayOrder} · this phase is recorded automatically in your Activity Log.</p>}
          {slot.kind === 'break' && <p>Use this phase to eat, buy something, use Xerox, or simply take your break.</p>}
          {slot.kind === 'lunch' && <p>Lunch is its own phase. Record food and spending here before it disappears.</p>}
          {isBreak && <ExpenseCapture iso={iso} category={slot.kind === 'lunch' ? 'food' : 'canteen'} note={`College ${slot.label}`} />}
          <div className="flow-actions">
            <Link to="/activity-log"><Button variant="ghost">Activity Log</Button></Link>
            <Link to="/college"><Button variant="ghost">College records</Button></Link>
          </div>
        </section>
        <div className="flow-footer-note">The next period/interval replaces this phase automatically.</div>
      </main>
    );
  }

  if (journey.loading) {
    return <main className="flow-screen"><section className="flow-hero"><p className="flow-kicker">DAILY FLOW</p><h1>Loading your next phase…</h1></section></main>;
  }

  if (currentRoutine) {
    const title = currentRoutine.title;
    const lower = `${title} ${currentRoutine.category} ${currentRoutine.moduleTag ?? ''}`.toLowerCase();
    const scheduleRow = morningSchedule.find((x) => x.routine.id === currentRoutine.id);
    const isBus = /bus|commute|travel/.test(lower);
    const isFood = /breakfast|eat|food|lunch|canteen|tea|snack/.test(lower);
    const isNaveen = /naveen/.test(lower);
    const isWorkout = /workout|gym|exercise/.test(lower) || currentRoutine.moduleTag === 'workout';
    const isGuitar = /guitar/.test(lower) || currentRoutine.moduleTag === 'guitar';
    const isSleep = /sleep|bed/.test(lower);
    const isNightRoutine = /bath|serum|face|skin|hair/.test(lower);
    const isMorning = /morning|brush|breakfast|wake|face|serum|wash/.test(lower);
    const hasTracks = (commuteTracks ?? []).some((t) => !t.deleted && (commutePlaylists ?? []).some((p) => !p.deleted && p.enabled && p.id === t.playlistId));
    void musicTick;

    return (
      <main className="flow-screen">
        <div className="flow-topline">
          <span>{profile?.name ?? 'Daily Flow'}</span>
          <span>{formatHm12(hm(clock))}</span>
        </div>
        <section className="flow-hero">
          <div className="flow-progress">Phase {journey.position.current} of {journey.position.total}</div>
          <div className="flow-icon">{journey.currentPhase?.icon ?? phaseIcon(title, currentRoutine.moduleTag)}</div>
          <p className="flow-kicker">{journey.currentPhase?.name ?? 'CURRENT PHASE'}</p>
          <h1>{title}</h1>
          <p>{currentRoutine.notes ?? currentRoutine.category}</p>

          {scheduleRow && isMorning && (
            <div className="flow-time-chip">Generated from wake time · {formatHm12(hm(scheduleRow.start))} → {formatHm12(hm(scheduleRow.end))}</div>
          )}

          {isBus && (
            <div className="phase-tools">
              <div className="phase-tool">
                <div className="phase-tool__title">🎵 Commute Music</div>
                <p>English + Tamil shuffled together. The queue avoids immediate repeats and continues until the commute ends.</p>
                <div className="phase-tool__row">
                  <Button variant="primary" disabled={!hasTracks} onClick={() => void startCommuteMusic()}>
                    {musicPlayer.playing ? '♫ Playing' : hasTracks ? 'Start random music' : 'Add songs in Music'}
                  </Button>
                  {musicPlayer.current && <span className="phase-now-playing">{musicPlayer.current.title}</span>}
                </div>
                <div className="phase-tool__row">
                  <Button variant="ghost" onClick={() => void musicPlayer.previous()}>Prev</Button>
                  <Button variant="ghost" onClick={() => musicPlayer.toggle()}>{musicPlayer.playing ? 'Pause' : 'Play'}</Button>
                  <Button variant="ghost" onClick={() => void musicPlayer.next()}>Next</Button>
                  <Link to="/music"><Button variant="ghost">Music</Button></Link>
                </div>
              </div>
              <ExpenseCapture iso={iso} category="transport" note={title} />
              {nowMinutes >= 8 * 60 + 50 && nowMinutes < 9 * 60 + 10 && (
                <div className="flow-alert">{nowMinutes < 9 * 60 ? 'WAKE UP BRO 😭 You have 5 mins to get the hell up.' : 'Get ready bro — you reach college around 9:10.'}</div>
              )}
            </div>
          )}

          {isFood && !isBus && (
            <div className="phase-tools">
              <div className="phase-tool">
                <div className="phase-tool__title">🍽️ Food phase</div>
                <p>Eat now. When this phase is complete it disappears and the next phase takes over.</p>
              </div>
              <ExpenseCapture iso={iso} category={/canteen|tea|snack/.test(lower) ? 'canteen' : 'food'} note={title} />
            </div>
          )}

          {isNaveen && (
            <div className="phase-tool">
              <div className="phase-tool__title">👥 Naveen Anna Time</div>
              <p>No artificial time limit. Stay as long as you actually spend time together. Finish this phase only when you are done.</p>
              <ExpenseCapture iso={iso} category="social" note="Naveen Anna" />
              <Link to="/social"><Button variant="ghost">Open social record</Button></Link>
            </div>
          )}

          {isWorkout && (
            <div className="phase-tool">
              <div className="phase-tool__title">🏋️ Workout</div>
              <p>{currentRoutine.durationMinutes ? `${currentRoutine.durationMinutes} minutes planned.` : 'Your configured workout duration applies here.'}</p>
              <Link to="/workout"><Button variant="secondary">Open workout details</Button></Link>
            </div>
          )}

          {isGuitar && (
            <div className="phase-tool">
              <div className="phase-tool__title">🎸 Guitar</div>
              <p>{currentRoutine.durationMinutes ? `${currentRoutine.durationMinutes} minutes planned.` : 'Your configured guitar duration applies here.'}</p>
              <Link to="/guitar"><Button variant="secondary">Open guitar session</Button></Link>
            </div>
          )}

          {isNightRoutine && !isFood && !isBus && !isNaveen && (
            <div className="phase-tool">
              <div className="phase-tool__title">🌙 Personal care</div>
              <p>This is part of your configured night routine. Complete it here and it will be recorded.</p>
            </div>
          )}

          {isSleep && (
            <div className="phase-tools">
              <div className="phase-tool">
                <div className="phase-tool__title">🌙 Night Music</div>
                <p>Random Night playlist for winding down. Songs are shuffled without immediate repetition.</p>
                <div className="phase-tool__row">
                  <Button variant="primary" onClick={() => void startNightMusic()}>
                    {musicPlayer.playing ? '♫ Playing' : 'Play Night Music'}
                  </Button>
                  {musicPlayer.current && <span className="phase-now-playing">{musicPlayer.current.title}</span>}
                </div>
                <div className="phase-tool__row">
                  <Button variant="ghost" onClick={() => void musicPlayer.previous()}>Prev</Button>
                  <Button variant="ghost" onClick={() => musicPlayer.toggle()}>{musicPlayer.playing ? 'Pause' : 'Play'}</Button>
                  <Button variant="ghost" onClick={() => void musicPlayer.next()}>Next</Button>
                  <Link to="/music"><Button variant="ghost">Music</Button></Link>
                </div>
              </div>
              <div className="phase-tool">
                <div className="phase-tool__title">🌙 Tomorrow&apos;s day type</div>
                <p>Choose what tomorrow actually is. Sunday is not assumed to be a rest day.</p>
                <TomorrowOrderCard date={clock} onConfigured={() => setTomorrowConfigured(true)} />
              </div>
              <Link to="/sleep"><Button variant="secondary">Open sleep record</Button></Link>
            </div>
          )}

          <div className="flow-actions">
            <Button variant="primary" disabled={isSleep && !tomorrowConfigured} onClick={() => void completeRoutine()}>{isSleep && !tomorrowConfigured ? 'Choose tomorrow first' : 'Done — next phase'}</Button>
            <Link to="/activity-log"><Button variant="ghost">Activity Log</Button></Link>
          </div>
        </section>
        <div className="flow-footer-note">Only this phase is active. Complete it and it disappears.</div>
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
          <p>Spin is available only inside the free-time window for this day type. The selected activity gets its own timed phase and record.</p>
          <Link to="/spin"><Button variant="primary">Open Spin Wheel</Button></Link>
          <Button variant="ghost" onClick={() => void finishCurrentPhase()}>Finish free-time phase</Button>
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
          <p>Everything completed today remains available in Activity Log and Spending.</p>
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
        <p className="flow-kicker">BETWEEN PHASES</p>
        <h1>You&apos;re between phases.</h1>
        <p>Current spending recorded today: ₹{moneyToday.reduce((s, x) => s + x.amount, 0).toFixed(0)}.</p>
        <Link to="/settings"><Button variant="secondary">Check day setup</Button></Link>
      </section>
    </main>
  );
}
