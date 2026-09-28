/**
 * Water goal + afternoon sunscreen + lip balm on Day Brief.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getWellnessConfig,
  getWellnessDay,
  addWater,
  markSunscreenAfternoon,
  markLipBalm,
  setWellnessConfig,
  setWellnessDay,
  shouldAskSunscreenAfternoon,
  shouldRemindWater,
  notify,
  type WellnessConfig,
  type WellnessDayState,
  DEFAULT_WELLNESS,
} from './wellness';

export function WellnessCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [config, setConfig] = useState<WellnessConfig>(DEFAULT_WELLNESS);
  const [state, setState] = useState<WellnessDayState | null>(null);
  const [tick, setTick] = useState(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('8');

  const reload = useCallback(async () => {
    setConfig(await getWellnessConfig());
    setState(await getWellnessDay(iso));
  }, [iso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Soft notifications while app is open / returns to foreground
  useEffect(() => {
    void (async () => {
      const cfg = await getWellnessConfig();
      const s = await getWellnessDay(iso);
      const now = new Date();

      if (shouldAskSunscreenAfternoon(now, s, cfg) && !s.notified.sunscreenAfternoon) {
        await notify('Sunscreen', 'After noon at college — reapply sunscreen?');
        const next = {
          ...s,
          notified: { ...s.notified, sunscreenAfternoon: true },
        };
        await setWellnessDay(next);
        setState(next);
      }

      if (shouldRemindWater(now, s, cfg)) {
        await notify('Water', `Hydrate — ${s.waterCount}/${cfg.waterGoal} glasses so far`);
        const next = {
          ...s,
          lastWaterRemindAt: now.toISOString(),
          notified: { ...s.notified, water: true },
        };
        await setWellnessDay(next);
        setState(next);
      }
    })();
  }, [iso, tick]);

  if (!state) return null;

  const now = new Date();
  const showSunscreen = shouldAskSunscreenAfternoon(now, state, config);
  const showLip =
    config.lipBalmEnabled && !state.lipBalmDone && now.getHours() >= 8 && now.getHours() < 22;

  return (
    <Card style={{ marginBottom: 12 }}>
      <strong>💧 Wellness</strong>

      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)' }}>
            Water · {state.waterCount}/{config.waterGoal} glasses
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {' '}
              (~{state.waterCount * config.mlPerGlass} ml)
            </span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="primary"
              onClick={async () => setState(await addWater(iso, 1))}
            >
              +1 glass
            </Button>
            {state.waterCount > 0 && (
              <Button
                variant="ghost"
                onClick={async () => setState(await addWater(iso, -1))}
              >
                −1
              </Button>
            )}
          </div>
        </div>

        {!editingGoal ? (
          <Button
            variant="ghost"
            onClick={() => {
              setGoalDraft(String(config.waterGoal));
              setEditingGoal(true);
            }}
          >
            Change goal
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              type="number"
              min={1}
              max={20}
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              style={{
                width: 72,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'inherit',
              }}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                const n = Number(goalDraft);
                if (n >= 1 && n <= 20) {
                  setConfig(await setWellnessConfig({ waterGoal: n }));
                }
                setEditingGoal(false);
              }}
            >
              Save goal
            </Button>
            <Button variant="ghost" onClick={() => setEditingGoal(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {showSunscreen && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: 8 }}>
            After noon — reapply sunscreen?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="primary"
              onClick={async () => setState(await markSunscreenAfternoon(iso))}
            >
              Yes
            </Button>
            <Button
              variant="secondary"
              onClick={async () => setState(await markSunscreenAfternoon(iso))}
            >
              Skip
            </Button>
          </div>
        </div>
      )}

      {showLip && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Lip balm on?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={async () => setState(await markLipBalm(iso))}>
              Yes
            </Button>
            <Button variant="secondary" onClick={async () => setState(await markLipBalm(iso))}>
              Later
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
