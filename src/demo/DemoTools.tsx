import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dayAssignmentsRepo, dayProfilesRepo } from '../data/repository';
import { setDayOrderForDate } from '../college/dayOrder';
import { toIsoDate } from '../routine/engine';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLOCK_KEY = 'life-manager.demo.clock.v2';

const TIME_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: '5:00 AM', hour: 5, minute: 0 },
  { label: '5:30 AM', hour: 5, minute: 30 },
  { label: '6:15 AM', hour: 6, minute: 15 },
  { label: '6:50 AM', hour: 6, minute: 50 },
  { label: '8:50 AM', hour: 8, minute: 50 },
  { label: '9:10 AM', hour: 9, minute: 10 },
  { label: '10:50 AM', hour: 10, minute: 50 },
  { label: '12:40 PM', hour: 12, minute: 40 },
  { label: '4:00 PM', hour: 16, minute: 0 },
  { label: '7:30 PM', hour: 19, minute: 30 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '10:00 PM', hour: 22, minute: 0 },
];

const DAY_TYPE_LABELS: Record<string, string> = {
  normal: 'Academic Day',
  bunk: 'Partial Attendance Day',
  event: 'Campus Function Day',
  rest: 'Rest & Recharge Day',
  coding: 'Coding Focus Day',
  coimbatore_stay: 'Coimbatore Stay',
};

function readStoredClock(): { date: string; time: string } | null {
  try {
    const raw = localStorage.getItem(CLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; time?: string };
    if (parsed.date && parsed.time) return { date: parsed.date, time: parsed.time };
  } catch { /* ignore malformed local state */ }
  return null;
}

function writeStoredClock(date: string, time: string) {
  try { localStorage.setItem(CLOCK_KEY, JSON.stringify({ date, time })); } catch { /* ignore */ }
}

function currentParts(): { date: string; time: string } {
  const stored = readStoredClock();
  if (stored) return stored;
  const d = new Date();
  return { date: toIsoDate(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

let listeners = new Set<() => void>();

/** The app clock used by all testing controls. It is persistent across refreshes. */
export function getDemoDate(): Date {
  const parts = currentParts();
  const [y, m, d] = parts.date.split('-').map(Number);
  const [hour, minute] = parts.time.split(':').map(Number);
  const result = new Date(y, m - 1, d);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function notify() { listeners.forEach((listener) => listener()); }

export function setDemoDayOfWeek(dayIndex: number | null) {
  const current = getDemoDate();
  if (dayIndex === null) {
    const real = new Date();
    writeStoredClock(toIsoDate(real), `${String(real.getHours()).padStart(2, '0')}:${String(real.getMinutes()).padStart(2, '0')}`);
  } else {
    const diff = dayIndex - current.getDay();
    current.setDate(current.getDate() + diff);
    writeStoredClock(toIsoDate(current), `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`);
  }
  notify();
}

export function setDemoTimeOfDay(hour: number | null, minute = 0) {
  if (hour === null) {
    const real = new Date();
    writeStoredClock(toIsoDate(getDemoDate()), `${String(real.getHours()).padStart(2, '0')}:${String(real.getMinutes()).padStart(2, '0')}`);
  } else {
    const current = getDemoDate();
    current.setHours(hour, minute, 0, 0);
    writeStoredClock(toIsoDate(current), `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  notify();
}

export function setDemoDateTime(dateValue: string, timeValue: string) {
  const [y, m, d] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hour) || Number.isNaN(minute)) return;
  writeStoredClock(`${dateValue}`, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  notify();
}

export async function setDemoDayOrder(iso: string, order: number) {
  await setDayOrderForDate(iso, order);
  notify();
}

export function advanceDemoMinutes(minutes: number) {
  const next = getDemoDate();
  next.setMinutes(next.getMinutes() + minutes);
  writeStoredClock(toIsoDate(next), `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`);
  notify();
}

export function subscribeDemoDay(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let forceCompleteTimer: (() => void) | null = null;
export function registerForceCompleteTimer(fn: (() => void) | null) { forceCompleteTimer = fn; }
export function requestForceCompleteTimer() { forceCompleteTimer?.(); }

export function DemoToolsPanel() {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => currentParts(), []);
  const [fakeDate, setFakeDate] = useState(initial.date);
  const [fakeTime, setFakeTime] = useState(initial.time);
  const [tick, setTick] = useState(0);
  const profiles = useLiveQuery(() => dayProfilesRepo.list(), [], []);

  useEffect(() => subscribeDemoDay(() => {
    const p = currentParts();
    setFakeDate(p.date);
    setFakeTime(p.time);
    setTick((v) => v + 1);
  }), []);

  const currentDate = getDemoDate();
  const iso = toIsoDate(currentDate);
  const activeProfiles = (profiles ?? []).filter((p) => !p.deleted && p.enabled && p.systemKey && DAY_TYPE_LABELS[p.systemKey]);
  void tick;

  const assignDayType = async (systemKey: string) => {
    const profile = activeProfiles.find((p) => p.systemKey === systemKey);
    if (!profile) return;
    const assignments = await dayAssignmentsRepo.list();
    const existing = assignments.find((a) => a.date === iso && !a.deleted);
    if (existing) {
      await dayAssignmentsRepo.update(existing.id, { profileId: profile.id, checklistDone: [] });
    } else {
      await dayAssignmentsRepo.create({ date: iso, profileId: profile.id, checklistDone: [] });
    }
    notify();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 72, right: 12, zIndex: 9999,
        fontSize: 10, padding: '5px 9px', borderRadius: 8,
        border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)',
      }}>Demo</button>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 72, right: 12, left: 12, zIndex: 9999, maxWidth: 420, marginLeft: 'auto' }}>
      <Card style={{ border: '1px solid var(--color-border-strong)', boxShadow: '0 18px 50px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong>Demo</strong>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </div>

        <div style={{ fontSize: 12, marginBottom: 6 }}>Date & time</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="date" value={fakeDate} onChange={(e) => setFakeDate(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }} />
          <input type="time" value={fakeTime} onChange={(e) => setFakeTime(e.target.value)} style={{ width: 112, padding: '8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          <Button variant="primary" onClick={() => setDemoDateTime(fakeDate, fakeTime)}>Set clock</Button>
          <Button variant="secondary" onClick={() => advanceDemoMinutes(5)}>+5m</Button>
          <Button variant="secondary" onClick={() => advanceDemoMinutes(30)}>+30m</Button>
          <Button variant="secondary" onClick={() => advanceDemoMinutes(60)}>+1h</Button>
          <Button variant="secondary" onClick={() => advanceDemoMinutes(240)}>+4h</Button>
        </div>

        <div style={{ fontSize: 12, margin: '12px 0 6px' }}>Quick times</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {TIME_PRESETS.map((preset) => (
            <Button key={preset.label} variant="secondary" onClick={() => setDemoTimeOfDay(preset.hour, preset.minute)}>{preset.label}</Button>
          ))}
        </div>

        <div style={{ fontSize: 12, margin: '12px 0 6px' }}>Day</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {DAY_NAMES.map((name, idx) => <Button key={name} variant="secondary" onClick={() => setDemoDayOfWeek(idx)}>{name.slice(0, 3)}</Button>)}
          <Button variant="ghost" onClick={() => setDemoDayOfWeek(null)}>Real date & time</Button>
        </div>

        <div style={{ fontSize: 12, margin: '12px 0 6px' }}>College day order</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[1, 2, 3, 4, 5, 6].map((order) => <Button key={order} variant="secondary" onClick={() => void setDemoDayOrder(iso, order)}>Order {order}</Button>)}
        </div>

        <div style={{ fontSize: 12, margin: '12px 0 6px' }}>Day type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {activeProfiles.map((profile) => <Button key={profile.id} variant="secondary" onClick={() => void assignDayType(profile.systemKey!)}>{DAY_TYPE_LABELS[profile.systemKey!]}</Button>)}
        </div>

        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={() => requestForceCompleteTimer()}>Finish active timer</Button>
        </div>
      </Card>
    </div>
  );
}
