/**
 * Automatic free-time Spin prompt for Day Brief.
 * Surfaces when a free window exists (college early leave or weekend).
 * Does not require the user to create a free-time block.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import { collegeDayStatusesRepo, dayProfilesRepo, dayAssignmentsRepo } from '../data/repository';
import { getNormalHomeArrival } from '../college/defaults';
import {
  computeFreeTimeWindow,
  formatMinutes,
  type FreeTimeWindow,
} from '../spin/timeBudget';
import { formatArrivalTime } from '../college/stats';

export function FreeTimeSpinCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [freeWin, setFreeWin] = useState<FreeTimeWindow | null>(null);
  const [tick, setTick] = useState(0);

  const college = useLiveQuery(async () => {
    const rows = await collegeDayStatusesRepo.list();
    return rows.find((d) => d.date === iso && !d.deleted) ?? null;
  }, [iso]);

  const profileActive = useLiveQuery(async () => {
    const [assignments, profiles] = await Promise.all([
      dayAssignmentsRepo.list(),
      dayProfilesRepo.list(),
    ]);
    const a = assignments.find((x) => x.date === iso && !x.deleted);
    if (!a) return false;
    const p = profiles.find((x) => x.id === a.profileId && !x.deleted && x.enabled);
    if (!p) return false;
    const key = p.systemKey;
    return key === 'rest' || key === 'holiday' || key === 'stay_out' || (p.effects?.activateSpinWheelNames?.length ?? 0) > 0;
  }, [iso]);

  const recalc = useCallback(async () => {
    const now = new Date();
    const normalHome = await getNormalHomeArrival();
    const status = college?.status ?? 'none';
    const early =
      status === 'left_early' ||
      status === 'bunked' ||
      Boolean(college?.homeArrivalTime && status !== 'attended' && status !== 'none');

    const w = computeFreeTimeWindow({
      now,
      collegeStatus: status,
      collegeHomeArrivalHm: early ? college?.homeArrivalTime ?? null : null,
      nextFixedRoutineHm: normalHome || '19:30',
      weekendWakeHm: '14:00',
      profileActivatesSpin: Boolean(profileActive),
    });
    setFreeWin(w);
  }, [college, profileActive]);

  useEffect(() => {
    void recalc();
  }, [recalc, tick]);

  useEffect(() => {
    const t = globalThis.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!freeWin || !freeWin.active) {
    // Soft hint when free time is scheduled but not yet started
    if (
      freeWin &&
      freeWin.source === 'college_early' &&
      freeWin.remainingMinutes > 0 &&
      !freeWin.active &&
      college?.homeArrivalTime
    ) {
      return (
        <Card style={{ marginBottom: 12 }}>
          <strong>🕐 Free time later</strong>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, marginBottom: 0 }}>
            From {formatArrivalTime(college.homeArrivalTime)} until your next fixed routine.
            Spin will open automatically when the window starts.
          </p>
        </Card>
      );
    }
    return null;
  }

  const sourceLabel =
    freeWin.source === 'weekend'
      ? 'Weekend free time'
      : freeWin.source === 'college_early'
        ? 'College free time'
        : 'Free time';

  return (
    <Card style={{ marginBottom: 12 }}>
      <strong>🎡 {sourceLabel}</strong>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 6, marginBottom: 0 }}>
        {freeWin.label}.
      </p>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
        Window {formatArrivalTime(freeWin.startHm)} – {formatArrivalTime(freeWin.endHm)} ·{' '}
        {formatMinutes(freeWin.remainingMinutes)} left
      </p>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/spin">
          <Button variant="primary">Spin the wheel?</Button>
        </Link>
      </div>
    </Card>
  );
}
