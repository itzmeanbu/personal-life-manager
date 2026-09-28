/**
 * Single app clock. All UI/logic "now" should use this — never raw `new Date()`
 * for phase windows, so DEMO time/day overrides actually work.
 */
import { getDemoDate, subscribeDemoDay } from './DemoTools';

/** Current app instant (respects DEMO day + time). */
export function appNow(): Date {
  return getDemoDate();
}

export function appNowMin(): number {
  const d = appNow();
  return d.getHours() * 60 + d.getMinutes();
}

export function appIsoDate(): string {
  const d = appNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export { subscribeDemoDay };
