import type { ExerciseModality, WorkoutTemplateItem, WorkoutExerciseLog } from '../data/types';

/** Human-readable prescription line — never forces a timer framing. */
export function formatPrescription(item: {
  modality: ExerciseModality;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  totalReps?: number;
  chunkReps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  customInstructions?: string;
}): string {
  if (item.customInstructions?.trim()) {
    // Still append structured summary when useful
  }

  let core = '';
  switch (item.modality) {
    case 'sets_reps': {
      const sets = item.sets ?? 3;
      const lo = item.repsMin ?? item.repsMax ?? 8;
      const hi = item.repsMax ?? lo;
      core = hi === lo ? `${sets} × ${lo}` : `${sets} × ${lo}–${hi}`;
      break;
    }
    case 'total_reps': {
      const total = item.totalReps ?? 50;
      const chunk = item.chunkReps;
      core = chunk
        ? `${total} total reps · ~${chunk} at a time`
        : `${total} total repetitions`;
      break;
    }
    case 'duration': {
      const sets = item.sets ?? 1;
      const sec = item.durationSeconds ?? 45;
      const hold = sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} sec`;
      core = sets > 1 ? `${sets} × ${hold} hold` : `Hold ${hold}`;
      break;
    }
    case 'custom':
      core = item.customInstructions?.trim() || 'Follow instructions';
      break;
  }

  if (item.modality !== 'custom' && item.customInstructions?.trim()) {
    return `${core} — ${item.customInstructions.trim()}`;
  }
  if (item.restSeconds && item.modality !== 'custom') {
    return `${core} · rest ${item.restSeconds}s`;
  }
  return core;
}

export function formatSessionStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'skipped':
      return 'Skipped';
    case 'cancelled':
      return 'Cancelled';
    case 'in_progress':
      return 'In progress';
    default:
      return status;
  }
}

export function dayLabel(dayIndex: number | null): string {
  if (dayIndex === null || dayIndex === undefined) return 'Any day';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex] ?? '?';
}

export function emptyLogFromItem(item: WorkoutTemplateItem): WorkoutExerciseLog {
  return {
    itemId: item.id,
    exerciseId: item.exerciseId,
    name: item.name,
    modality: item.modality,
    setsDone: [],
    status: 'pending',
  };
}
