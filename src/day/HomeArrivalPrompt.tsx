/**
 * Arrival window prompt on Day Brief:
 * "Near home?" → turn app location tracking ON
 * "When will you arrive?" → ETA + tracking ON
 * After home registered → tracking OFF automatically
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { toIsoDate } from '../routine/engine';
import { getHomeConfig } from '../home/settings';
import { probeLocationCapability } from '../home/platform';
import {
  getLocationSession,
  isInArrivalWindow,
  turnLocationTrackingOn,
  turnLocationTrackingOff,
  setEta,
  registerHomeManual,
  markAsking,
  ETA_OPTIONS,
  type LocationSessionState,
} from '../home/locationSession';
import { formatHm12 } from '../lib/timeFormat';
import type { HomeArrivalConfig } from '../home/types';

export function HomeArrivalPrompt({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [session, setSession] = useState<LocationSessionState | null>(null);
  const [config, setConfig] = useState<HomeArrivalConfig | null>(null);
  const [tick, setTick] = useState(0);
  const [pickingEta, setPickingEta] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setConfig(await getHomeConfig());
    setSession(await getLocationSession(iso));
  }, [iso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Enter "asking" phase when arrival window opens
  useEffect(() => {
    void (async () => {
      const cfg = await getHomeConfig();
      const s = await getLocationSession(iso);
      if (s.phase === 'home' || s.phase === 'skipped' || s.phase === 'tracking') return;
      if (!isInArrivalWindow(cfg, new Date())) return;
      if (s.phase === 'asking' || s.prompted) return;
      setSession(await markAsking(iso));
    })();
  }, [iso, tick]);

  if (!session || !config) return null;

  const cap = probeLocationCapability();
  const inWindow = isInArrivalWindow(config, new Date());

  // Done for today
  if (session.phase === 'home') {
    return (
      <Card style={{ marginBottom: 12, opacity: 0.9 }}>
        <strong>🏠 You&apos;re home</strong>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Location tracking for arrival is <strong>off</strong>
          {session.homeAt
            ? ` · registered ${new Date(session.homeAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : ''}
          .
        </p>
      </Card>
    );
  }

  if (session.phase === 'skipped' && !inWindow) return null;

  if (session.phase === 'tracking') {
    return (
      <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
        <strong>📍 Location on — watching for home</strong>
        <p style={{ margin: '6px 0 10px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {session.etaHm
            ? `ETA ${formatHm12(session.etaHm)}. `
            : ''}
          When you enter your home zone, we register arrival and <strong>turn tracking off</strong>.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={async () => {
              setErr(null);
              try {
                setSession(await registerHomeManual(iso));
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            I&apos;m home now
          </Button>
          <Button
            variant="ghost"
            onClick={async () => setSession(await turnLocationTrackingOff(iso, 'manual'))}
          >
            Stop tracking
          </Button>
        </div>
        {err && (
          <p style={{ color: 'tomato', fontSize: 'var(--text-sm)', marginTop: 8 }}>{err}</p>
        )}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 8 }}>
          {cap.note}
        </p>
      </Card>
    );
  }

  // Asking / idle in window
  if (!inWindow && session.phase !== 'asking') return null;

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      <strong>🏠 Heading home?</strong>
      <p style={{ margin: '6px 0 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        Arrival window — we can turn <strong>app location tracking on</strong> until you&apos;re home,
        then off automatically. (Phone system Location still needs to be allowed once.)
      </p>

      {!config.home && (
        <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>
          Set your home pin first →{' '}
          <Link to="/home-arrival">Home arrival settings</Link>
        </p>
      )}

      {!pickingEta ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="primary"
            disabled={!config.home}
            onClick={async () => {
              setErr(null);
              try {
                setSession(await turnLocationTrackingOn(iso, 'near_home'));
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            Yes — I&apos;m near home (track now)
          </Button>
          <Button variant="secondary" disabled={!config.home} onClick={() => setPickingEta(true)}>
            When will you arrive?
          </Button>
          <Button
            variant="ghost"
            onClick={async () => setSession(await turnLocationTrackingOff(iso, 'skip'))}
          >
            Not today / skip
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              setErr(null);
              try {
                setSession(await registerHomeManual(iso));
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Failed');
              }
            }}
          >
            Already home
          </Button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>Pick ETA — tracking starts now</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ETA_OPTIONS.map((hm) => (
              <Button
                key={hm}
                variant="secondary"
                onClick={async () => {
                  setErr(null);
                  try {
                    setSession(await setEta(iso, hm));
                    setPickingEta(false);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : 'Failed');
                  }
                }}
              >
                {formatHm12(hm)}
              </Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setPickingEta(false)}>
            Back
          </Button>
        </div>
      )}

      {err && (
        <p style={{ color: 'tomato', fontSize: 'var(--text-sm)', marginTop: 8 }}>{err}</p>
      )}
    </Card>
  );
}
