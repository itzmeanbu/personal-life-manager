/**
 * Day Journey — current phase only. Completed checklist items vanish.
 * Spin phase gets a big CTA. End-of-day asks what tomorrow looks like.
 */
import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToday } from '../hooks/useToday';
import { useDayProgress, useAllDayProfiles } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { deriveStatus, STATUS_LABELS } from '../routine/engine';
import { markPhaseComplete, isActionPhase } from '../day/phaseEngine';
import { forceRebuildToday } from '../day/migrateWeekend';
import { pickEncouragement } from '../home/encourage';
import { MealPrompt } from '../day/MealPrompt';
import { getContinueCandidates } from '../entertainment/continue';
import { dayAssignmentsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { AppLogo } from '../appearance/AppLogo';
import { useHomeArrival } from '../home/HomeArrivalProvider';
import { useActiveDayProfile } from '../day/hooks';
import '../day/day.css';

export default function Home() {
  const today = useToday();
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
  const nudgeText = useMemo(() => pickEncouragement(today.isWeekend ? 'weekend' : 'general'), [today.isWeekend]);
  const continueWatch = useLiveQuery(() => getContinueCandidates(2), [], []);
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

  // Only show incomplete items — done ones vanish
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

  const doneCount = phaseRoutines.length - visibleRoutines.length;
  const totalCount = phaseRoutines.length;
  const pct =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const toggle = useCallback(
    async (routineId: string, currentlyDone: boolean) => {
      if (currentlyDone) {
        await clearStatus(routineId);
      } else {
        await setStatus(routineId, 'done');
      }
      await refresh();
    },
    [setStatus, clearStatus, refresh]
  );

  const finishSpinPhase = useCallback(async () => {
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
        // Clear any pre-built progress for tomorrow so phases rebuild under new profile
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

  if (loading && !progress) {
    return (
      <div className="page-shell">
        <div className="page-shell__content" style={{ padding: 24 }}>
          Loading today’s journey…
        </div>
      </div>
    );
  }

  const noPhases =
    !progress ||
    progress.phaseIdsToday.length === 0 ||
    (!currentPhase && (progress.completedPhaseIds?.length ?? 0) === 0);

  if (noPhases && !loading) {
    return (
      <div className="page-shell day-journey">
        <header className="page-shell__header" style={{ flexDirection: 'column', gap: 4 }}>
          <AppLogo size={36} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {today.greeting}
          </span>
          <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)' }}>
            {today.dayName}
          </h1>
        </header>
        <div className="page-shell__content">
          <Card style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{today.isWeekend ? '🎡' : '☀️'}</div>
            <p style={{ fontWeight: 600, margin: '0 0 8px' }}>
              {today.isWeekend ? 'Weekend journey not loaded yet' : 'No phases for today yet'}
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
              Facial / morning stuff runs every day. Sat/Sun also get Spin & Free Time after morning.
              Tap to load today.
            </p>
            <Button
              variant="primary"
              onClick={async () => {
                await forceRebuildToday(today.date);
                await refresh();
              }}
            >
              Load today's journey
            </Button>
          </Card>
          {today.isWeekend && (
            <Card style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px' }}>Or jump straight to the wheel</p>
              <Link to="/spin">
                <Button variant="secondary">Open Spin Wheel</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    );
  }

  /* -------------------- ALL DONE -------------------- */
  if (isComplete || !currentPhase) {
    const quickProfiles = profiles.filter((p) => p.enabled).slice(0, 8);
    const tileHint = (key?: string | null) => {
      switch (key) {
        case 'bunk': return 'Home early · spin after you arrive';
        case 'rest': return 'Spin wheel day · no college';
        case 'holiday': return 'Off day · free time';
        case 'hackathon': return 'Build mode · sleep optional';
        case 'exam': return 'Focus · light day';
        case 'normal': return 'College day';
        case 'sunday': return 'Reset & plan';
        default: return '';
      }
    };
    return (
      <div className="page-shell day-journey">
        <header className="page-shell__header" style={{ flexDirection: 'column', gap: 4 }}>
          <AppLogo size={36} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {today.greeting}
          </span>
          <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)' }}>
            All done for today
          </h1>
        </header>
        <div className="page-shell__content">
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
              🎉 You’ve finished every phase for {today.dayName}.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, marginBottom: 0 }}>
              Rest well. A new journey starts at midnight.
            </p>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {today.isWeekend && (
                <Link to="/spin">
                  <Button variant="secondary">Open Spin Wheel</Button>
                </Link>
              )}
              <Button
                variant="ghost"
                onClick={async () => {
                  await forceRebuildToday(today.date);
                  await refresh();
                }}
              >
                Restart today's journey
              </Button>
            </div>
          </Card>

          <h2 style={{ fontSize: 'var(--text-base)', margin: '0 0 8px' }}>
            What’s tomorrow?
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 0 }}>
            One tap — no menus. Change anytime in Special Days.
          </p>

          <div className="day-profile-grid">
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
                {tileHint(p.systemKey) ? (
                  <span className="day-profile-tile__hint" style={{ fontSize: 11, opacity: 0.75 }}>
                    {tileHint(p.systemKey)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tomorrowSaved && (
            <p style={{ color: 'var(--color-accent)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
              ✓ Tomorrow is “{tomorrowSaved}” — phases will follow that plan (e.g. bunk = no college,
              spin after you get home).
            </p>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/special-days">
              <Button variant="secondary">Edit day types</Button>
            </Link>
            <Link to="/weekly-schedule">
              <Button variant="ghost">Weekly schedule</Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost">Settings</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }


  const isBunk = profile?.systemKey === 'bunk';
  const homeReady =
    !isBunk ||
    homeArrival.insideHome === true ||
    (homeArrival.lastEvent?.kind === 'enter_home' &&
      homeArrival.lastEvent.at.slice(0, 10) === (progress?.date ?? ''));

  const action = isActionPhase(currentPhase);

  /* -------------------- ACTIVE PHASE -------------------- */
  return (
    <div className="page-shell day-journey">
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
              Phase {position.current} of {position.total}
              {totalCount > 0 ? ` · ${doneCount}/${totalCount}` : ''}
            </div>
          </div>
        </div>
        <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)', marginTop: 8 }}>
          {currentPhase.icon ? `${currentPhase.icon} ` : ''}
          {currentPhase.name}
        </h1>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: 'var(--color-border)',
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'var(--color-accent)',
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        )}
      </header>

      <div className="page-shell__content">
        <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{nudgeText}</p>
        </Card>
        <MealPrompt date={today.date} />
        {continueWatch && continueWatch.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Continue watching</div>
            {continueWatch.map(({ item, suggestion }) => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>{suggestion}</div>
              </div>
            ))}
            <Link to="/entertainment">
              <Button variant="ghost">Open list</Button>
            </Link>
          </Card>
        )}
        {/* SPIN / FREE TIME phase */}
        {action && !homeReady && (
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🚪</div>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 8px' }}>
              Out of the house
            </p>
            <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 16px', fontSize: 'var(--text-sm)' }}>
              Bunk day / time with people counts as being out. Spin unlocks after you get home —
              no pressure to rush. Tap when you walk in.
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
        {action && homeReady && (
          <Card style={{ marginBottom: 16, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎡</div>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 8px' }}>
              You&apos;re home — free time
            </p>
            <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 16px', fontSize: 'var(--text-sm)' }}>
              Spin for K-drama, games, coding, or rest. Sessions stop by 9:00 so bath + sleep still fit.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/spin">
                <Button variant="primary">Open Spin Wheel</Button>
              </Link>
              <Button variant="secondary" onClick={finishSpinPhase}>
                Done with free time →
              </Button>
            </div>
          </Card>
        )}

        {/* Checklist — incomplete only */}
        {!action && visibleRoutines.length === 0 && totalCount === 0 && (
          <Card>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              Nothing scheduled for this phase today. It will skip automatically when you refresh,
              or mark it done below.
            </p>
            <Button variant="secondary" style={{ marginTop: 12 }} onClick={finishSpinPhase}>
              Skip this phase
            </Button>
          </Card>
        )}

        {!action && visibleRoutines.length === 0 && totalCount > 0 && (
          <Card style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-lg)', margin: 0 }}>✓ Phase complete</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Advancing to the next phase…
            </p>
          </Card>
        )}

        {visibleRoutines.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {visibleRoutines.map((routine) => {
              const status = deriveStatus(
                routine,
                progress!.date,
                completions.find((c) => c.refType === 'routine' && c.refId === routine.id),
                new Date()
              );
              return (
                <li key={routine.id}>
                  <Card
                    interactive
                    onClick={() => toggle(routine.id, false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      title={STATUS_LABELS[status]}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        border:
                          status === 'missed'
                            ? '2px solid var(--color-danger)'
                            : '2px solid var(--color-border)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{routine.title}</div>
                      {routine.time && (
                        <div
                          style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {routine.time}
                          {routine.durationMinutes ? ` · ${routine.durationMinutes}m` : ''}
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {doneCount > 0 && (
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-sm)',
              marginTop: 12,
            }}
          >
            {doneCount} done — vanished from list
          </p>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/settings">
            <Button variant="ghost">Settings & modules</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
