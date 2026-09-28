/**
 * One current step. Completes itself when the work is done — no constant "Next" prompts.
 * Manual Next only when there is nothing automatic to wait for.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getCurrentSeqPhase,
  completeCurrentPhase,
  skipCurrentPhase,
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
import { resolveCell, TIME_SLOTS } from '../college/timetable';
import { subscribeDemoDay } from '../demo/DemoTools';

/** Steps that auto-finish only via their own UI (bus arrival, asks done). */
const AUTO_BODY = new Set(['MORNING_ROUTINE', 'MORNING_BUS', 'EVENING_BUS']);

/** Steps that auto-advance when the clock leaves their window (periods). */
const TIME_GATED = new Set(['PERIOD']);

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
  const [busy, setBusy] = useState(false);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const advancing = useRef(false);
  const lastAutoKey = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const { phase: p } = await getCurrentSeqPhase(date, wakeMin, nowMin);
    setPhase(p);
    setDayOrder(await getDayOrderForDate(iso));
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

  const advance = useCallback(
    async (mode: 'done' | 'skip' = 'done') => {
      if (!phase || advancing.current) return;
      advancing.current = true;
      setBusy(true);
      try {
        const key = phaseKey(phase);
        if (mode === 'skip') await skipCurrentPhase(date, key);
        else await completeCurrentPhase(date, key);
        lastAutoKey.current = null;
        await reload();
      } finally {
        setBusy(false);
        advancing.current = false;
      }
    },
    [phase, date, reload]
  );

  // Periods: when clock is past this slot's end, auto-complete and move on
  useEffect(() => {
    if (!phase || phase.id !== 'PERIOD' || !phase.periodSlotId) return;
    const slot = TIME_SLOTS.find((s) => s.id === phase.periodSlotId);
    if (!slot) return;
    if (nowMin < slot.endMin) return;
    const key = phaseKey(phase);
    if (lastAutoKey.current === key) return;
    lastAutoKey.current = key;
    void advance('done');
  }, [phase, nowMin, advance]);

  // Soft info steps (good morning, arrival, leave home, departure, home, sleep): short dwell then auto
  useEffect(() => {
    if (!phase) return;
    const soft = new Set([
      'GOOD_MORNING',
      'COLLEGE_ARRIVAL',
      'COLLEGE_DEPARTURE',
      'HOME',
      'LEAVE_HOME',
    ]);
    if (!soft.has(phase.id)) return;
    const key = phaseKey(phase);
    if (lastAutoKey.current === key) return;
    const t = window.setTimeout(() => {
      lastAutoKey.current = key;
      void advance('done');
    }, 2500);
    return () => window.clearTimeout(t);
  }, [phase, advance]);

  if (!phase) return null;

  let title = phase.label;
  let subtitle = phase.hint;
  if (phase.id === 'PERIOD' && phase.periodSlotId && dayOrder != null) {
    const slot = TIME_SLOTS.find((s) => s.id === phase.periodSlotId);
    if (slot?.kind === 'class') {
      const { subject } = resolveCell(dayOrder, slot.id);
      title = subject?.name ?? phase.label;
      const timePart = phase.hint.includes('·') ? phase.hint.split('·')[1]?.trim() : phase.hint;
      subtitle = `Period ${slot.periodNo} · ${timePart}`;
    }
  }

  const needsManual =
    !AUTO_BODY.has(phase.id) &&
    !TIME_GATED.has(phase.id) &&
    phase.id !== 'GOOD_MORNING' &&
    phase.id !== 'COLLEGE_ARRIVAL' &&
    phase.id !== 'COLLEGE_DEPARTURE' &&
    phase.id !== 'HOME' &&
    phase.id !== 'LEAVE_HOME';

  return (
    <div>
      {dayOrder != null && (phase.id === 'PERIOD' || phase.id === 'COLLEGE_ARRIVAL') && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          Day order {dayOrder}
        </p>
      )}

      <Card style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-xl)', fontWeight: 600 }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {subtitle}
          </p>
        )}
        {phase.message && (
          <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>{phase.message}</p>
        )}
      </Card>

      {phase.id === 'MORNING_ROUTINE' && (
        <DayAsksCard
          date={date}
          forceSlot="morning"
          onAllDone={() => {
            const key = phaseKey(phase);
            if (lastAutoKey.current === key) return;
            lastAutoKey.current = key;
            void advance('done');
          }}
        />
      )}

      {(phase.id === 'MORNING_BUS' || phase.id === 'EVENING_BUS') && (
        <BusMusicPhase
          direction={phase.id === 'MORNING_BUS' ? 'morning' : 'evening'}
          onArrived={() => void advance('done')}
        />
      )}

      {phase.id === 'WEEKEND_SPIN' && (
        <Card style={{ marginBottom: 12, padding: '16px' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
            {nowMin >= WEEKEND_SPIN_END_MIN ? 'Free time closed (after 10 PM)' : 'Spin / free time'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/spin">
              <Button variant="primary">Open spin</Button>
            </Link>
            <Button variant="ghost" disabled={busy} onClick={() => void advance('skip')}>
              Skip
            </Button>
          </div>
        </Card>
      )}

      {phase.id === 'WORKOUT' && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/workout">
              <Button variant="secondary">Workout</Button>
            </Link>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void advance('done')}
            >
              Finished
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void advance('skip')}>
              Skip
            </Button>
          </div>
        </Card>
      )}

      {phase.id === 'GUITAR' && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/guitar">
              <Button variant="secondary">Guitar</Button>
            </Link>
            <Button variant="primary" disabled={busy} onClick={() => void advance('done')}>
              Finished
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void advance('skip')}>
              Skip
            </Button>
          </div>
        </Card>
      )}

      {phase.id === 'WHATS_TOMORROW' && (
        <>
          <TomorrowOrderCard date={date} />
          <div style={{ marginTop: 8 }}>
            <Button variant="primary" disabled={busy} onClick={() => void advance('done')}>
              Locked in — continue
            </Button>
          </div>
        </>
      )}

      {phase.id === 'NIGHT' && (
        <>
          <NightPhasePanel date={date} />
          <div style={{ marginTop: 8 }}>
            <Button variant="primary" disabled={busy} onClick={() => void advance('done')}>
              Night done
            </Button>
          </div>
        </>
      )}

      {phase.id === 'SLEEP' && (
        <>
          <DaySpendSummary date={date} />
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Day complete.
          </p>
        </>
      )}

      {(phase.spend || phase.id === 'PERIOD' || phase.id === 'HOME') && (
        <SpendPromptsCard date={date} />
      )}

      {/* Manual only when nothing else will auto-complete */}
      {needsManual &&
        phase.id !== 'WORKOUT' &&
        phase.id !== 'GUITAR' &&
        phase.id !== 'WHATS_TOMORROW' &&
        phase.id !== 'NIGHT' &&
        phase.id !== 'WEEKEND_SPIN' &&
        phase.id !== 'SLEEP' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button variant="ghost" disabled={busy} onClick={() => void advance('skip')}>
              Skip
            </Button>
          </div>
        )}
    </div>
  );
}
