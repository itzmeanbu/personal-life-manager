/**
 * Countdown timer for spun options.
 * Reports real elapsed minutes on complete (not a fake receipt).
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { registerForceCompleteTimer } from '../demo/DemoTools';

interface Props {
  durationMinutes: number;
  label: string;
  /** actual elapsed minutes when session ends */
  onComplete?: (actualMinutes: number) => void;
}

export function SpinTimer({ durationMinutes, label, onComplete }: Props) {
  const totalSec = Math.max(1, Math.round(durationMinutes * 60));
  const [remaining, setRemaining] = useState(totalSec);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    setRemaining(0);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const actualMin = Math.max(
      1,
      Math.round((Date.now() - startedAtRef.current) / 60000)
    );
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer done', { body: `${label} · ${actualMin} min` });
      }
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => {
          osc.stop();
          void ctx.close();
        }, 300);
      }
    } catch {
      /* ignore */
    }
    onComplete?.(actualMin);
  }, [done, label, onComplete]);

  useEffect(() => {
    // DEMO "complete timer" = log the full planned block (not a short skip)
    registerForceCompleteTimer(() => {
      setDone(true);
      setRemaining(0);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      onComplete?.(durationMinutes);
    });
    return () => registerForceCompleteTimer(null);
  }, [durationMinutes, onComplete]);

  useEffect(() => {
    if (paused || done) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [paused, done, finish]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const pct = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 100;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        background: 'var(--color-surface-2, var(--color-surface))',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {done ? '✓ Session recorded' : '⏱ Live timer'}
      </div>
      <div style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--color-border)',
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--color-accent)',
            transition: 'width 0.3s linear',
          }}
        />
      </div>
      {!done && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" onClick={finish}>
            Finish now (save real time)
          </Button>
        </div>
      )}
    </div>
  );
}
