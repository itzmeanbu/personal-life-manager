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
                setDemoDayOfWeek(null);
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
            Skip / finish running timer
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </Card>
    </div>
  );
}
