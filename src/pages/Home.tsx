/**
 * Day Journey — sequential phase engine (one phase at a time).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useToday } from '../hooks/useToday';
import { SequentialPhaseView } from '../day/SequentialPhaseView';
import { getWakeTime } from '../day/spendPrompts';
import { toIsoDate } from '../routine/engine';
import { AppLogo } from '../appearance/AppLogo';
import { WAKE_LOGGED_EVENT } from '../day/wakeGate';
import { useNow } from '../hooks/useNow';
import { formatHm12 } from '../lib/timeFormat';
import { minToHm } from '../day/timeline';
import '../day/day.css';
import '../day/timeline.css';

export default function Home() {
  const today = useToday();
  const now = useNow(today.date);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const iso = toIsoDate(today.date);
  const [wakeMin, setWakeMin] = useState<number | null>(null);

  const loadWake = useCallback(() => {
    void getWakeTime(iso).then((w) => {
      if (!w) {
        setWakeMin(null);
        return;
      }
      const d = new Date(w.at);
      setWakeMin(d.getHours() * 60 + d.getMinutes());
    });
  }, [iso]);

  useEffect(() => {
    loadWake();
    const onWake = () => loadWake();
    window.addEventListener(WAKE_LOGGED_EVENT, onWake);
    return () => window.removeEventListener(WAKE_LOGGED_EVENT, onWake);
  }, [loadWake]);

  return (
    <div className="page-shell day-journey">
      <header
        className="page-shell__header"
        style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <AppLogo size={32} />
          <div style={{ flex: 1 }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              {today.greeting}
            </span>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                marginTop: 2,
              }}
            >
              {today.dayName}
              {today.isWeekend ? ' · Weekend (no college day order)' : ''}
              {wakeMin != null ? ` · up since ${formatHm12(minToHm(wakeMin))}` : ''}
            </div>
          </div>
        </div>
        <h1 className="page-shell__title" style={{ fontSize: 'var(--text-2xl)', marginTop: 8 }}>
          Today
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          One phase at a time — complete it, it disappears, next appears.
        </p>
      </header>

      <div className="page-shell__content">
        <SequentialPhaseView date={today.date} wakeMin={wakeMin} nowMin={nowMin} />
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/settings">
            <Button variant="ghost">Settings & modules</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
