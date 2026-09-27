import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  getLifestyle,
  setLifestyle,
  DAY_LABELS,
  type LifestyleConfig,
  type WorkoutDayIndex,
  DEFAULT_LIFESTYLE,
} from '../../lifestyle/config';
import { applyLifestyleToRoutines } from '../../lifestyle/applyLifestyle';
import { routinesRepo } from '../../data/repository';
import { formatHm12 } from '../../lib/timeFormat';

const WAKE = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00'];
const BATH = ['21:00', '21:15', '21:30', '21:45', '22:00'];
const GUITAR = [30, 45, 60, 90];

type StepId =
  | 'wake'
  | 'bath'
  | 'college_weekend'
  | 'workout_rest'
  | 'guitar'
  | 'nudges'
  | 'done';

const STEPS: StepId[] = [
  'wake',
  'bath',
  'college_weekend',
  'workout_rest',
  'guitar',
  'nudges',
  'done',
];

export default function LifestyleWizard() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<LifestyleConfig>(DEFAULT_LIFESTYLE);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getLifestyle().then(setCfg);
  }, []);

  const id = STEPS[step];
  const progress = `${step + 1} / ${STEPS.length}`;

  const patch = useCallback(async (p: Partial<LifestyleConfig>) => {
    const next = await setLifestyle(p);
    setCfg(next);
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const ensureHabitRoutines = async () => {
    const list = await routinesRepo.list();
    const titles = new Set(list.filter((r) => !r.deleted).map((r) => r.title.toLowerCase()));
    const add = async (
      title: string,
      category: string,
      time: string,
      durationMinutes: number,
      extra?: Record<string, unknown>
    ) => {
      if (titles.has(title.toLowerCase())) return;
      await routinesRepo.create({
        title,
        category,
        kind: 'recurring',
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        time,
        durationMinutes,
        enabled: true,
        archived: false,
        reminder: { enabled: true, offsetMinutes: 0 },
        ...extra,
      } as never);
    };
    await add('Sunscreen', 'Hygiene', '07:10', 3);
    await add('Face treatment', 'Hygiene', '07:12', 5);
    await add('Hair serum', 'Hygiene', '07:15', 3);
    await add('Bath', 'Hygiene', cfg.bathHm, 25);
    await add('Charge phone', 'Evening', '22:00', 2);
    await add('Switch ON after plug', 'Evening', '22:05', 1);
    await add('Guitar practice', 'Music', '20:15', cfg.guitarMinutes, { moduleTag: 'guitar' });
  };

  const finish = async () => {
    setBusy(true);
    try {
      await ensureHabitRoutines();
      await applyLifestyleToRoutines(cfg);
      await setLifestyle({ ...cfg, wizardDone: true });
      setMsg('Saved — your day routines match these answers.');
      setStep(STEPS.length - 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Easy setup" showBack>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 0 }}>
        One question at a time. Change anything later. ({progress})
      </p>

      {id === 'wake' && (
        <Card>
          <strong>When do you usually want to wake up?</strong>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Face + hair treatment every day after wake — including Sat/Sun.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {WAKE.map((hm) => (
              <Button
                key={hm}
                variant={cfg.wakeHm === hm ? 'primary' : 'secondary'}
                onClick={() => patch({ wakeHm: hm })}
              >
                {formatHm12(hm)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {id === 'bath' && (
        <Card>
          <strong>Night bath time?</strong>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Daily. Default 9:30. Spin winds down before this.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {BATH.map((hm) => (
              <Button
                key={hm}
                variant={cfg.bathHm === hm ? 'primary' : 'secondary'}
                onClick={() => patch({ bathHm: hm })}
              >
                {formatHm12(hm)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {id === 'college_weekend' && (
        <Card>
          <strong>College on Saturday / Sunday if possible?</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button
              variant={cfg.collegeWeekends ? 'primary' : 'secondary'}
              onClick={() => patch({ collegeWeekends: true })}
            >
              Yes — even weekends
            </Button>
            <Button
              variant={!cfg.collegeWeekends ? 'primary' : 'secondary'}
              onClick={() => patch({ collegeWeekends: false })}
            >
              No — weekends free
            </Button>
          </div>
        </Card>
      )}

      {id === 'workout_rest' && (
        <Card>
          <strong>Which day is workout rest?</strong>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Other days keep workout (with extra time buffer — sessions always run long).
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {DAY_LABELS.map((label, i) => (
              <Button
                key={label}
                variant={cfg.workoutRestDay === i ? 'primary' : 'secondary'}
                onClick={() => patch({ workoutRestDay: i as WorkoutDayIndex })}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {id === 'guitar' && (
        <Card>
          <strong>Guitar — how long on college days?</strong>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Every day. Also on the spin wheel for extra.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {GUITAR.map((m) => (
              <Button
                key={m}
                variant={cfg.guitarMinutes === m ? 'primary' : 'secondary'}
                onClick={() => patch({ guitarMinutes: m })}
              >
                {m} min
              </Button>
            ))}
          </div>
        </Card>
      )}

      {id === 'nudges' && (
        <Card>
          <strong>What should we remind you about?</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Button
              variant={cfg.phoneChargeNudge ? 'primary' : 'secondary'}
              onClick={() => patch({ phoneChargeNudge: !cfg.phoneChargeNudge })}
            >
              {cfg.phoneChargeNudge ? '✓' : '○'} Charge phone at night
            </Button>
            <Button
              variant={cfg.plugSwitchNudge ? 'primary' : 'secondary'}
              onClick={() => patch({ plugSwitchNudge: !cfg.plugSwitchNudge })}
            >
              {cfg.plugSwitchNudge ? '✓' : '○'} Switch ON after plugging
            </Button>
            <Button
              variant={cfg.encouragementOn ? 'primary' : 'secondary'}
              onClick={() => patch({ encouragementOn: !cfg.encouragementOn })}
            >
              {cfg.encouragementOn ? '✓' : '○'} Random encouragement
            </Button>
          </div>
        </Card>
      )}

      {id === 'done' && (
        <Card>
          <strong>You&apos;re set</strong>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Wake {formatHm12(cfg.wakeHm)} · Bath {formatHm12(cfg.bathHm)} · Guitar {cfg.guitarMinutes}m · Rest day{' '}
            {DAY_LABELS[cfg.workoutRestDay]}. Sunday weekly spins: clean laptop / room / files.
          </p>
          {msg && <p style={{ color: 'var(--color-accent)' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => nav('/')}>
              Open Home
            </Button>
            <Button variant="secondary" onClick={() => setStep(0)}>
              Change answers
            </Button>
          </div>
        </Card>
      )}

      {id !== 'done' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {step > 0 && (
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
          )}
          {step < STEPS.length - 2 ? (
            <Button variant="primary" onClick={next}>
              Next
            </Button>
          ) : (
            <Button variant="primary" disabled={busy} onClick={finish}>
              {busy ? 'Saving…' : 'Save & finish'}
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
}
