/**
 * Shows after wake is logged on a college weekday.
 * Tells you: on time / join after P1 / cooked — with concrete leave times.
 */
import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  buildLateWakePlan,
  getLateWakeConfig,
  type LateWakePlan,
} from '../college/lateWake';
import { setDayStatus, effectiveDayStatus } from './spendPrompts';
import { collegeDayStatusesRepo } from '../data/repository';
import { minToHm } from './timeline';
import { formatHm12 } from '../lib/timeFormat';

export function LateWakeCard({
  date = new Date(),
  wakeMin,
}: {
  date?: Date;
  wakeMin: number | null;
}) {
  const iso = toIsoDate(date);
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  const [plan, setPlan] = useState<LateWakePlan | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (wakeMin == null || isWeekend) {
        setPlan(null);
        return;
      }
      const status = await effectiveDayStatus(iso);
      // If already bunked / coding / leave, still show plan for transparency
      const cfg = await getLateWakeConfig();
      const isCollegeDay =
        status !== 'coding' &&
        status !== 'leave' &&
        status !== 'coimbatore_stay';
      const p = buildLateWakePlan(wakeMin, cfg, { isWeekend, isCollegeDay });
      if (!cancelled) setPlan(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [wakeMin, iso, isWeekend]);

  if (!plan || dismissed) return null;

  const border =
    plan.severity === 'danger'
      ? '3px solid #ef4444'
      : plan.severity === 'warn'
        ? '3px solid #f59e0b'
        : '3px solid var(--color-accent)';

  const applyBunk = async () => {
    setBusy(true);
    try {
      await setDayStatus(iso, 'bunk');
      setApplied('Marked bunked for today — college phase skipped');
      window.dispatchEvent(new Event('day-status-changed'));
    } finally {
      setBusy(false);
    }
  };

  const applyLeftEarly = async () => {
    setBusy(true);
    try {
      const rows = await collegeDayStatusesRepo.list();
      const existing = rows.find((r) => r.date === iso && !r.deleted);
      const patch = {
        status: 'left_early' as const,
        notes: `Late wake — join after Period 1 (leave ~${plan.leaveByHm ?? '?'})`,
        leftEarlyTime: plan.leaveByHm ?? undefined,
      };
      if (existing) {
        await collegeDayStatusesRepo.update(existing.id, patch);
      } else {
        await collegeDayStatusesRepo.create({
          date: iso,
          ...patch,
        });
      }
      setApplied('Logged as late / after P1 arrival');
      window.dispatchEvent(new Event('day-status-changed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: 12, borderLeft: border }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>{plan.title}</strong>
        <Button variant="ghost" onClick={() => setDismissed(true)} style={{ flexShrink: 0 }}>
          Dismiss
        </Button>
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.45,
        }}
      >
        {plan.body}
      </p>

      {(plan.leaveByHm || plan.arriveByHm) && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 'var(--text-sm)',
          }}
        >
          {plan.leaveByHm && (
            <span>
              <strong>Leave by</strong> {formatHm12(plan.leaveByHm)}
            </span>
          )}
          {plan.arriveByHm && (
            <span>
              <strong>Arrive ~</strong> {formatHm12(plan.arriveByHm)}
            </span>
          )}
          <span>
            <strong>Up since</strong> {formatHm12(minToHm(plan.wakeMin))}
          </span>
        </div>
      )}

      <ul
        style={{
          margin: '10px 0 0',
          paddingLeft: 18,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {plan.routineAdvice.map((line) => (
          <li key={line} style={{ marginBottom: 4 }}>
            {line}
          </li>
        ))}
      </ul>

      {applied ? (
        <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-accent)' }}>
          {applied}
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {plan.tier === 'cooked' && (
            <Button variant="primary" disabled={busy} onClick={() => void applyBunk()}>
              Mark bunked / stay home
            </Button>
          )}
          {plan.tier === 'late_ok' && (
            <Button variant="secondary" disabled={busy} onClick={() => void applyLeftEarly()}>
              Log late (after P1)
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
