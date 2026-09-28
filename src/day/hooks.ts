import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  dayProfilesRepo,
  dayAssignmentsRepo,
  collegeDayStatusesRepo,
  phasesRepo,
  dayProgressRepo,
  routinesRepo,
  completionRecordsRepo,
} from '../data/repository';
import type { DayAssignment, DayProfile, Phase, DayProgress, Routine, CompletionRecord } from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  evaluateAndAdvance,
  routinesForPhase,
  isDayComplete,
  phasePosition,
} from './phaseEngine';

/**
 * Resolve the active DayProfile for a given date.
 * Priority:
 * 1. Explicit DayAssignment for that date
 * 2. College bunk status → systemKey 'bunk'
 * 3. No automatic weekend assumption — Sunday can be any explicitly assigned day type.
 * 4. null (normal Academic Day when no special profile is assigned)
 */
export function useActiveDayProfile(date: Date = new Date()): {
  profile: DayProfile | null;
  assignment: DayAssignment | null;
  isoDate: string;
} {
  const isoDate = toIsoDate(date);

  const profiles = useLiveQuery(() => dayProfilesRepo.list(), [], []);
  const assignments = useLiveQuery(() => dayAssignmentsRepo.list(), [], []);
  const collegeDays = useLiveQuery(() => collegeDayStatusesRepo.list(), [], []);

  return useMemo(() => {
    const list = (profiles ?? []).filter((p) => !p.deleted && p.enabled);
    const assign = (assignments ?? []).find((a) => a.date === isoDate && !a.deleted) ?? null;

    if (assign) {
      const profile = list.find((p) => p.id === assign.profileId) ?? null;
      return { profile, assignment: assign, isoDate };
    }

    const college = (collegeDays ?? []).find((d) => d.date === isoDate && !d.deleted);
    if (college?.status === 'bunked') {
      const bunk = list.find((p) => p.systemKey === 'bunk') ?? null;
      return { profile: bunk, assignment: null, isoDate };
    }

    return { profile: null, assignment: null, isoDate };
  }, [profiles, assignments, collegeDays, isoDate]);
}

export function useAllDayProfiles(): DayProfile[] {
  const rows = useLiveQuery(() => dayProfilesRepo.list(), [], []);
  return useMemo(
    () =>
      (rows ?? [])
        .filter((p) => !p.deleted)
        .sort((a, b) => a.order - b.order),
    [rows]
  );
}

/* -------------------- Day Journey (phases) hooks -------------------- */

export function usePhases(): Phase[] {
  const rows = useLiveQuery(() => phasesRepo.list(), [], []);
  return useMemo(
    () =>
      (rows ?? [])
        .filter((p) => !p.deleted && p.enabled)
        .sort((a, b) => a.order - b.order),
    [rows]
  );
}

export function useDayProgress(date: Date): {
  progress: DayProgress | null;
  loading: boolean;
  refresh: () => Promise<void>;
  currentPhase: Phase | null;
  phaseRoutines: Routine[];
  completions: CompletionRecord[];
  isComplete: boolean;
  position: { current: number; total: number };
} {
  const iso = toIsoDate(date);
  const [progress, setProgress] = useState<DayProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const liveProgress = useLiveQuery(
    async () => {
      const rows = await dayProgressRepo.list();
      return rows.find((d) => d.date === iso && !d.deleted) ?? null;
    },
    [iso],
    null
  );

  const phases = useLiveQuery(() => phasesRepo.list(), [], []);
  const routines = useLiveQuery(() => routinesRepo.list(), [], []);
  const completions = useLiveQuery(
    async () => {
      const rows = await completionRecordsRepo.list();
      return rows.filter((c) => c.date === iso && !c.deleted);
    },
    [iso],
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const p = await evaluateAndAdvance(date);
      setProgress(p);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (liveProgress) setProgress(liveProgress);
  }, [liveProgress]);

  const currentPhase = useMemo(() => {
    if (!progress?.currentPhaseId || !phases) return null;
    return phases.find((p) => p.id === progress.currentPhaseId) ?? null;
  }, [progress, phases]);

  const phaseRoutines = useMemo(() => {
    if (!currentPhase || !routines) return [];
    return routinesForPhase(currentPhase, routines, date);
  }, [currentPhase, routines, date]);

  const isComplete = progress ? isDayComplete(progress) : false;
  const position = progress
    ? phasePosition(progress, progress.currentPhaseId)
    : { current: 0, total: 0 };

  return {
    progress,
    loading,
    refresh,
    currentPhase,
    phaseRoutines,
    completions: completions ?? [],
    isComplete,
    position,
  };
}
