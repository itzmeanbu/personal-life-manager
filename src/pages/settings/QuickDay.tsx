/**
 * Dead-simple day controls: wake time, bedtime target.
 * Updates the real Routine rows — no buried forms.
 */
import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { routinesRepo } from '../../data/repository';

const WAKE_OPTIONS = ['05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
const SLEEP_OPTIONS = ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '00:00'];

function matchTitle(title: string, needle: string) {
  return title.trim().toLowerCase() === needle;
}

export default function QuickDay() {
  const routines = useLiveQuery(() => routinesRepo.list(), [], []);
  const list = useMemo(() => (routines ?? []).filter((r) => !r.deleted), [routines]);
  const wake = list.find((r) => matchTitle(r.title, 'wake up'));
  const sleep = list.find((r) => matchTitle(r.title, 'sleep'));
  const [status, setStatus] = useState<string | null>(null);

  const setWake = useCallback(
    async (hm: string) => {
      if (!wake) {
        setStatus('No “Wake up” routine found — add one in Routines.');
        return;
      }
      await routinesRepo.update(wake.id, { time: hm, cadence: 'daily', activeDays: [0, 1, 2, 3, 4, 5, 6] });
      setStatus(`Wake up set to ${hm} every day`);
    },
    [wake]
  );

  const setSleep = useCallback(
    async (hm: string) => {
      if (!sleep) {
        setStatus('No “Sleep” routine found — add one in Routines.');
        return;
      }
      await routinesRepo.update(sleep.id, { time: hm, cadence: 'daily', activeDays: [0, 1, 2, 3, 4, 5, 6] });
      setStatus(`Sleep target set to ${hm}`);
    },
    [sleep]
  );

  return (
    <PageShell title="Quick day setup" showBack>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 0 }}>
        One-tap times. This changes your real routines — not a separate fake setting.
      </p>

      <Card style={{ marginBottom: 16 }}>
        <strong>When do you want to wake up?</strong>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '6px 0 12px' }}>
          Current: {wake?.time ?? 'not set'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {WAKE_OPTIONS.map((hm) => (
            <Button
              key={hm}
              variant={wake?.time === hm ? 'primary' : 'secondary'}
              onClick={() => setWake(hm)}
            >
              {hm}
            </Button>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <strong>Sleep target</strong>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '6px 0 12px' }}>
          Current: {sleep?.time ?? 'not set'} · Spin sessions wind down by 21:00 so this still fits.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SLEEP_OPTIONS.map((hm) => (
            <Button
              key={hm}
              variant={sleep?.time === hm ? 'primary' : 'secondary'}
              onClick={() => setSleep(hm)}
            >
              {hm}
            </Button>
          ))}
        </div>
      </Card>

      {status && (
        <p style={{ color: 'var(--color-accent)', fontSize: 'var(--text-sm)' }}>✓ {status}</p>
      )}
    </PageShell>
  );
}
