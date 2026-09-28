import { useEffect, useState } from 'react';
import { getDemoDate, subscribeDemoDay, isDemoTimeActive } from '../demo/DemoTools';

/**
 * App "now" — always follows DEMO clock when set, otherwise real time.
 */
export function useNow(_base?: Date, everyMs = 15_000): Date {
  const [now, setNow] = useState(() => getDemoDate());

  useEffect(() => {
    const refresh = () => setNow(getDemoDate());
    refresh();
    const unsub = subscribeDemoDay(refresh);
    const id = window.setInterval(refresh, everyMs);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [everyMs]);

  return now;
}

export function useDemoClockActive(): boolean {
  const [active, setActive] = useState(() => isDemoTimeActive());
  useEffect(() => {
    return subscribeDemoDay(() => setActive(isDemoTimeActive()));
  }, []);
  return active;
}
