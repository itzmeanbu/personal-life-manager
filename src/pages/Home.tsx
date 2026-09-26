/**
 * Day Journey screen — replaces the old module-grid Home.
 * Shows only the current active phase full-screen. When the phase is
 * completed it vanishes and the next phase appears automatically.
 */
import { useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/routine/StatusBadge';
import { useToday } from '../hooks/useToday';
import { useDayProgress } from '../day/hooks';
import { useDailyAgenda } from '../routine/hooks';
import { deriveStatus } from '../routine/engine';
import type { Routine } from '../data/types';
import { AppLogo } from '../appearance/AppLogo';
import { Link } from 'react-router-dom';

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

  const markDone = useCallback(
    async (routineId: string) => {
      await setStatus(routineId, 'done');
      await refresh();
    },
    [setStatus, refresh]
  );

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

  if (loading && !progress) {
    return (
      <div className="page-shell">
        <div className="page-shell__content" style={{ padding: 24 }}>
          Loading today’s journey…
        </div>
      </div>
    );
  }

  if (isComplete || !currentPhase) {
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
          <Card>
            <p style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
              🎉 You’ve completed every phase for {today.dayName}.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Rest well. Tomorrow’s journey starts fresh at midnight.
            </p>
            <Link to="/settings" style={{ marginTop: 16, display: 'inline-block' }}>
              <Button variant="secondary">Settings</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

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
                color: 'var(--color-text-tertiary, var(--color-text-secondary))',
                marginTop: 2,
              }}
            >
              Phase {position.current} of {position.total}
            </div>
          </div>
        </div>
        <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)', marginTop: 8 }}>
          {currentPhase.icon ? `${currentPhase.icon} ` : ''}
          {currentPhase.name}
        </h1>
      </header>

      <div className="page-shell__content">
        {phaseRoutines.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Nothing scheduled for this phase today. Advancing…
            </p>
          </Card>
        ) : (
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
            {phaseRoutines.map((routine) => {
              const status = deriveStatus(
                routine,
                progress!.date,
                completions.find((c) => c.refType === 'routine' && c.refId === routine.id),
                new Date()
              );
              const done = status === 'done' || status === 'skipped';
              return (
                <li key={routine.id}>
                  <Card
                    interactive
                    onClick={() => toggle(routine.id, done)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      opacity: done ? 0.55 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        border: done
                          ? '2px solid var(--color-accent)'
                          : '2px solid var(--color-border)',
                        background: done ? 'var(--color-accent)' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: done ? '#fff' : 'transparent',
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {done ? '✓' : ''}
                    </span>
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
                    <StatusBadge status={status} />
                  </Card>
                </li>
              );
            })}
          </ul>
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
