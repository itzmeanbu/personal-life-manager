/**
 * Bus / travel buttons: Boarded bus, Reached college, Boarded bus home,
 * Reached home. Starts and stops the English + Tamil travel music.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import { formatIsoTime12 } from '../lib/timeFormat';
import {
  TRAVEL_FLOW,
  getDefaultFare,
  getTravel,
  logTravel,
  nextTravelStep,
  undoLastTravel,
  type TravelState,
} from './travel';
import { isCollegeLikeDay } from './dayContext';
import { startTravelMusic, stopTravelMusic } from '../music/travelMusic';
import { rescheduleAllNotifications } from '../notifications/scheduler';

export function TravelCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [show, setShow] = useState(false);
  const [state, setState] = useState<TravelState>({ date: iso, events: [] });
  const [fare, setFare] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setShow(await isCollegeLikeDay(date));
    setState(await getTravel(iso));
    const f = await getDefaultFare();
    setFare(f > 0 ? String(f) : '');
  }, [iso, date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!show) return null;

  const step = nextTravelStep(state);

  const tap = async () => {
    if (!step) return;
    const amount = Number(fare);
    const isBoarding = step.kind === 'boarded_out' || step.kind === 'boarded_back';
    const next = await logTravel(iso, step.kind, isBoarding && amount > 0 ? amount : undefined);
    setState(next);

    if (isBoarding) {
      const r = await startTravelMusic(`${iso}:${step.kind}`);
      setMsg(r.message);
    } else {
      stopTravelMusic();
      setMsg(null);
    }
    void rescheduleAllNotifications();
  };

  const undo = async () => {
    const last = state.events[state.events.length - 1];
    setState(await undoLastTravel(iso));
    if (last && (last.kind === 'boarded_out' || last.kind === 'boarded_back')) stopTravelMusic();
    void rescheduleAllNotifications();
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <strong>🚌 Travel</strong>

      {state.events.length > 0 && (
        <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
          {state.events.map((e) => {
            const f = TRAVEL_FLOW.find((x) => x.kind === e.kind);
            return (
              <li key={e.kind} style={{ fontSize: 'var(--text-sm)', marginBottom: 2 }}>
                {f?.emoji} {f?.label} · {formatIsoTime12(e.at)}
                {e.fare ? ` · ₹${e.fare}` : ''}
              </li>
            );
          })}
        </ul>
      )}

      {step ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(step.kind === 'boarded_out' || step.kind === 'boarded_back') && (
            <input
              type="number"
              inputMode="decimal"
              placeholder="Bus fare (optional)"
              value={fare}
              onChange={(e) => setFare(e.target.value)}
              style={{ padding: 10 }}
            />
          )}
          <Button onClick={tap}>
            {step.emoji} {step.label}
          </Button>
        </div>
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          All travel logged for today.
        </p>
      )}

      {msg && <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)' }}>{msg}</p>}

      {state.events.length > 0 && (
        <Button variant="ghost" onClick={undo} style={{ marginTop: 6 }}>
          Undo last
        </Button>
      )}
    </Card>
  );
}
