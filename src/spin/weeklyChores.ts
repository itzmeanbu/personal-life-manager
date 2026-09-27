/**
 * Ensure Sunday weekly maintenance options exist on the root wheel.
 * Not random filler — only eligible on Sunday (availableDays: [0]).
 */
import { spinWheelsRepo, generateId } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import type { SpinWheelOption } from '../data/types';

const FLAG = 'spinWeeklyChores_v1';

const LABELS = [
  'Clean laptop (wipe + dust)',
  'Clean room',
  'Clean unnecessary files & photos',
];

export async function ensureWeeklyChoresOnSpin(): Promise<void> {
  if (await isFeatureEnabled(FLAG, false)) return;
  const wheels = await spinWheelsRepo.list();
  const root = wheels.find((w) => w.isRoot && !w.deleted) ?? wheels.find((w) => !w.deleted);
  if (!root) return;

  const existing = new Set(root.options.map((o) => o.label.toLowerCase()));
  const extras: SpinWheelOption[] = [];
  let order = root.options.length;
  for (const label of LABELS) {
    if (existing.has(label.toLowerCase())) continue;
    extras.push({
      id: generateId(),
      label,
      enabled: true,
      order: order++,
      weight: 2,
      durationMinutes: 30,
      availableDays: [0], // Sunday only
      notes: 'Weekly — shows on Sunday spins',
    });
  }
  if (extras.length) {
    await spinWheelsRepo.update(root.id, {
      options: [...root.options, ...extras],
    });
  }
  await setFeatureEnabled(FLAG, true);
}
