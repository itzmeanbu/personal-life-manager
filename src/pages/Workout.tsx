import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  exerciseDefsRepo,
  workoutTemplatesRepo,
  workoutSessionsRepo,
  generateId,
} from '../data/repository';
import type {
  ExerciseDef,
  ExerciseModality,
  WorkoutTemplate,
  WorkoutTemplateItem,
  WorkoutExerciseLog,
} from '../data/types';
import { seedWorkoutEngineIfNeeded } from '../workout/seed';
import { formatPrescription, formatSessionStatus, dayLabel, emptyLogFromItem } from '../workout/format';
import { toIsoDate } from '../routine/engine';
import { useToday } from '../hooks/useToday';
import '../workout/workout.css';

type Tab = 'today' | 'session' | 'program' | 'exercises' | 'history';

export default function Workout() {
  const [tab, setTab] = useState<Tab>('today');
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const today = useToday();
  const todayIso = toIsoDate(today.date);

  useEffect(() => {
    seedWorkoutEngineIfNeeded().then(() => setSeeded(true));
  }, []);

  const templates = useLiveQuery(
    () => workoutTemplatesRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    [seeded]
  );
  const exercises = useLiveQuery(
    () => exerciseDefsRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    [seeded]
  );
  const sessions = useLiveQuery(
    () => workoutSessionsRepo.list().then((r) => r.sort((a, b) => (a.date < b.date ? 1 : -1))),
    [seeded]
  );

  const todayTemplate = useMemo(() => {
    const list = (templates ?? []).filter((t) => t.enabled && !t.deleted);
    return list.find((t) => t.dayIndex === today.dayIndex) ?? null;
  }, [templates, today.dayIndex]);

  const todaySession = useMemo(() => {
    return (sessions ?? []).find((s) => s.date === todayIso && !s.deleted) ?? null;
  }, [sessions, todayIso]);

  const activeSession = useMemo(() => {
    if (activeSessionId) {
      return (sessions ?? []).find((s) => s.id === activeSessionId) ?? todaySession;
    }
    return todaySession;
  }, [sessions, activeSessionId, todaySession]);

  const startSession = useCallback(
    async (tpl: WorkoutTemplate) => {
      setBusy(true);
      try {
        // Manual start after late-cancel / skip: soft-remove prior cancelled/skipped for the day
        const prior = (sessions ?? []).find((s) => s.date === todayIso && !s.deleted);
        if (prior && (prior.status === 'cancelled' || prior.status === 'skipped') && !tpl.isRest) {
          await workoutSessionsRepo.remove(prior.id, true);
        }
        if (tpl.isRest) {
          const row = await workoutSessionsRepo.create({
            date: todayIso,
            templateId: tpl.id,
            title: tpl.name,
            focus: tpl.focus,
            benefits: tpl.benefits,
            status: 'skipped',
            exercises: [],
            notes: tpl.notes ?? 'Rest day',
            durationMinutes: 0,
            endedAt: new Date().toISOString(),
          });
          setActiveSessionId(row.id);
          setTab('history');
          return;
        }
        const logs = [...tpl.items].sort((a, b) => a.order - b.order).map(emptyLogFromItem);
        const row = await workoutSessionsRepo.create({
          date: todayIso,
          templateId: tpl.id,
          title: tpl.name,
          focus: tpl.focus,
          benefits: tpl.benefits,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          exercises: logs,
        });
        setActiveSessionId(row.id);
        setTab('session');
      } finally {
        setBusy(false);
      }
    },
    [todayIso, sessions]
  );

  const updateExerciseLog = useCallback(
    async (sessionId: string, itemId: string, patch: Partial<WorkoutExerciseLog>) => {
      const session = (sessions ?? []).find((s) => s.id === sessionId);
      if (!session) return;
      const exercises = session.exercises.map((e) =>
        e.itemId === itemId ? { ...e, ...patch } : e
      );
      await workoutSessionsRepo.update(sessionId, { exercises });
    },
    [sessions]
  );

  const completeSession = useCallback(async (sessionId: string) => {
    const session = await workoutSessionsRepo.get(sessionId);
    if (!session) return;
    const started = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const durationMinutes = Math.max(1, Math.round((Date.now() - started) / 60000));
    await workoutSessionsRepo.update(sessionId, {
      status: 'completed',
      endedAt: new Date().toISOString(),
      durationMinutes,
    });
    setTab('history');
  }, []);

  const skipSession = useCallback(async (sessionId: string) => {
    await workoutSessionsRepo.update(sessionId, {
      status: 'skipped',
      endedAt: new Date().toISOString(),
    });
    setTab('history');
  }, []);

  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [editExId, setEditExId] = useState<string | null>(null);

  const saveTemplate = useCallback(async (tpl: WorkoutTemplate, patch: Partial<WorkoutTemplate>) => {
    await workoutTemplatesRepo.update(tpl.id, patch);
  }, []);

  const addTemplateItem = useCallback(async (tpl: WorkoutTemplate) => {
    const item: WorkoutTemplateItem = {
      id: generateId(),
      name: 'New exercise',
      modality: 'sets_reps',
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      restSeconds: 60,
      order: tpl.items.length,
    };
    await workoutTemplatesRepo.update(tpl.id, { items: [...tpl.items, item] });
  }, []);

  const updateTemplateItem = useCallback(
    async (tpl: WorkoutTemplate, itemId: string, patch: Partial<WorkoutTemplateItem>) => {
      const items = tpl.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
      await workoutTemplatesRepo.update(tpl.id, { items });
    },
    []
  );

  const removeTemplateItem = useCallback(async (tpl: WorkoutTemplate, itemId: string) => {
    await workoutTemplatesRepo.update(tpl.id, {
      items: tpl.items.filter((it) => it.id !== itemId),
    });
  }, []);

  const addExerciseDef = useCallback(async () => {
    const max = (exercises ?? []).reduce((m, e) => Math.max(m, e.order), -1);
    await exerciseDefsRepo.create({
      name: 'New exercise',
      defaultModality: 'sets_reps',
      defaultSets: 3,
      defaultRepsMin: 8,
      defaultRepsMax: 12,
      defaultRestSeconds: 60,
      benefits: [],
      enabled: true,
      order: max + 1,
    });
  }, [exercises]);

  const saveExerciseDef = useCallback(async (id: string, patch: Partial<ExerciseDef>) => {
    await exerciseDefsRepo.update(id, patch);
  }, []);

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'today', label: 'Today' },
      { id: 'session', label: 'Session' },
      { id: 'program', label: 'Program' },
      { id: 'exercises', label: 'Exercises' },
      { id: 'history', label: 'History' },
    ];
    return (
      <div className="wk-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`wk-tab ${tab === t.id ? 'wk-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  function renderToday() {
    if (!todayTemplate) {
      return (
        <EmptyState
          icon="💪"
          title="No program for today"
          description="Add or enable a template for this weekday under Program."
          action={
            <Button variant="secondary" onClick={() => setTab('program')}>
              Open Program
            </Button>
          }
        />
      );
    }
    return (
      <>
        <Card className="wk-hero">
          <div className="wk-hero__day">{dayLabel(todayTemplate.dayIndex)}</div>
          <h2 className="wk-hero__title">
            {todayTemplate.isRest ? '😴 ' : '💪 '}
            {todayTemplate.name}
          </h2>
          <p className="wk-muted">Focus: {todayTemplate.focus}</p>
          {todayTemplate.benefits.length > 0 && (
            <div className="wk-tags">
              {todayTemplate.benefits.map((b) => (
                <span key={b} className="wk-tag">{b}</span>
              ))}
            </div>
          )}
          {todayTemplate.notes && <p className="wk-muted">{todayTemplate.notes}</p>}
        </Card>
        {todaySession ? (
          <Card>
            <p>
              Today&apos;s session: <strong>{formatSessionStatus(todaySession.status)}</strong>
              {todaySession.durationMinutes != null && ` · ${todaySession.durationMinutes} min`}
            </p>
            {todaySession.notes && (
              <p className="wk-muted" style={{ marginTop: 6 }}>{todaySession.notes}</p>
            )}
            {todaySession.status === 'in_progress' && (
              <Button
                variant="primary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setActiveSessionId(todaySession.id);
                  setTab('session');
                }}
              >
                Continue session
              </Button>
            )}
            {(todaySession.status === 'cancelled' || todaySession.status === 'skipped') &&
              !todayTemplate.isRest && (
              <Button
                variant="secondary"
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={() => startSession(todayTemplate)}
              >
                MANUAL START
              </Button>
            )}
          </Card>
        ) : todayTemplate.isRest ? (
          <Button variant="secondary" disabled={busy} onClick={() => startSession(todayTemplate)}>
            Log rest day
          </Button>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="primary" disabled={busy} onClick={() => startSession(todayTemplate)}>
              START
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await startSession({ ...todayTemplate, isRest: true, name: todayTemplate.name + ' (skipped)' } as typeof todayTemplate);
                } finally {
                  setBusy(false);
                }
              }}
            >
              SKIP TODAY
            </Button>
          </div>
        )}
        {!todayTemplate.isRest && (
          <>
            <SectionHeader title="Today's exercises" />
            <Card style={{ padding: 0 }}>
              {[...todayTemplate.items]
                .sort((a, b) => a.order - b.order)
                .map((it, i, arr) => (
                  <div
                    key={it.id}
                    className="wk-ex-row"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <div className="wk-ex-row__name">{it.name}</div>
                    <div className="wk-ex-row__presc">{formatPrescription(it)}</div>
                  </div>
                ))}
            </Card>
          </>
        )}
      </>
    );
  }

  function renderSession() {
    const session = activeSession;
    if (!session || session.status === 'skipped' || session.status === 'cancelled') {
      return (
        <EmptyState
          icon="🏋️"
          title="No active session"
          description="Start today's workout from the Today tab."
          action={
            <Button variant="secondary" onClick={() => setTab('today')}>
              Go to Today
            </Button>
          }
        />
      );
    }
    const tpl = (templates ?? []).find((t) => t.id === session.templateId);
    return (
      <>
        <Card>
          <strong>{session.title}</strong>
          <p className="wk-muted">
            {formatSessionStatus(session.status)} · {session.focus}
          </p>
          <div className="wk-session-actions">
            {session.status === 'in_progress' && (
              <>
                <Button variant="primary" onClick={() => completeSession(session.id)}>
                  Finish workout
                </Button>
                <Button variant="ghost" onClick={() => skipSession(session.id)}>
                  Skip workout
                </Button>
              </>
            )}
          </div>
        </Card>
        {session.exercises.map((log) => {
          const item = tpl?.items.find((i) => i.id === log.itemId);
          return (
            <Card key={log.itemId} className="wk-log-card">
              <div className="wk-log-card__head">
                <span className="wk-log-card__name">{log.name}</span>
                <span className={`wk-status wk-status--${log.status}`}>{log.status}</span>
              </div>
              {item && <p className="wk-muted">{formatPrescription(item)}</p>}
              {item?.customInstructions && (
                <p className="wk-instructions">{item.customInstructions}</p>
              )}
              {log.modality === 'total_reps' && (
                <div className="wk-log-controls">
                  <label className="wk-field-label">Total reps done</label>
                  <input
                    className="wk-input"
                    type="number"
                    min={0}
                    value={log.totalRepsDone ?? 0}
                    onChange={(e) =>
                      updateExerciseLog(session.id, log.itemId, {
                        totalRepsDone: Number(e.target.value),
                        status: Number(e.target.value) > 0 ? 'partial' : 'pending',
                      })
                    }
                  />
                </div>
              )}
              {(log.modality === 'sets_reps' || log.modality === 'duration') && item && (
                <div className="wk-sets">
                  {Array.from({ length: item.sets ?? 1 }).map((_, si) => {
                    const done = log.setsDone[si];
                    return (
                      <div key={si} className="wk-set-row">
                        <span className="wk-set-label">Set {si + 1}</span>
                        {log.modality === 'sets_reps' ? (
                          <input
                            className="wk-input wk-input--sm"
                            type="number"
                            placeholder="reps"
                            value={done?.reps ?? ''}
                            onChange={(e) => {
                              const setsDone = [...log.setsDone];
                              while (setsDone.length <= si) setsDone.push({});
                              setsDone[si] = {
                                ...setsDone[si],
                                reps: e.target.value === '' ? undefined : Number(e.target.value),
                              };
                              const filled = setsDone.filter((s) => s.reps != null || s.skipped).length;
                              const status =
                                filled === 0
                                  ? 'pending'
                                  : filled >= (item.sets ?? 1)
                                    ? 'done'
                                    : 'partial';
                              updateExerciseLog(session.id, log.itemId, { setsDone, status });
                            }}
                          />
                        ) : (
                          <input
                            className="wk-input wk-input--sm"
                            type="number"
                            placeholder="sec"
                            value={done?.durationSeconds ?? ''}
                            onChange={(e) => {
                              const setsDone = [...log.setsDone];
                              while (setsDone.length <= si) setsDone.push({});
                              setsDone[si] = {
                                ...setsDone[si],
                                durationSeconds:
                                  e.target.value === '' ? undefined : Number(e.target.value),
                              };
                              const filled = setsDone.filter(
                                (s) => s.durationSeconds != null || s.skipped
                              ).length;
                              const status =
                                filled === 0
                                  ? 'pending'
                                  : filled >= (item.sets ?? 1)
                                    ? 'done'
                                    : 'partial';
                              updateExerciseLog(session.id, log.itemId, { setsDone, status });
                            }}
                          />
                        )}
                        <button
                          type="button"
                          className="wk-link"
                          onClick={() => {
                            const setsDone = [...log.setsDone];
                            while (setsDone.length <= si) setsDone.push({});
                            setsDone[si] = { skipped: true };
                            updateExerciseLog(session.id, log.itemId, {
                              setsDone,
                              status: 'partial',
                            });
                          }}
                        >
                          Skip set
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="wk-log-actions">
                <Button
                  variant="secondary"
                  onClick={() => updateExerciseLog(session.id, log.itemId, { status: 'done' })}
                >
                  Done
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => updateExerciseLog(session.id, log.itemId, { status: 'skipped' })}
                >
                  Skip exercise
                </Button>
              </div>
            </Card>
          );
        })}
      </>
    );
  }

  function renderProgram() {
    const list = templates ?? [];
    if (editTplId) {
      const tpl = list.find((t) => t.id === editTplId);
      if (!tpl) return null;
      return (
        <>
          <SectionHeader title={`Edit · ${tpl.name}`} />
          <Card>
            <label className="wk-field-label">Name</label>
            <input className="wk-input" value={tpl.name} onChange={(e) => saveTemplate(tpl, { name: e.target.value })} />
            <label className="wk-field-label">Focus</label>
            <input className="wk-input" value={tpl.focus} onChange={(e) => saveTemplate(tpl, { focus: e.target.value })} />
            <label className="wk-field-label">Day (0=Sun … 6=Sat)</label>
            <input
              className="wk-input"
              type="number"
              min={0}
              max={6}
              value={tpl.dayIndex ?? ''}
              onChange={(e) =>
                saveTemplate(tpl, { dayIndex: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <label className="wk-check">
              <input type="checkbox" checked={tpl.isRest} onChange={(e) => saveTemplate(tpl, { isRest: e.target.checked })} />
              Rest day
            </label>
            <label className="wk-field-label">Benefits (comma-separated)</label>
            <input
              className="wk-input"
              value={tpl.benefits.join(', ')}
              onChange={(e) =>
                saveTemplate(tpl, {
                  benefits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            <label className="wk-field-label">Notes</label>
            <textarea className="wk-input wk-textarea" value={tpl.notes ?? ''} onChange={(e) => saveTemplate(tpl, { notes: e.target.value })} rows={2} />
            <label className="wk-check">
              <input type="checkbox" checked={tpl.enabled} onChange={(e) => saveTemplate(tpl, { enabled: e.target.checked })} />
              Enabled
            </label>
          </Card>
          <SectionHeader
            title="Exercises in this day"
            action={<Button variant="ghost" onClick={() => addTemplateItem(tpl)}>+ Add</Button>}
          />
          {[...tpl.items].sort((a, b) => a.order - b.order).map((it) => (
            <Card key={it.id}>
              <input className="wk-input" value={it.name} onChange={(e) => updateTemplateItem(tpl, it.id, { name: e.target.value })} />
              <label className="wk-field-label">Modality</label>
              <select
                className="wk-input"
                value={it.modality}
                onChange={(e) => updateTemplateItem(tpl, it.id, { modality: e.target.value as ExerciseModality })}
              >
                <option value="sets_reps">Sets × reps</option>
                <option value="total_reps">Total reps</option>
                <option value="duration">Duration hold</option>
                <option value="custom">Custom instructions only</option>
              </select>
              {it.modality === 'sets_reps' && (
                <div className="wk-grid-3">
                  <div>
                    <label className="wk-field-label">Sets</label>
                    <input className="wk-input" type="number" value={it.sets ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { sets: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="wk-field-label">Reps min</label>
                    <input className="wk-input" type="number" value={it.repsMin ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { repsMin: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="wk-field-label">Reps max</label>
                    <input className="wk-input" type="number" value={it.repsMax ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { repsMax: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {it.modality === 'total_reps' && (
                <div className="wk-grid-3">
                  <div>
                    <label className="wk-field-label">Total reps</label>
                    <input className="wk-input" type="number" value={it.totalReps ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { totalReps: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="wk-field-label">~Chunk</label>
                    <input className="wk-input" type="number" value={it.chunkReps ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { chunkReps: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {it.modality === 'duration' && (
                <div className="wk-grid-3">
                  <div>
                    <label className="wk-field-label">Sets</label>
                    <input className="wk-input" type="number" value={it.sets ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { sets: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="wk-field-label">Seconds</label>
                    <input className="wk-input" type="number" value={it.durationSeconds ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { durationSeconds: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              <label className="wk-field-label">Rest (sec)</label>
              <input className="wk-input" type="number" value={it.restSeconds ?? ''} onChange={(e) => updateTemplateItem(tpl, it.id, { restSeconds: Number(e.target.value) })} />
              <label className="wk-field-label">Custom instructions</label>
              <textarea
                className="wk-input wk-textarea"
                value={it.customInstructions ?? ''}
                onChange={(e) => updateTemplateItem(tpl, it.id, { customInstructions: e.target.value })}
                rows={2}
                placeholder='e.g. "Do 50 total. ~10 at a time. Rest between."'
              />
              <Button variant="ghost" onClick={() => removeTemplateItem(tpl, it.id)}>Remove exercise</Button>
            </Card>
          ))}
          <Button variant="secondary" onClick={() => setEditTplId(null)}>Done editing</Button>
        </>
      );
    }
    return (
      <>
        <SectionHeader title="Weekly program" />
        <p className="wk-muted">Fully editable — change days, exercises, modalities, and rest without code.</p>
        {list.length === 0 ? (
          <EmptyState icon="📋" title="No templates" description="Seed may still be loading." />
        ) : (
          <Card style={{ padding: 0 }}>
            {list.map((tpl, i) => (
              <div
                key={tpl.id}
                className="wk-prog-row"
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                  opacity: tpl.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div className="wk-prog-row__title">
                    <span className="wk-day-pill">{dayLabel(tpl.dayIndex)}</span>
                    {tpl.name}
                    {tpl.isRest && <span className="wk-tag">rest</span>}
                  </div>
                  <div className="wk-muted">
                    {tpl.isRest ? tpl.notes || 'Rest' : `${tpl.items.length} exercises · ${tpl.focus}`}
                  </div>
                </div>
                <button type="button" className="wk-link" onClick={() => setEditTplId(tpl.id)}>Edit</button>
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  function renderExercises() {
    const list = exercises ?? [];
    if (editExId) {
      const ex = list.find((e) => e.id === editExId);
      if (!ex) return null;
      return (
        <>
          <SectionHeader title={`Edit · ${ex.name}`} />
          <Card>
            <label className="wk-field-label">Name</label>
            <input className="wk-input" value={ex.name} onChange={(e) => saveExerciseDef(ex.id, { name: e.target.value })} />
            <label className="wk-field-label">Default modality</label>
            <select className="wk-input" value={ex.defaultModality} onChange={(e) => saveExerciseDef(ex.id, { defaultModality: e.target.value as ExerciseModality })}>
              <option value="sets_reps">Sets × reps</option>
              <option value="total_reps">Total reps</option>
              <option value="duration">Duration</option>
              <option value="custom">Custom</option>
            </select>
            <label className="wk-field-label">Instructions</label>
            <textarea className="wk-input wk-textarea" value={ex.instructions ?? ''} onChange={(e) => saveExerciseDef(ex.id, { instructions: e.target.value })} rows={2} />
            <label className="wk-field-label">Tutorial</label>
            <textarea className="wk-input wk-textarea" value={ex.tutorial ?? ''} onChange={(e) => saveExerciseDef(ex.id, { tutorial: e.target.value })} rows={3} />
            <label className="wk-field-label">Video URL</label>
            <input className="wk-input" value={ex.videoUrl ?? ''} onChange={(e) => saveExerciseDef(ex.id, { videoUrl: e.target.value })} />
            <label className="wk-field-label">Animation key</label>
            <input className="wk-input" value={ex.animationKey ?? ''} onChange={(e) => saveExerciseDef(ex.id, { animationKey: e.target.value })} />
            <label className="wk-field-label">Notes</label>
            <textarea className="wk-input wk-textarea" value={ex.notes ?? ''} onChange={(e) => saveExerciseDef(ex.id, { notes: e.target.value })} rows={2} />
            <label className="wk-field-label">Benefits (comma)</label>
            <input
              className="wk-input"
              value={ex.benefits.join(', ')}
              onChange={(e) =>
                saveExerciseDef(ex.id, {
                  benefits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
            <div className="wk-grid-3">
              <div>
                <label className="wk-field-label">Sets</label>
                <input className="wk-input" type="number" value={ex.defaultSets ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultSets: Number(e.target.value) })} />
              </div>
              <div>
                <label className="wk-field-label">Reps min</label>
                <input className="wk-input" type="number" value={ex.defaultRepsMin ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultRepsMin: Number(e.target.value) })} />
              </div>
              <div>
                <label className="wk-field-label">Reps max</label>
                <input className="wk-input" type="number" value={ex.defaultRepsMax ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultRepsMax: Number(e.target.value) })} />
              </div>
            </div>
            <div className="wk-grid-3">
              <div>
                <label className="wk-field-label">Total reps</label>
                <input className="wk-input" type="number" value={ex.defaultTotalReps ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultTotalReps: Number(e.target.value) })} />
              </div>
              <div>
                <label className="wk-field-label">Chunk</label>
                <input className="wk-input" type="number" value={ex.defaultChunkReps ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultChunkReps: Number(e.target.value) })} />
              </div>
              <div>
                <label className="wk-field-label">Duration sec</label>
                <input className="wk-input" type="number" value={ex.defaultDurationSeconds ?? ''} onChange={(e) => saveExerciseDef(ex.id, { defaultDurationSeconds: Number(e.target.value) })} />
              </div>
            </div>
            <Button variant="secondary" onClick={() => setEditExId(null)}>Done</Button>
          </Card>
        </>
      );
    }
    return (
      <>
        <SectionHeader title="Exercise library" action={<Button variant="secondary" onClick={addExerciseDef}>+ Add</Button>} />
        <Card style={{ padding: 0 }}>
          {list.map((ex, i) => (
            <div
              key={ex.id}
              className="wk-prog-row"
              style={{
                borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                opacity: ex.enabled ? 1 : 0.5,
              }}
            >
              <div>
                <div className="wk-prog-row__title">{ex.name}</div>
                <div className="wk-muted">{ex.defaultModality}{ex.instructions ? ` · ${ex.instructions}` : ''}</div>
              </div>
              <button type="button" className="wk-link" onClick={() => setEditExId(ex.id)}>Edit</button>
            </div>
          ))}
        </Card>
      </>
    );
  }

  function renderHistory() {
    const list = (sessions ?? []).filter((s) => !s.deleted);
    if (list.length === 0) {
      return (
        <EmptyState icon="📊" title="No sessions yet" description="History only shows workouts you actually logged." />
      );
    }
    return (
      <>
        <SectionHeader title="History" />
        <Card style={{ padding: 0 }}>
          {list.map((s, i) => (
            <div
              key={s.id}
              className="wk-hist-row"
              style={{ borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            >
              <div>
                <div className="wk-prog-row__title">{s.date} · {s.title}</div>
                <div className="wk-muted">
                  {formatSessionStatus(s.status)}
                  {s.durationMinutes != null ? ` · ${s.durationMinutes} min` : ''}
                  {s.focus ? ` · ${s.focus}` : ''}
                </div>
                {s.benefits?.length > 0 && (
                  <div className="wk-tags" style={{ marginTop: 4 }}>
                    {s.benefits.map((b) => (
                      <span key={b} className="wk-tag">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              {s.status === 'in_progress' && (
                <button type="button" className="wk-link" onClick={() => { setActiveSessionId(s.id); setTab('session'); }}>
                  Resume
                </button>
              )}
            </div>
          ))}
        </Card>
      </>
    );
  }

  return (
    <PageShell title="Workout">
      {tabsBar()}
      {tab === 'today' && renderToday()}
      {tab === 'session' && renderSession()}
      {tab === 'program' && renderProgram()}
      {tab === 'exercises' && renderExercises()}
      {tab === 'history' && renderHistory()}
    </PageShell>
  );
}
