import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { EmptyState } from '../components/ui/States';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/routine/StatusBadge';
import { useToday } from '../hooks/useToday';
import { useDailyAgenda } from '../routine/hooks';
import { collegeDayStatusesRepo, spinHistoriesRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { formatArrivalTime } from '../college/stats';
import { formatHm12, formatIsoTime12 } from '../lib/timeFormat';
import { DayAsksCard } from '../day/DayAsksCard';
import { MealPrompt } from '../day/MealPrompt';
import { SpendPromptsCard } from '../day/SpendPromptsCard';
import { DaySpendSummary } from '../day/DaySpendSummary';
import { TomorrowOrderCard } from '../day/TomorrowOrderCard';
import { PeriodBoard } from '../day/PeriodBoard';
import { WellnessCard } from '../day/WellnessCard';
import { HomeArrivalPrompt } from '../day/HomeArrivalPrompt';
import { WakeCard } from '../day/WakeCard';
import { TravelCard } from '../day/TravelCard';

/**
 * Day Brief — professional daily command surface.
 * Yes/No asks, spend prompts, day order, timetable, agenda that vanishes when done.
 */
export default function Today() {
  const today = useToday();
  const { agenda, reminders, setStatus, clearStatus, profile } = useDailyAgenda(today.date);
  const todayIso = toIsoDate(today.date);
  const [showFinished, setShowFinished] = useState(false);

  const bunkStatus = useLiveQuery(async () => {
    const rows = await collegeDayStatusesRepo.list();
    return rows.find((d) => d.date === todayIso && !d.deleted && d.status === 'bunked');
  }, [todayIso]);

  const todaySpins = useLiveQuery(async () => {
    const rows = await spinHistoriesRepo.list();
    return rows
      .filter((h) => !h.deleted && h.date === todayIso && h.completed)
      .filter((h) => (h.actualMinutes ?? h.durationMinutes ?? 0) <= 12 * 60)
      .sort((a, b) =>
        (a.startedAt ?? a.createdAt) < (b.startedAt ?? b.createdAt) ? 1 : -1
      );
  }, [todayIso], []);

  const openAgenda = agenda.filter(
    ({ status }) => status !== 'done' && status !== 'skipped'
  );
  const finishedAgenda = agenda.filter(
    ({ status }) => status === 'done' || status === 'skipped' || status === 'partial'
  );

  return (
    <PageShell
      title="Day Brief"
      showBack={false}
      right={
        <Link to="/routines">
          <Button variant="ghost">Manage</Button>
        </Link>
      }
    >
      <WakeCard date={today.date} />
      <TravelCard date={today.date} />
      <PeriodBoard date={today.date} />
      <SpendPromptsCard date={today.date} />
      <HomeArrivalPrompt date={today.date} />
      <MealPrompt date={today.date} />
      <DayAsksCard date={today.date} />
      <WellnessCard date={today.date} />
      <DaySpendSummary date={today.date} />
      <TomorrowOrderCard date={today.date} />

      {profile && profile.systemKey !== 'bunk' && (
        <Card style={{ marginBottom: 12 }}>
          <strong>
            {profile.icon ?? '⭐'} {profile.name}
          </strong>
          {profile.effects.bannerMessage && (
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {profile.effects.bannerMessage}
            </p>
          )}
          <Link to="/special-days" style={{ marginTop: 8, display: 'inline-block' }}>
            <Button variant="secondary">Day checklist & plans</Button>
          </Link>
        </Card>
      )}

      {bunkStatus && (
        <Card style={{ marginBottom: 12 }}>
          <strong>🏃 Bunk day</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Home early
            {bunkStatus.homeArrivalTime
              ? ` around ${formatArrivalTime(bunkStatus.homeArrivalTime)}`
              : ''}
            . Afternoon/evening is free — log activities in College.
          </p>
          <Link to="/college" style={{ marginTop: 8, display: 'inline-block' }}>
            <Button variant="secondary">Open College</Button>
          </Link>
        </Card>
      )}

      {today.isWeekend && (
        <Card style={{ marginBottom: 12 }}>
          <strong>Weekend Mode</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            It&apos;s {today.dayName} — morning checklist, then free time.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/">
              <Button variant="secondary">Day Journey (Home)</Button>
            </Link>
            <Link to="/spin">
              <Button variant="primary">Spin Wheel</Button>
            </Link>
          </div>
        </Card>
      )}

      {todaySpins && todaySpins.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <strong>🎡 Today&apos;s spins</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {todaySpins.map((h) => (
              <li key={h.id} style={{ marginBottom: 6, fontSize: 'var(--text-sm)' }}>
                <span style={{ fontWeight: 600 }}>
                  {(h as { label?: string; wheelName?: string }).label ??
                    (h as { wheelName?: string }).wheelName ??
                    'Spin'}
                </span>
                {(h.actualMinutes ?? h.durationMinutes) != null && (
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {' '}
                    · {h.actualMinutes ?? h.durationMinutes} min
                  </span>
                )}
                {h.startedAt && (
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {' '}
                    · {formatIsoTime12(h.startedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reminders.length > 0 && (
        <div className="reminder-banner">
          🔔{' '}
          {reminders.length === 1
            ? `${reminders[0].routine.title} is coming up`
            : `${reminders.length} routines are coming up`}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 'var(--text-sm)' }}>Agenda</strong>
        {finishedAgenda.length > 0 && (
          <Button variant="ghost" onClick={() => setShowFinished((v) => !v)}>
            {showFinished ? 'Hide finished' : `Show ${finishedAgenda.length} finished`}
          </Button>
        )}
      </div>

      {agenda.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nothing scheduled for today"
          description="Add a routine — recurring or one-time — and it'll show up here on the days it's due."
          action={
            <Link to="/routines">
              <Button variant="secondary">Add a routine</Button>
            </Link>
          }
        />
      ) : openAgenda.length === 0 && !showFinished ? (
        <Card>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            All agenda items finished for today.
          </p>
        </Card>
      ) : (
        <Card style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          {(showFinished ? agenda : openAgenda).map(({ routine, status }, i, arr) => (
            <div
              key={routine.id}
              className="routine-item"
              style={{
                borderBottom:
                  i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                opacity: status === 'done' || status === 'skipped' ? 0.55 : 1,
              }}
            >
              <div className="routine-item__time">{formatHm12(routine.time)}</div>
              <div className="routine-item__body">
                <div className="routine-item__title-row">
                  <span className="routine-item__title">{routine.title}</span>
                  <StatusBadge status={status} />
                </div>
                <span className="routine-item__meta">
                  {routine.category}
                  {routine.durationMinutes ? ` · ${routine.durationMinutes} min` : ''}
                </span>
                {routine.notes && (
                  <span className="routine-item__notes">{routine.notes}</span>
                )}
                <div className="routine-item__actions">
                  {status !== 'done' && (
                    <Button variant="secondary" onClick={() => setStatus(routine.id, 'done')}>
                      Yes · done
                    </Button>
                  )}
                  {status !== 'skipped' && status !== 'done' && (
                    <Button variant="ghost" onClick={() => setStatus(routine.id, 'skipped')}>
                      Skip
                    </Button>
                  )}
                  {(status === 'done' || status === 'skipped' || status === 'partial') && (
                    <Button variant="ghost" onClick={() => clearStatus(routine.id)}>
                      Undo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
