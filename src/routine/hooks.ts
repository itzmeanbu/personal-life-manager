import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db } from '../data/db';
import { completionRecordsRepo, routinesRepo } from '../data/repository';
import type { CompletionRecord, Routine } from '../data/types';
import {
  buildAgenda,
  dueReminders,
  nextOrderValue,
  sortRoutines,
  toIsoDate,
} from './engine';
import { useActiveDayProfile } from '../day/hooks';
import { applyProfileToRoutines, extraItemsAsRoutines } from '../day/effects';

/** All non-deleted routines, live — updates automatically on any create/edit/delete. */
export function useAllRoutines(): Routine[] {
  const routines = useLiveQuery(
    () => db.routines.filter((r) => !r.deleted).toArray(),
    [],
    []
  );
  return sortRoutines(routines ?? []);
}

function useCompletionRecordsForDate(isoDate: string): CompletionRecord[] {
  return (
    useLiveQuery(
      () =>
        db.completionRecords
          .where('date')
          .equals(isoDate)
          .filter((c) => !c.deleted)
          .toArray(),
      [isoDate],
      []
    ) ?? []
  );
}

/**
 * Today's (or any given date's) agenda, reactively derived from the live
 * routines + completion records + active Day Profile effects.
 */
export function useDailyAgenda(date: Date = new Date()) {
  const isoDate = toIsoDate(date);
  const routines = useAllRoutines();
  const completions = useCompletionRecordsForDate(isoDate);
  const { profile } = useActiveDayProfile(date);

  const effectiveRoutines = useMemo(() => {
    if (!profile) return routines;
    const filtered = applyProfileToRoutines(routines, profile.effects);
    const extras = extraItemsAsRoutines(profile.effects, isoDate);
    return sortRoutines([...filtered, ...extras]);
  }, [routines, profile, isoDate]);

  const agenda = buildAgenda(effectiveRoutines, completions, date);
  const reminders = dueReminders(agenda);

  const setStatus = useCallback(
    async (routineId: string, status: CompletionRecord['status'], note?: string) => {
      // Ephemeral day-extra items are not persisted as routines; skip completion for them
      if (routineId.startsWith('day-extra-')) return;
      const existing = completions.find(
        (c) => c.refType === 'routine' && c.refId === routineId
      );
      if (existing) {
        await completionRecordsRepo.update(existing.id, { status, note });
      } else {
        await completionRecordsRepo.create({
          date: isoDate,
          refType: 'routine',
          refId: routineId,
          status,
          note,
        });
      }
    },
    [completions, isoDate]
  );

  const clearStatus = useCallback(
    async (routineId: string) => {
      if (routineId.startsWith('day-extra-')) return;
      const existing = completions.find(
        (c) => c.refType === 'routine' && c.refId === routineId
      );
      if (existing) await completionRecordsRepo.remove(existing.id, true);
    },
    [completions]
  );

  return { agenda, reminders, setStatus, clearStatus, isoDate, profile };
}

/**
 * CRUD + reorder helpers for the Routine Manager screen.
 */
export function useRoutineManager() {
  const routines = useAllRoutines();

  const addRoutine = useCallback(
    async (data: Omit<Routine, keyof import('../data/types').BaseEntity | 'order'>) => {
      return routinesRepo.create({ ...data, order: nextOrderValue(routines) });
    },
    [routines]
  );

  const updateRoutine = useCallback(
    (id: string, patch: Partial<Omit<Routine, keyof import('../data/types').BaseEntity>>) =>
      routinesRepo.update(id, patch),
    []
  );

  const deleteRoutine = useCallback((id: string) => routinesRepo.remove(id), []);

  const setEnabled = useCallback(
    (id: string, enabled: boolean) => routinesRepo.update(id, { enabled }),
    []
  );

  const move = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const sorted = sortRoutines(routines);
      const index = sorted.findIndex((r) => r.id === id);
      if (index === -1) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;
      const current = sorted[index];
      const target = sorted[targetIndex];
      await routinesRepo.update(current.id, { order: target.order });
      await routinesRepo.update(target.id, { order: current.order });
    },
    [routines]
  );

  return { routines, addRoutine, updateRoutine, deleteRoutine, setEnabled, move };
}
