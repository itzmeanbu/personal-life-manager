import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { EmptyState } from '../components/ui/States';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/routine/StatusBadge';
import { useToday } from '../hooks/useToday';
import { useDailyAgenda } from '../routine/hooks';
import { collegeDayStatusesRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { formatArrivalTime } from '../college/stats';

export default function Today() {
  const today = useToday();
  const { agenda, reminders, setStatus, clearStatus, profile } = useDailyAgenda(today.date);
  const todayIso = toIsoDate(today.date);

  const bunkStatus = useLiveQuery(async () => {
    const rows = await collegeDayStatusesRepo.list();
    return rows.find((d) => d.date === todayIso && !d.deleted && d.status === 'bunked');
  }, [todayIso]);

  return (
    <PageShell
      title="Today"
      showBack={false}
      right={
        <Link to="/routines">
          <Button variant="ghost">Manage</Button>
        </Link>
      }
    >
      {profile && profile.systemKey !== 'bunk' && (
        <Card>
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
        <Card>
          <strong>🏃 Bunk day</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Home early
            {bunkStatus.homeArrivalTime
              ? ` around ${formatArrivalTime(bunkStatus.homeArrivalTime)}`
              : ''}
            . Afternoon/evening is free — log activities in the College module.
            Normal college-day routines stay in the template unchanged.
          </p>
          <Link to="/college" style={{ marginTop: 8, display: 'inline-block' }}>
            <Button variant="secondary">Open College</Button>
          </Link>
        </Card>
      )}
      {today.isWeekend && (
        <Card>
          <strong>Weekend Mode</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            It's {today.dayName} — check the Weekend module for weekend-only plans.
          </p>
        </Card>
      )}
      {today.isSunday && (
        <Card>
          <strong>Sunday Reset</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            A good day to plan the week ahead — this space will host that ritual.
          </p>
        </Card>
      )}

      {reminders.length > 0 && (
        <div className="reminder-banner">
          🔔 {reminders.length === 1
            ? `${reminders[0].routine.title} is coming up`
            : `${reminders.length} routines are coming up`}
        </div>
      )}

      {agenda.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nothing scheduled for today"
          description="Add a routine — recurring or one-time — and it'll show up here automatically on the days it's due."
          action={
            <Link to="/routines">
              <Button variant="secondary">Add a routine</Button>
            </Link>
          }
        />
      ) : (
        <Card style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          {agenda.map(({ routine, status }, i) => (
            <div
              key={routine.id}
              className="routine-item"
              style={{ borderBottom: i < agenda.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            >
              <div className="routine-item__time">{routine.time ?? '—'}</div>
              <div className="routine-item__body">
                <div className="routine-item__title-row">
                  <span className="routine-item__title">{routine.title}</span>
                  <StatusBadge status={status} />
                </div>
                <span className="routine-item__meta">
                  {routine.category}
                  {routine.durationMinutes ? ` · ${routine.durationMinutes} min` : ''}
                </span>
                {routine.notes && <span className="routine-item__notes">{routine.notes}</span>}
                <div className="routine-item__actions">
                  {status !== 'done' && (
                    <Button variant="secondary" onClick={() => setStatus(routine.id, 'done')}>
                      Mark done
                    </Button>
                  )}
                  {status !== 'skipped' && (
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
