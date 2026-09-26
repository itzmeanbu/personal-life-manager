/**
 * Weekly Schedule settings — which modules/routines run on which days.
 * Entirely user-defined; no hardcoded weekend assumptions.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { routinesRepo } from '../../data/repository';
import type { Routine } from '../../data/types';
import { sortRoutines } from '../../routine/engine';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeeklySchedule() {
  const routines = useLiveQuery(() => routinesRepo.list(), [], []);
  const list = useMemo(
    () => sortRoutines((routines ?? []).filter((r) => !r.deleted && r.enabled)),
    [routines]
  );

  const [saving, setSaving] = useState<string | null>(null);

  const toggleDay = useCallback(
    async (routine: Routine, dayIndex: number) => {
      setSaving(routine.id);
      try {
        const current = routine.activeDays ?? [];
        const has = current.includes(dayIndex);
        let next: number[];
        if (has) {
          next = current.filter((d) => d !== dayIndex);
        } else {
          next = [...current, dayIndex].sort((a, b) => a - b);
        }
        // When user customizes days, switch cadence to custom so engine respects activeDays
        const cadence = next.length === 7 ? 'daily' : next.length === 0 ? routine.cadence : 'custom';
        await routinesRepo.update(routine.id, {
          activeDays: next,
          cadence: cadence as Routine['cadence'],
        });
      } finally {
        setSaving(null);
      }
    },
    []
  );

  const setAllDays = useCallback(
    async (routine: Routine, days: number[]) => {
      setSaving(routine.id);
      try {
        const cadence =
          days.length === 7 ? 'daily' : days.length === 5 && days.every((d) => d >= 1 && d <= 5)
            ? 'weekdays'
            : days.length === 2 && days.includes(0) && days.includes(6)
              ? 'weekends'
              : 'custom';
        await routinesRepo.update(routine.id, {
          activeDays: days,
          cadence: cadence as Routine['cadence'],
        });
      } finally {
        setSaving(null);
      }
    },
    []
  );

  return (
    <PageShell title="Weekly Schedule" showBack>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--text-sm)' }}>
        Choose exactly which days each routine/module is active. No automatic weekend rules —
        Saturday College or Sunday Workout is fully supported.
      </p>
      {list.length === 0 ? (
        <Card>No routines yet. Add some in Routines first.</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((r) => {
            const days = r.activeDays ?? [];
            return (
              <Card key={r.id}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {r.title}
                  {r.moduleTag ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      [{r.moduleTag}]
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DAY_LABELS.map((label, idx) => {
                    const on = days.includes(idx) || r.cadence === 'daily';
                    const weekdaysOn =
                      r.cadence === 'weekdays' && idx >= 1 && idx <= 5;
                    const weekendsOn =
                      r.cadence === 'weekends' && (idx === 0 || idx === 6);
                    const active = on || weekdaysOn || weekendsOn;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={saving === r.id}
                        onClick={() => toggleDay(r, idx)}
                        style={{
                          width: 40,
                          height: 36,
                          borderRadius: 8,
                          border: active
                            ? '2px solid var(--color-accent)'
                            : '1px solid var(--color-border)',
                          background: active
                            ? 'var(--color-accent)'
                            : 'transparent',
                          color: active ? '#fff' : 'var(--color-text)',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    variant="ghost"
                    onClick={() => setAllDays(r, [0, 1, 2, 3, 4, 5, 6])}
                  >
                    Every day
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAllDays(r, [1, 2, 3, 4, 5])}
                  >
                    Weekdays
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAllDays(r, [0, 6])}
                  >
                    Weekends
                  </Button>
                  <Button variant="ghost" onClick={() => setAllDays(r, [])}>
                    Clear
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
