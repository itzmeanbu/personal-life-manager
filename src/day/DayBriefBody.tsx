/**
 * Day Brief content — merged into the unified Home/Today page so "Home"
 * and "Today" aren't two separate views of the same day anymore.
 * Command-center cards (day order & live class, spend prompts, tomorrow's
 * plan, …) plus the full agenda list, all in one place, one scroll.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { StatusBadge } from '../components/routine/StatusBadge';
import { useDailyAgenda } from '../routine/hooks';
import { collegeDayStatusesRepo, spinHistoriesRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { formatArrivalTime } from '../college/stats';
import { formatHm12, formatIsoTime12 } from '../lib/timeFormat';
import { SpendPromptsCard } from './SpendPromptsCard';
import { DaySpendSummary } from './DaySpendSummary';
import { TomorrowOrderCard } from './TomorrowOrderCard';
import { PeriodBoard } from './PeriodBoard';
import { WellnessCard } from './WellnessCard';
import { HomeArrivalPrompt } from './HomeArrivalPrompt';
import { DueNotifyCard } from './DueNotifyCard';
import { FreeTimeSpinCard } from './FreeTimeSpinCard';
import { effectiveDayStatus, CODING_SKIPPED_RE } from './spendPrompts';

export function DayBriefBody({ date = new Date() }: { date?: Date }) {
  const { agenda, reminders, setStatus, clearStatus, profile } = useDailyAgenda(date);
  const todayIso = toIsoDate(date);
  const [showFinished, setShowFinished] = useState(false);
  const [isCoding, setIsCoding] = useState(false);
  useEffect(() => {
    void effectiveDayStatus(todayIso).then((s) => setIsCoding(s === 'coding'));
    const t = window.setInterval(
      () => void effectiveDayStatus(todayIso).then((s) => setIsCoding(s === 'coding')),
      5_000
    );
    return () => clearInterval(t);
  }, [todayIso]);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });

  const collegeStatus = useLiveQuery(async () => {
    const rows = await collegeDayStatusesRepo.list();
    return rows.find((d) => d.date === todayIso && !d.deleted) ?? null;
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

  const visibleAgenda = isCoding
    ? agenda.filter(
        ({ routine }) => !CODING_SKIPPED_RE.test(`${routine.category} ${routine.title}`)
      )
    : agenda;
  const openAgenda = visibleAgenda.filter(
    ({ status }) => status !== 'done' && status !== 'skipped'
  );
  const finishedAgenda = visibleAgenda.filter(
    ({ status }) => status === 'done' || status === 'skipped' || status === 'partial'
  );

  return (
    <>
      <PeriodBoard date={date} />
      <DueNotifyCard />
      {!isCoding && <FreeTimeSpinCard date={date} />}
      <SpendPromptsCard date={date} />
      <HomeArrivalPrompt date={date} />
      <WellnessCard date={date} />
      <DaySpendSummary date={date} />
      <TomorrowOrderCard date={date} />

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

      {collegeStatus &&
        (collegeStatus.status === 'bunked' ||
          collegeStatus.status === 'left_early' ||
          collegeStatus.status === 'attended') && (
          <Card style={{ marginBottom: 12 }}>
            <strong>
              {collegeStatus.status === 'attended'
                ? '🎓 College: attended'
                : collegeStatus.status === 'left_early'
                  ? '🚪 College: left early'
                  : '🏃 College: bunked'}
            </strong>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {collegeStatus.status === 'attended'
                ? 'Full day — you can switch to Left early later if needed.'
                : `Free time starts${
                    collegeStatus.homeArrivalTime
                      ? ` around ${formatArrivalTime(collegeStatus.homeArrivalTime)}`
                      : ''
                  }. Morning routines stay normal.`}
            </p>
            <Link to="/college" style={{ marginTop: 8, display: 'inline-block' }}>
              <Button variant="secondary">Open College</Button>
            </Link>
          </Card>
        )}

      {isWeekend && !isCoding && (
        <Card style={{ marginBottom: 12 }}>
          <strong>Weekend</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            It&apos;s {dayName} — day starts when you wake. Spin is available until 10:00 PM.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  {h.optionLabel ?? h.wheelName ?? 'Spin'}
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
                {h.completed === false && (
                  <span style={{ color: 'var(--color-text-secondary)' }}> · in progress</span>
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

      {visibleAgenda.length === 0 ? (
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
          {(showFinished ? visibleAgenda : openAgenda).map(({ routine, status }, i, arr) => (
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
    </>
  );
}
