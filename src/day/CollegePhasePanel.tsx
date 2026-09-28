/**
 * College phase — day type (full / half / bunk / leave) lives HERE.
 * Period board + free-time spin only when relevant.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PeriodBoard } from './PeriodBoard';
import {
  DAY_STATUS_OPTIONS,
  dayStatusLabel,
  effectiveDayStatus,
  setDayStatus,
  type TomorrowDayOrder,
} from './spendPrompts';
import { getDayOrderForDate, markDayOrderUsed } from '../college/dayOrder';
import { toIsoDate } from '../routine/engine';

const COLLEGE_OPTIONS: TomorrowDayOrder[] = [
  'college',
  'bunk',
  'didnt_go',
  'leave',
  'coding',
];

export function CollegePhasePanel({
  date = new Date(),
  onLeaveCollege,
}: {
  date?: Date;
  onLeaveCollege: () => void;
}) {
  const iso = toIsoDate(date);
  const [status, setStatus] = useState<TomorrowDayOrder | null>(null);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const s = await effectiveDayStatus(iso);
    setStatus(s);
    const order = await getDayOrderForDate(iso);
    setDayOrder(order);
  }, [iso]);

  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener('day-status-changed', on);
    return () => window.removeEventListener('day-status-changed', on);
  }, [reload]);

  const pick = async (order: TomorrowDayOrder) => {
    setBusy(true);
    try {
      await setDayStatus(iso, order);
      if (order === 'college') {
        const n = await getDayOrderForDate(iso);
        if (n) await markDayOrderUsed(iso, n);
      }
      await reload();
      window.dispatchEvent(new Event('day-status-changed'));
    } finally {
      setBusy(false);
    }
  };

  const attending = status === 'college' || status == null;
  const halfOrBunk = status === 'bunk';

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <strong>What&apos;s today&apos;s college status?</strong>
        <p style={{ margin: '6px 0 10px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Bunk / half-day is part of college — not a separate phase. This changes free time and
          whether day-order advances.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COLLEGE_OPTIONS.map((id) => {
            const opt = DAY_STATUS_OPTIONS.find((o) => o.id === id);
            if (!opt) return null;
            const active = status === id || (id === 'college' && status == null);
            return (
              <Button
                key={id}
                variant={active ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => void pick(id)}
              >
                {opt.emoji} {opt.label}
              </Button>
            );
          })}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>
          Now: {dayStatusLabel(status)}
          {dayOrder != null ? ` · Day order ${dayOrder} (runs even on leave)` : ' · Set day order 1–6 once to start the chain'}
        </p>
      </Card>



      {(attending || halfOrBunk) && <PeriodBoard />}

      {halfOrBunk && (
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎡</div>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Free time (bunk / half-day)</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>
            Spin only while you actually have free periods. When you leave campus, continue to bus home.
          </p>
          <Link to="/spin">
            <Button variant="primary">Open Spin Wheel</Button>
          </Link>
        </Card>
      )}

      <Card style={{ textAlign: 'center', padding: '16px' }}>
        <Button variant="primary" onClick={onLeaveCollege}>
          Leaving college → evening bus
        </Button>
      </Card>
    </div>
  );
}
