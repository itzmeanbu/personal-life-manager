/**
 * Morning-only: "Did you eat?" (breakfast is part of the morning routine).
 * Window is before leave-home on weekdays (05:00–07:00) so it never asks
 * after you are already on the bus / at college.
 * No → pick time → in-app alert at that time → 30 min break → free time.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import { formatHm12 } from '../lib/timeFormat';
import {
  getMealGate,
  setMealGate,
  shouldAskMeal,
  shouldAlertEat,
  isFreeTimeUnlocked,
  type MealGateState,
} from './mealGate';

const EAT_TIMES = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '12:00', '13:00'];

export function MealPrompt({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [state, setState] = useState<MealGateState | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    setState(await getMealGate(iso));
  }, [iso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // re-check every 30s for meal alert
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await getMealGate(iso);
      if (shouldAlertEat(new Date(), s)) {
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Time to eat', { body: `You said ${s.eatAtHm}` });
          }
        } catch {
          /* ignore */
        }
        const next = await setMealGate({
          date: iso,
          ate: false,
          eatAtHm: s.eatAtHm,
          remindedAt: new Date().toISOString(),
        });
        setState(next);
      }
    })();
  }, [iso, tick]);

  if (!state) return null;

  const now = new Date();
  const ask = shouldAskMeal(now, state);
  const free = isFreeTimeUnlocked(now, state);

  const markAte = async () => {
    const after = new Date();
    after.setMinutes(after.getMinutes() + 30);
    const next = await setMealGate({
      date: iso,
      ate: true,
      freeTimeAfterIso: after.toISOString(),
      eatAtHm: state.eatAtHm,
      remindedAt: state.remindedAt,
    });
    setState(next);
  };

  const sayNo = async () => {
    const next = await setMealGate({ date: iso, ate: false });
    setState(next);
  };

  const pickTime = async (hm: string) => {
    const next = await setMealGate({
      date: iso,
      ate: false,
      eatAtHm: hm,
      remindedAt: undefined,
    });
    setState(next);
  };

  if (state.ate === true && free) {
    return (
      <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
        <strong>Meal done · free time unlocked</strong>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          30-minute settle is over. Night stuff / spin is yours.
        </p>
      </Card>
    );
  }

  if (state.ate === true && !free) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <strong>Digest break (30 min)</strong>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Free time opens after the short break.
        </p>
      </Card>
    );
  }

  if (state.ate === false && state.eatAtHm && !state.remindedAt) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <strong>Eating at {formatHm12(state.eatAtHm)}</strong>
        <p style={{ margin: '6px 0 8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          We&apos;ll nudge you then. After you eat, mark it so the 30-min break starts.
        </p>
        <Button variant="primary" onClick={markAte}>
          I ate — start 30 min break
        </Button>
      </Card>
    );
  }

  if (state.ate === false && state.remindedAt) {
    return (
      <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent)' }}>
        <strong>Eat now ({formatHm12(state.eatAtHm)})</strong>
        <p style={{ margin: '6px 0 8px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          You planned this. When you&apos;re done, mark it.
        </p>
        <Button variant="primary" onClick={markAte}>
          I ate — start 30 min break
        </Button>
      </Card>
    );
  }

  if (!ask) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <strong>Did you eat? (morning)</strong>
      <p style={{ margin: '6px 0 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        Breakfast is part of your morning routine — before you leave. Weekdays 5–7am; Sunday 7–10am. This will not ask after you leave home.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Button variant="primary" onClick={markAte}>
          Yes
        </Button>
        <Button variant="secondary" onClick={sayNo}>
          Not yet
        </Button>
      </div>
      {state.ate === false && !state.eatAtHm && (
        <>
          <p style={{ fontSize: 'var(--text-sm)', margin: '8px 0' }}>When will you eat?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EAT_TIMES.map((hm) => (
              <Button key={hm} variant="ghost" onClick={() => pickTime(hm)}>
                {formatHm12(hm)}
              </Button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
