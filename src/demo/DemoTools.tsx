/**
 * DEMO TOOLS — remove this entire file (and its import) before release.
 * Isolated so deletion is a single-file remove.
 */
import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: '7:00 AM', hour: 7, minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '10:00 PM', hour: 22, minute: 0 },
];

/** Override the "today" date for Day Journey preview. null = real today. */
let demoDayOverride: Date | null = null;
/** Override the "current time" for Day Journey preview. null = real time. */
let demoTimeOverride: { hour: number; minute: number } | null = null;
const listeners = new Set<() => void>();

export function getDemoDate(): Date {
  const base = demoDayOverride ? new Date(demoDayOverride) : new Date();
  if (demoTimeOverride) {
    base.setHours(demoTimeOverride.hour, demoTimeOverride.minute, 0, 0);
  }
  return base;
}

export function setDemoDayOfWeek(dayIndex: number | null) {
  if (dayIndex === null) {
    demoDayOverride = null;
  } else {
    const d = new Date();
    // Move to the nearest past/future occurrence of that weekday
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

export function setDemoDateTime(dateValue: string, timeValue: string) {
  const [y, m, d] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hour) || Number.isNaN(minute)) return;
  demoDayOverride = new Date(y, m - 1, d);
  demoTimeOverride = { hour, minute };
  listeners.forEach((l) => l());
}

export function advanceDemoMinutes(minutes: number) {
  const next = getDemoDate();
  next.setMinutes(next.getMinutes() + minutes);
  demoDayOverride = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  demoTimeOverride = { hour: next.getHours(), minute: next.getMinutes() };
  listeners.forEach((l) => l());
}

export function subscribeDemoDay(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Instantly complete any running timer (spin / k-drama). */
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
  const [fakeDate, setFakeDate] = useState(() => {
    const d = getDemoDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [fakeTime, setFakeTime] = useState(() => {
    const d = getDemoDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

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
          opacity: 0.7,
        }}
      >
        DEMO
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
        maxWidth: 360,
        marginLeft: 'auto',
      }}
    >
      <Card style={{ border: '2px dashed var(--color-danger, #e5484d)' }}>
        <strong style={{ color: 'var(--color-danger, #e5484d)' }}>
          DEMO — remove before release
        </strong>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 8px' }}>
          Preview a different day / skip timers. Isolated in src/demo/DemoTools.tsx.
        </p>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Fake date + exact time:</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={fakeDate}
              onChange={(e) => setFakeDate(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '7px 8px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
            />
            <input
              type="time"
              value={fakeTime}
              onChange={(e) => setFakeTime(e.target.value)}
              style={{ width: 110, padding: '7px 8px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            <Button variant="primary" onClick={() => setDemoDateTime(fakeDate, fakeTime)}>Set fake clock</Button>
            <Button variant="secondary" onClick={() => advanceDemoMinutes(30)}>+30m</Button>
            <Button variant="secondary" onClick={() => advanceDemoMinutes(60)}>+1h</Button>
            <Button variant="secondary" onClick={() => advanceDemoMinutes(240)}>+4h</Button>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Preview day of week:</div>
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
                setSelectedTime(null);
                setDemoDayOfWeek(null);
                setDemoTimeOfDay(null);
                const d = new Date();
                setFakeDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                setFakeTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
              }}
            >
              Real today
            </Button>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Preview time of day:</div>
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
          <Button variant="secondary" onClick={() => requestForceCompleteTimer()}>
            Complete timer → today history (full time)
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Card>
    </div>
  );
}
