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
import { isDemoTimeActive } from '../demo/DemoTools';
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
      <header className="page-shell__header" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <AppLogo size={28} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 'var(--text-sm)' }}>{today.greeting}</span>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {today.dayName}
              {today.isWeekend ? ' · weekend' : ''}
              {wakeMin != null ? ` · up ${formatHm12(minToHm(wakeMin))}` : ''}
              {isDemoTimeActive() ? ' · clock override' : ''}
            </div>
          </div>
        </div>
      </header>
      <div className="page-shell__content">
        <SequentialPhaseView date={today.date} wakeMin={wakeMin} nowMin={nowMin} />
        <div style={{ marginTop: 20 }}>
          <Link to="/settings">
            <Button variant="ghost">Settings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
