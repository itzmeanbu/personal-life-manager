/**
 * Renders ONLY the current sequential phase + Done / Skip → next.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getCurrentSeqPhase,
  completeCurrentPhase,
  skipCurrentPhase,
  notifyPhaseIfNeeded,
  phaseKey,
  WEEKEND_SPIN_END_MIN,
  type SeqPhase,
} from './phaseSequence';
import { DayAsksCard } from './DayAsksCard';
import { BusMusicPhase } from './BusMusicPhase';
import { NightPhasePanel } from './NightPhasePanel';
import { SpendPromptsCard } from './SpendPromptsCard';
import { DaySpendSummary } from './DaySpendSummary';
import { TomorrowOrderCard } from './TomorrowOrderCard';
import { getDayOrderForDate } from '../college/dayOrder';
import { liveClassLine, TIME_SLOTS } from '../college/timetable';
import { formatHm12 } from '../lib/timeFormat';
import { minToHm } from './timeline';
import { subscribeDemoDay } from '../demo/DemoTools';

export function SequentialPhaseView({
  date = new Date(),
  wakeMin,
  nowMin,
}: {
  date?: Date;
  wakeMin: number | null;
  nowMin: number;
}) {
  const iso = toIsoDate(date);
  const [phase, setPhase] = useState<SeqPhase | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dayOrder, setDayOrder] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const { phase: p, list, index: i } = await getCurrentSeqPhase(date, wakeMin, nowMin);
    setPhase(p);
    setIndex(i);
    setTotal(list.length);
    setDayOrder(await getDayOrderForDate(iso));
    void notifyPhaseIfNeeded(p, iso);
  }, [date, wakeMin, nowMin, iso]);

  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener('phase-seq-changed', on);
    const unsub = subscribeDemoDay(on);
    return () => {
      window.removeEventListener('phase-seq-changed', on);
      unsub();
    };
  }, [reload]);

  const done = async () => {
    if (!phase) return;
    setBusy(true);
    try {
      await completeCurrentPhase(date, phaseKey(phase));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!phase) return;
    setBusy(true);
    try {
      await skipCurrentPhase(date, phaseKey(phase));
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (!phase) {
    return (
      <Card>
        <p style={{ margin: 0 }}>Loading phase…</p>
      </Card>
    );
  }

  const subjectLine =
    phase.id === 'PERIOD' && phase.periodSlotId && dayOrder
      ? (() => {
          const slot = TIME_SLOTS.find((s) => s.id === phase.periodSlotId);
          if (!slot) return phase.label;
          if (slot.kind !== 'class') return slot.label;
          return liveClassLine(dayOrder, new Date());
        })()
      : null;

  return (
    <div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-secondary)',
          marginBottom: 8,
        }}
      >
        Phase {index + 1} of {total}
        {dayOrder != null ? ` · Day order ${dayOrder}` : ''}
        {wakeMin != null ? ` · up since ${formatHm12(minToHm(wakeMin))}` : ''}
      </div>

      <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{phase.icon}</div>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-xl)' }}>{phase.label}</h2>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {phase.hint}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>{phase.message}</p>
        {subjectLine && phase.id === 'PERIOD' && (
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>{subjectLine}</p>
        )}
      </Card>

      {/* Phase-specific body — only what belongs here */}
      {phase.id === 'MORNING_ROUTINE' && <DayAsksCard date={date} forceSlot="morning" />}

      {(phase.id === 'MORNING_BUS' || phase.id === 'EVENING_BUS') && (
        <BusMusicPhase
          direction={phase.id === 'MORNING_BUS' ? 'morning' : 'evening'}
          onArrived={() => void done()}
        />
      )}

      {phase.id === 'WEEKEND_SPIN' && (
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎡</div>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Spin open until 10:00 PM</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
            {nowMin >= WEEKEND_SPIN_END_MIN
              ? 'Past 10 PM — wrap free time and move on.'
              : 'No college bus or day order. Spin when you want.'}
          </p>
          <Link to="/spin">
            <Button variant="primary">Open Spin Wheel</Button>
          </Link>
        </Card>
      )}

      {phase.id === 'WORKOUT' && (
        <Card style={{ marginBottom: 12, textAlign: 'center' }}>
          <Link to="/workout">
            <Button variant="secondary">Open Workout</Button>
          </Link>
        </Card>
      )}

      {phase.id === 'GUITAR' && (
        <Card style={{ marginBottom: 12, textAlign: 'center' }}>
          <Link to="/guitar">
            <Button variant="secondary">Open Guitar</Button>
          </Link>
        </Card>
      )}

      {phase.id === 'WHATS_TOMORROW' && <TomorrowOrderCard date={date} />}

      {phase.id === 'NIGHT' && <NightPhasePanel date={date} />}

      {phase.id === 'SLEEP' && (
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: '16px' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Day complete. Phases reset after midnight.
          </p>
        </Card>
      )}

      {(phase.spend || phase.id === 'PERIOD' || phase.id === 'CANTEEN' || phase.id === 'HOME') && (
        <SpendPromptsCard date={date} />
      )}

      {phase.id === 'SLEEP' && <DaySpendSummary date={date} />}

      {/* Advance — bus phases advance via onArrived */}
      {phase.id !== 'MORNING_BUS' && phase.id !== 'EVENING_BUS' && phase.id !== 'SLEEP' && (
        <Card style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" disabled={busy} onClick={() => void done()}>
              Done → next
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void skip()}>
              Skip
            </Button>
          </div>
        </Card>
      )}

      {phase.id === 'SLEEP' && (
        <Card style={{ textAlign: 'center', padding: '12px' }}>
          <Button variant="ghost" disabled={busy} onClick={() => void done()}>
            Mark sleep done
          </Button>
        </Card>
      )}
    </div>
  );
}
