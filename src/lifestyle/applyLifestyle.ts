import { routinesRepo } from '../data/repository';
import type { LifestyleConfig } from './config';
import { workoutDays } from './config';

function match(title: string, ...needles: string[]) {
  const t = title.trim().toLowerCase();
  return needles.some((n) => t === n || t.includes(n));
}

export async function applyLifestyleToRoutines(cfg: LifestyleConfig): Promise<void> {
  const list = await routinesRepo.list();
  const wDays = workoutDays(cfg.workoutRestDay);

  for (const r of list) {
    if (r.deleted) continue;
    const t = r.title;

    if (match(t, 'wake up', 'wake')) {
      await routinesRepo.update(r.id, {
        time: cfg.wakeHm,
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      });
      continue;
    }
    if (match(t, 'bath', 'shower')) {
      await routinesRepo.update(r.id, {
        time: cfg.bathHm,
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        durationMinutes: 25,
      });
      continue;
    }
    if (match(t, 'face', 'hair serum', 'serum', 'sunscreen', 'moisturizer')) {
      await routinesRepo.update(r.id, {
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      });
      continue;
    }
    if (match(t, 'guitar')) {
      await routinesRepo.update(r.id, {
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        durationMinutes: cfg.guitarMinutes,
        time: '20:15',
      });
      continue;
    }
    if (match(t, 'workout', 'gym') || r.moduleTag === 'workout') {
      await routinesRepo.update(r.id, {
        cadence: 'custom',
        activeDays: wDays,
        durationMinutes: Math.max(r.durationMinutes ?? 45, 60),
      });
      continue;
    }
    if (match(t, 'charge phone', 'phone charge')) {
      await routinesRepo.update(r.id, {
        time: '22:00',
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      });
      continue;
    }
    if (match(t, 'plug', 'switch')) {
      await routinesRepo.update(r.id, {
        time: '22:05',
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      });
    }
  }
}
