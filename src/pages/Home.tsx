/**
 * Day Journey — exclusive phase UI.
 * Only the current journey phase's features are rendered.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToday } from '../hooks/useToday';
import { useDayProgress, useAllDayProfiles } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { deriveStatus } from '../routine/engine';
import { markPhaseComplete, isActionPhase } from '../day/phaseEngine';
import { forceRebuildToday } from '../day/migrateWeekend';
import {
  pickEncouragement,
  consequenceForTitle,
  isPastBunkSpinWindow,
  BUNK_SPIN_END_HM,
} from '../home/encourage';
import { MealPrompt } from '../day/MealPrompt';
import { LateWakeCard } from '../day/LateWakeCard';
import { DayAsksCard } from '../day/DayAsksCard';
import { BusMusicPhase } from '../day/BusMusicPhase';
import { CollegePhasePanel } from '../day/CollegePhasePanel';
import { NightPhasePanel } from '../day/NightPhasePanel';
import { TomorrowOrderCard } from '../day/TomorrowOrderCard';
import {
  type JourneyPhaseId,
  type JourneyState,
  JOURNEY_PHASE_META,
  resolveJourneyPhase,
  actionLeftHome,
  actionReachedCollege,
  actionLeftCollege,
  actionReachedHome,
  actionOpenWhatsTomorrow,
  actionFinishWhatsTomorrow,
  phaseAllows,
} from '../day/journeyState';
import { getWakeTime } from '../day/spendPrompts';
import { getDayOrderForDate } from '../college/dayOrder';
import { dayAssignmentsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { AppLogo } from '../appearance/AppLogo';
import { useHomeArrival } from '../home/HomeArrivalProvider';
import { useActiveDayProfile } from '../day/hooks';
import { formatHm12 } from '../lib/timeFormat';
import { buildTimeline, phaseDayPart, phaseHeading, minToHm } from '../day/timeline';
import { WAKE_LOGGED_EVENT } from '../day/wakeGate';
import { useNow } from '../hooks/useNow';
import '../day/day.css';
import '../day/timeline.css';

export default function Home() {
  const today = useToday();
  const now = useNow(today.date);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const iso = toIsoDate(today.date);
  const {
    progress,
    loading,
    refresh,
    currentPhase,
    phaseRoutines,
    completions,
    isComplete,
    position,
  } = useDayProgress(today.date);

  const { setStatus, clearStatus } = useDailyAgenda(today.date);
  const profiles = useAllDayProfiles();
  const { profile } = useActiveDayProfile(today.date);
  const homeArrival = useHomeArrival();
  const nudgeText = useMemo(
    () => pickEncouragement(today.isWeekend ? 'weekend' : 'general'),
    [today.isWeekend]
  );

  const [journey, setJourney] = useState<JourneyState | null>(null);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [wakeMin, setWakeMin] = useState<number | null>(null);
  const [skipRoast, setSkipRoast] = useState<string | null>(null);
  const [savingTomorrow, setSavingTomorrow] = useState(false);
  const [tomorrowSaved, setTomorrowSaved] = useState<string | null>(null);

  const tomorrowIso = useMemo(() => {
    const d = new Date(today.date);
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, [today.date]);

  const existingTomorrow = useLiveQuery(
    async () => {
      const rows = await dayAssignmentsRepo.list();
      return rows.find((a) => a.date === tomorrowIso && !a.deleted) ?? null;
    },
    [tomorrowIso],
    null
  );

  const reloadJourney = useCallback(async () => {
    const j = await resolveJourneyPhase(today.date, nowMin);
    setJourney(j);
    setDayOrder(await getDayOrderForDate(iso));
  }, [today.date, nowMin, iso]);

  useEffect(() => {
    void reloadJourney();
    const on = () => void reloadJourney();
    window.addEventListener('journey-state-changed', on);
    window.addEventListener('day-status-changed', on);
    return () => {
      window.removeEventListener('journey-state-changed', on);
      window.removeEventListener('day-status-changed', on);
    };
  }, [reloadJourney]);

  useEffect(() => {
    const load = () =>
      void getWakeTime(iso).then((w) => {
        if (!w) {
          setWakeMin(null);
          return;
        }
        const d = new Date(w.at);
        setWakeMin(d.getHours() * 60 + d.getMinutes());
      });
    load();
    const onWake = () => {
      load();
      void refresh();
      void reloadJourney();
    };
    window.addEventListener(WAKE_LOGGED_EVENT, onWake);
    return () => window.removeEventListener(WAKE_LOGGED_EVENT, onWake);
  }, [iso, refresh, reloadJourney]);

  const visibleRoutines = useMemo(() => {
    return phaseRoutines.filter((r) => {
      const status = deriveStatus(
        r,
        progress?.date ?? '',
        completions.find((c) => c.refType === 'routine' && c.refId === r.id),
        new Date()
      );
      return status !== 'done' && status !== 'skipped';
    });
  }, [phaseRoutines, completions, progress]);

  const timeline = useMemo(
    () =>
      buildTimeline(visibleRoutines, {
        wakeMin,
        nowMin,
        anchorToWake: !!currentPhase && phaseDayPart(currentPhase) === 'morning',
        anchorFrom: phaseRoutines,
      }),
    [visibleRoutines, phaseRoutines, wakeMin, nowMin, currentPhase]
  );

  const toggle = useCallback(
    async (routineId: string, currentlyDone: boolean) => {
      if (currentlyDone) await clearStatus(routineId);
      else await setStatus(routineId, 'done');
      await refresh();
    },
    [setStatus, clearStatus, refresh]
  );

  const skipItem = useCallback(
    async (routineId: string, title: string) => {
      await setStatus(routineId, 'skipped');
      setSkipRoast(consequenceForTitle(title));
      await refresh();
    },
    [setStatus, refresh]
  );

  const finishEnginePhase = useCallback(async () => {
    if (!currentPhase || !progress) return;
    await markPhaseComplete(today.date, currentPhase.id);
    await refresh();
  }, [currentPhase, progress, today.date, refresh]);

  const pickTomorrow = useCallback(
    async (profileId: string, name: string) => {
      setSavingTomorrow(true);
      try {
        if (existingTomorrow) {
          await dayAssignmentsRepo.update(existingTomorrow.id, { profileId });
        } else {
          await dayAssignmentsRepo.create({
            date: tomorrowIso,
            profileId,
            checklistDone: [],
            notes: '',
          });
        }
        const { dayProgressRepo } = await import('../data/repository');
        const rows = await dayProgressRepo.list();
        const tp = rows.find((d) => d.date === tomorrowIso && !d.deleted);
        if (tp) {
          await dayProgressRepo.update(tp.id, {
            phaseIdsToday: [],
            currentPhaseId: null,
            completedPhaseIds: [],
          });
        }
        setTomorrowSaved(name);
      } finally {
        setSavingTomorrow(false);
      }
    },
    [existingTomorrow, tomorrowIso]
  );

  const phase: JourneyPhaseId = journey?.phase ?? 'MORNING_BEFORE_LEAVING';
  const allows = phaseAllows(phase);
  const meta = JOURNEY_PHASE_META[phase];

  const goLeftHome = async () => {
    await actionLeftHome(iso);
    await reloadJourney();
  };
  const goReachedCollege = async () => {
    await actionReachedCollege(iso);
    await reloadJourney();
  };
  const goLeftCollege = async () => {
    await actionLeftCollege(iso);
    await reloadJourney();
  };
  const goReachedHome = async () => {
    await actionReachedHome(iso);
    await reloadJourney();
  };
  const goWhatsTomorrow = async () => {
    await actionOpenWhatsTomorrow(iso);
    await reloadJourney();
  };
  const finishTomorrow = async () => {
    await actionFinishWhatsTomorrow(iso);
    await reloadJourney();
  };

  if (loading && !progress && !journey) {
    return (
      <div className="page-shell">
        <div className="page-shell__content" style={{ padding: 24 }}>
          Loading today&apos;s journey…
        </div>
      </div>
    );
  }

  const timeLabel = (m: number | null) => (m == null ? '' : formatHm12(minToHm(m)));
  const [nowItem, ...laterItems] = timeline;
  const isBunk = profile?.systemKey === 'bunk';
  const homeReady =
    !(isBunk || profile?.systemKey === 'stay_out') ||
    homeArrival.insideHome === true ||
    (homeArrival.lastEvent?.kind === 'enter_home' &&
      homeArrival.lastEvent.at.slice(0, 10) === (progress?.date ?? ''));
  const bunkSpinClosed = isBunk && isPastBunkSpinWindow();
  const action = currentPhase ? isActionPhase(currentPhase) : false;

  /* ---------- Header (always) ---------- */
  const header = (
    <header
      className="page-shell__header"
      style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
        <AppLogo size={32} />
        <div style={{ flex: 1 }}>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {today.greeting}
          </span>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: 2,
            }}
          >
            {meta.icon} {meta.label}
            {dayOrder != null ? ` · Day order ${dayOrder}` : ''}
            {wakeMin != null ? ` · up since ${formatHm12(minToHm(wakeMin))}` : ''}
            {progress && position.total > 0
              ? ` · engine ${position.current}/${position.total}`
              : ''}
          </div>
        </div>
      </div>
      <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)', marginTop: 8 }}>
        {meta.icon} {meta.label}
      </h1>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        {meta.hint}
      </p>
    </header>
  );

  /* ---------- Routine timeline block (morning / home evening only) ---------- */
  const routineBlock = (allows.morningChecklist || allows.eveningRoutines) && (
    <>
      {skipRoast && (
        <Card style={{ marginBottom: 12, borderLeft: '3px solid #e85d4c' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{skipRoast}</p>
          <Button variant="ghost" onClick={() => setSkipRoast(null)}>
            Got it
          </Button>
        </Card>
      )}
      {!action && nowItem && (
        <section className="now-card" aria-live="polite">
          <div className={`now-card__label${nowItem.late ? ' now-card__label--late' : ''}`}>
            {nowItem.late
              ? `Overdue since ${timeLabel(nowItem.startMin)}`
              : nowItem.due
                ? 'Now'
                : nowItem.startMin != null
                  ? `Next at ${timeLabel(nowItem.startMin)}`
                  : 'Next'}
          </div>
          <div className="now-card__title">{nowItem.routine.title}</div>
          <div className="now-card__meta">
            {[
              timeLabel(nowItem.startMin),
              nowItem.routine.durationMinutes ? `${nowItem.routine.durationMinutes} min` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="now-card__actions">
            <Button variant="primary" onClick={() => void toggle(nowItem.routine.id, false)}>
              Done
            </Button>
            <Button
              variant="ghost"
              onClick={() => void skipItem(nowItem.routine.id, nowItem.routine.title)}
            >
              Skip
            </Button>
          </div>
        </section>
      )}
      {!action && laterItems.length > 0 && (
        <div>
          <div className="timeline-heading">Coming up</div>
          <ul className="timeline-list">
            {laterItems.map((item) => (
              <li key={item.routine.id}>
                <Card
                  interactive
                  className="timeline-row"
                  onClick={() => void toggle(item.routine.id, false)}
                >
                  <span
                    className={`timeline-row__dot${item.late ? ' timeline-row__dot--late' : ''}`}
                  />
                  <div className="timeline-row__body">
                    <div className="timeline-row__title">{item.routine.title}</div>
                    <div className="timeline-row__meta">
                      {[
                        timeLabel(item.startMin),
                        item.routine.durationMinutes ? `${item.routine.durationMinutes}m` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="timeline-row__skip"
                    onClick={(e) => {
                      e.stopPropagation();
                      void skipItem(item.routine.id, item.routine.title);
                    }}
                  >
                    Skip
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  /* ---------- Phase bodies ---------- */
  let body: ReactNode = null;

  if (phase === 'MORNING_BEFORE_LEAVING') {
    body = (
      <>
        <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{nudgeText}</p>
        </Card>
        {allows.lateWake && <LateWakeCard date={today.date} wakeMin={wakeMin} />}
        {routineBlock}
        {allows.leaveAsks && <DayAsksCard date={today.date} forceSlot="morning" />}
        {allows.mealMorning && <MealPrompt date={today.date} />}

        {dayOrder == null && !today.isWeekend && (
          <Card style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              No day order yet (leave/bunk days don&apos;t consume order). Set order in College if
              you&apos;re attending.
            </p>
            <Link to="/college">
              <Button variant="ghost" style={{ marginTop: 8 }}>
                College / day order
              </Button>
            </Link>
          </Card>
        )}
        <Card style={{ textAlign: 'center', padding: '20px 16px', marginTop: 8 }}>
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>Leaving home now?</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
            Yes → bus phase (asks if you entered the bus, then music).
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => void goLeftHome()}>
              Yes — left home
            </Button>
            <Button variant="ghost" onClick={() => { /* stay in morning */ }}>
              Not yet
            </Button>
          </div>
        </Card>
      </>
    );
  } else if (phase === 'MORNING_BUS') {
    body = <BusMusicPhase direction="morning" onArrived={() => void goReachedCollege()} />;
  } else if (phase === 'COLLEGE') {
    body = <CollegePhasePanel date={today.date} onLeaveCollege={() => void goLeftCollege()} />;
  } else if (phase === 'EVENING_BUS') {
    body = <BusMusicPhase direction="evening" onArrived={() => void goReachedHome()} />;
  } else if (phase === 'HOME_EVENING') {
    body = (
      <>
        <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{nudgeText}</p>
        </Card>
        {routineBlock}
        {action && !homeReady && (
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🚪</div>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 8px' }}>
              Out of the house
            </p>
            <Button
              variant="primary"
              onClick={async () => {
                await homeArrival.imHome();
                await refresh();
              }}
            >
              I&apos;m home — unlock free time
            </Button>
          </Card>
        )}
        {action && homeReady && bunkSpinClosed && (
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontWeight: 600 }}>Free time closed ({BUNK_SPIN_END_HM})</p>
            <Button variant="primary" onClick={finishEnginePhase}>
              Continue to evening →
            </Button>
          </Card>
        )}
        {action && homeReady && !bunkSpinClosed && (
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎡</div>
            <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Free time / spin</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/spin">
                <Button variant="primary">Open Spin Wheel</Button>
              </Link>
              <Button variant="secondary" onClick={finishEnginePhase}>
                Done with free time →
              </Button>
            </div>
          </Card>
        )}
        {currentPhase && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Engine phase: {phaseHeading(currentPhase.name)}
          </p>
        )}
        <Card style={{ textAlign: 'center', padding: '16px', marginTop: 12 }}>
          <Button variant="primary" onClick={() => void goWhatsTomorrow()}>
            What&apos;s tomorrow? →
          </Button>
        </Card>
      </>
    );
  } else if (phase === 'WHATS_TOMORROW') {
    const quickProfiles = profiles.filter((p) => p.enabled).slice(0, 8);
    body = (
      <>
        <Card style={{ marginBottom: 12 }}>
          <strong>What&apos;s tomorrow?</strong>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Set day type. Day order keeps running 1→6 every day — leave still gets the next order
            number (timetable sequence does not freeze).
          </p>
        </Card>
        <TomorrowOrderCard />
        <div className="day-profile-grid" style={{ marginTop: 12 }}>
          {quickProfiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`day-profile-tile${
                existingTomorrow?.profileId === p.id || tomorrowSaved === p.name
                  ? ' day-profile-tile--active'
                  : ''
              }`}
              disabled={savingTomorrow}
              onClick={() => pickTomorrow(p.id, p.name)}
            >
              <span className="day-profile-tile__icon">{p.icon ?? '📅'}</span>
              <span className="day-profile-tile__name">{p.name}</span>
            </button>
          ))}
        </div>
        {tomorrowSaved && (
          <p style={{ color: 'var(--color-accent)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
            ✓ Tomorrow is “{tomorrowSaved}”
          </p>
        )}
        <Card style={{ textAlign: 'center', padding: '16px', marginTop: 16 }}>
          <Button variant="primary" onClick={() => void finishTomorrow()}>
            Done — good night →
          </Button>
        </Card>
      </>
    );
  } else if (phase === 'NIGHT') {
    body = <NightPhasePanel date={today.date} />;
  }

  return (
    <div className="page-shell day-journey">
      {header}
      <div className="page-shell__content">
        {body}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/settings">
            <Button variant="ghost">Settings & modules</Button>
          </Link>
          {(isComplete || !currentPhase) && phase !== 'NIGHT' && (
            <Button
              variant="ghost"
              style={{ marginLeft: 8 }}
              onClick={async () => {
                await forceRebuildToday(today.date);
                await refresh();
              }}
            >
              Rebuild engine phases
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
