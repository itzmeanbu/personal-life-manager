/**
 * DEMO TOOLS — bypass real clock & jump phases to test the whole day.
 * Remove this file + AppShell import before release.
 */
import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  completeCurrentPhase,
  getCurrentSeqPhase,
  phaseKey,
  setPhaseSeqState,
  skipCurrentPhase,
} from '../day/phaseSequence';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: '5:00 AM', hour: 5, minute: 0 },
  { label: '5:30 AM', hour: 5, minute: 30 },
  { label: '6:15 AM', hour: 6, minute: 15 },
  { label: '6:50 AM', hour: 6, minute: 50 },
  { label: '9:10 AM', hour: 9, minute: 10 },
  { label: '10:00 AM', hour: 10, minute: 0 },
  { label: '12:30 PM', hour: 12, minute: 30 },
  { label: '1:40 PM', hour: 13, minute: 40 },
  { label: '4:00 PM', hour: 16, minute: 0 },
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '9:00 PM', hour: 21, minute: 0 },
  { label: '10:00 PM', hour: 22, minute: 0 },
];

let demoDayOverride: Date | null = null;
let demoTimeOverride: { hour: number; minute: number } | null = null;
const listeners = new Set<() => void>();

export function getDemoDate(): Date {
  const base = demoDayOverride ? new Date(demoDayOverride) : new Date();
  if (demoTimeOverride) {
    base.setHours(demoTimeOverride.hour, demoTimeOverride.minute, 0, 0);
  }
  return base;
}

export function isDemoTimeActive(): boolean {
  return demoTimeOverride != null || demoDayOverride != null;
}

export function setDemoDayOfWeek(dayIndex: number | null) {
  if (dayIndex === null) {
    demoDayOverride = null;
  } else {
    const d = new Date();
    const diff = dayIndex - d.getDay();
    d.setDate(d.getDate() + diff);
    demoDayOverride = d;
  }
  listeners.forEach((l) => l());
}

export function setDemoTimeOfDay(hour: number | null, minute = 0) {
  demoTimeOverride = hour === null ? null : { hour, minute };
  listeners.forEach((l) => l());
}

export function subscribeDemoDay(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let forceCompleteTimer: (() => void) | null = null;
export function registerForceCompleteTimer(fn: (() => void) | null) {
  forceCompleteTimer = fn;
}
export function requestForceCompleteTimer() {
  forceCompleteTimer?.();
}

export function DemoToolsPanel() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [manualHour, setManualHour] = useState('');
  const [manualMinute, setManualMinute] = useState('');
  const [manualPeriod, setManualPeriod] = useState<'AM' | 'PM'>('AM');
  const [manualError, setManualError] = useState('');
  const [clockLabel, setClockLabel] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');

  const refreshMeta = async () => {
    const d = getDemoDate();
    setClockLabel(
      d.toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + (isDemoTimeActive() ? '  · override' : '  · real')
    );
    try {
      const nowMin = d.getHours() * 60 + d.getMinutes();
      const { phase, index, list } = await getCurrentSeqPhase(d, null, nowMin);
      setPhaseLabel(`${index + 1}/${list.length}: ${phase.label}`);
    } catch {
      setPhaseLabel('');
    }
  };

  useEffect(() => {
    void refreshMeta();
    return subscribeDemoDay(() => void refreshMeta());
  }, []);

  function applyManualTime() {
    const h = parseInt(manualHour, 10);
    const m = manualMinute.trim() === '' ? 0 : parseInt(manualMinute, 10);
    if (!Number.isFinite(h) || h < 1 || h > 12 || !Number.isFinite(m) || m < 0 || m > 59) {
      setManualError('Hour 1–12, minute 0–59');
      return;
    }
    setManualError('');
    let hour24 = h % 12;
    if (manualPeriod === 'PM') hour24 += 12;
    setSelectedTime(null);
    setDemoTimeOfDay(hour24, m);
  }

  async function completePhase() {
    const d = getDemoDate();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const { phase } = await getCurrentSeqPhase(d, null, nowMin);
    await completeCurrentPhase(d, phaseKey(phase));
    listeners.forEach((l) => l());
    void refreshMeta();
  }

  async function skipPhase() {
    const d = getDemoDate();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const { phase } = await getCurrentSeqPhase(d, null, nowMin);
    await skipCurrentPhase(d, phaseKey(phase));
    listeners.forEach((l) => l());
    void refreshMeta();
  }

  async function resetDayPhases() {
    const d = getDemoDate();
    const iso = toIsoDate(d);
    await setPhaseSeqState({
      date: iso,
      completed: [],
      skipped: [],
      forceKey: null,
      updatedAt: new Date().toISOString(),
    });
    listeners.forEach((l) => l());
    void refreshMeta();
  }

  async function completeAllToEnd() {
    const d = getDemoDate();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    for (let i = 0; i < 40; i++) {
      const { phase, index, list } = await getCurrentSeqPhase(d, null, nowMin);
      if (index >= list.length - 1 && phase.id === 'SLEEP') {
        await completeCurrentPhase(d, phaseKey(phase));
        break;
      }
      await completeCurrentPhase(d, phaseKey(phase));
    }
    listeners.forEach((l) => l());
    void refreshMeta();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 72,
          right: 12,
          zIndex: 9999,
          fontSize: 10,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px dashed var(--color-danger, #e5484d)',
          background: 'var(--color-surface)',
          color: 'var(--color-danger, #e5484d)',
          opacity: 0.85,
        }}
      >
        Clock{isDemoTimeActive() ? ' ●' : ''}
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 72,
        right: 12,
        left: 12,
        zIndex: 9999,
        maxWidth: 380,
        marginLeft: 'auto',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <Card style={{ border: '2px dashed var(--color-danger, #e5484d)' }}>
        <strong style={{ color: 'var(--color-danger, #e5484d)' }}>Clock override (dev)</strong>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 6px' }}>
          App clock: <strong>{clockLabel}</strong>
          {phaseLabel ? (
            <>
              <br />
              Phase: {phaseLabel}
            </>
          ) : null}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>
          Real watch is ignored while DEMO day/time is set. Reset to live when done testing.
        </p>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Day:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {DAY_NAMES.map((name, idx) => (
              <Button
                key={idx}
                variant={selected === idx ? 'primary' : 'secondary'}
                onClick={() => {
                  setSelected(idx);
                  setDemoDayOfWeek(idx);
                }}
              >
                {name.slice(0, 3)}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(null);
                setDemoDayOfWeek(null);
              }}
            >
              Real day
            </Button>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Time (bypasses real clock):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {TIME_PRESETS.map((preset, idx) => (
              <Button
                key={idx}
                variant={selectedTime === idx ? 'primary' : 'secondary'}
                onClick={() => {
                  setSelectedTime(idx);
                  setDemoTimeOfDay(preset.hour, preset.minute);
                }}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedTime(null);
                setDemoTimeOfDay(null);
              }}
            >
              Real time
            </Button>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Custom time:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              placeholder="HH"
              value={manualHour}
              onChange={(e) => setManualHour(e.target.value)}
              style={{
                width: 44,
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid var(--color-border, #ccc)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
            <span>:</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              placeholder="MM"
              value={manualMinute}
              onChange={(e) => setManualMinute(e.target.value)}
              style={{
                width: 44,
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid var(--color-border, #ccc)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
            <Button variant={manualPeriod === 'AM' ? 'primary' : 'secondary'} onClick={() => setManualPeriod('AM')}>
              AM
            </Button>
            <Button variant={manualPeriod === 'PM' ? 'primary' : 'secondary'} onClick={() => setManualPeriod('PM')}>
              PM
            </Button>
            <Button variant="secondary" onClick={applyManualTime}>
              Set
            </Button>
          </div>
          {manualError && (
            <div style={{ fontSize: 11, color: 'var(--color-danger, #e5484d)', marginTop: 4 }}>{manualError}</div>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Phase (no waiting):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Button variant="primary" onClick={() => void completePhase()}>
              Complete phase →
            </Button>
            <Button variant="secondary" onClick={() => void skipPhase()}>
              Skip phase
            </Button>
            <Button variant="secondary" onClick={() => void resetDayPhases()}>
              Reset day phases
            </Button>
            <Button variant="ghost" onClick={() => void completeAllToEnd()}>
              Fast-forward all
            </Button>
            <Button variant="ghost" onClick={() => requestForceCompleteTimer()}>
              Complete spin timer
            </Button>
          </div>
        </div>

        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Card>
    </div>
  );
}
