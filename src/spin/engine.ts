/**
 * Pure spin helpers — time filters, weighted pick, no hard-coded categories.
 */

import type { SpinWheel, SpinWheelOption } from '../data/types';

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function nowLocalMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Whether an option is eligible right now given time windows. */
export function isOptionAvailable(opt: SpinWheelOption, nowMins = nowLocalMinutes()): boolean {
  if (!opt.enabled) return false;
  if (opt.availableAfterHm) {
    if (nowMins < hmToMinutes(opt.availableAfterHm)) return false;
  }
  if (opt.availableBeforeHm) {
    if (nowMins > hmToMinutes(opt.availableBeforeHm)) return false;
  }
  return true;
}

export function eligibleOptions(wheel: SpinWheel, nowMins = nowLocalMinutes()): SpinWheelOption[] {
  return (wheel.options ?? [])
    .filter((o) => isOptionAvailable(o, nowMins))
    .sort((a, b) => a.order - b.order);
}

/** Weighted random pick; weight defaults to 1. */
export function pickOption(options: SpinWheelOption[]): SpinWheelOption | null {
  if (options.length === 0) return null;
  const weights = options.map((o) => Math.max(0.01, o.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

export function formatAvailability(opt: SpinWheelOption): string {
  const parts: string[] = [];
  if (opt.availableAfterHm) parts.push(`after ${opt.availableAfterHm}`);
  if (opt.availableBeforeHm) parts.push(`before ${opt.availableBeforeHm}`);
  if (opt.durationMinutes) parts.push(`${opt.durationMinutes} min`);
  return parts.join(' · ');
}
