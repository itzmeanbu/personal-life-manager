import { useEffect, useRef, useState } from 'react';

/**
 * A ticking "now" that stays consistent with the app clock: it starts from
 * `base` (useToday's date, which the demo tools can override) and advances
 * with real time. Re-renders every `everyMs`.
 */
export function useNow(base: Date, everyMs = 30_000): Date {
  const [, setTick] = useState(0);
  const baseMs = base.getTime();
  const anchor = useRef({ base: baseMs, real: Date.now() });

  useEffect(() => {
    anchor.current = { base: baseMs, real: Date.now() };
    setTick((t) => t + 1);
  }, [baseMs]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);

  return new Date(anchor.current.base + (Date.now() - anchor.current.real));
}
