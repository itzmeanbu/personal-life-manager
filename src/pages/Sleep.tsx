import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { sleepRecordsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import {
  getSleepConfig,
  setSleepConfig,
  type SleepConfig,
  DEFAULT_SLEEP_CONFIG,
} from '../sleep/settings';
import {
  classifyAdherence,
  computeSleepStats,
  formatAdherence,
} from '../sleep/stats';
import '../sleep/sleep.css';

type Tab = 'log' | 'week' | 'month' | 'stats' | 'settings';

export default function Sleep() {
  const [tab, setTab] = useState<Tab>('log');
  const [config, setConfig] = useState<SleepConfig>(DEFAULT_SLEEP_CONFIG);
  const [busy, setBusy] = useState(false);
  const [bedtime, setBedtime] = useState('22:00');
  const [wake, setWake] = useState('');
  const [quality, setQuality] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    getSleepConfig().then((c) => {
      setConfig(c);
      setBedtime(c.targetBedtime);
    });
  }, []);

  const records = useLiveQuery(() => sleepRecordsRepo.list(), []);
  const stats = useMemo(
    () => computeSleepStats(records ?? [], config),
    [records, config]
  );

  const logNight = useCallback(async () => {
    if (!bedtime.trim()) return;
    setBusy(true);
    try {
      const adherence = classifyAdherence(bedtime.trim(), config);
      let durationMinutes: number | undefined;
      if (wake.trim() && /^\d{1,2}:\d{2}$/.test(wake.trim())) {
        const [bh, bm] = bedtime.split(':').map(Number);
        const [wh, wm] = wake.split(':').map(Number);
        let mins = wh * 60 + wm - (bh * 60 + bm);
        if (mins <= 0) mins += 24 * 60;
        durationMinutes = mins;
      }
      await sleepRecordsRepo.create({
        date: todayIso,
        bedtimeHm: bedtime.trim(),
        wakeHm: wake.trim() || undefined,
        durationMinutes,
        quality: quality === '' ? undefined : (quality as 1 | 2 | 3 | 4 | 5),
        notes: notes.trim() || undefined,
        adherence,
      });
      setNotes('');
    } finally {
      setBusy(false);
    }
  }, [bedtime, wake, quality, notes, config, todayIso]);

  const saveConfig = async (patch: Partial<SleepConfig>) => {
    const next = await setSleepConfig(patch);
    setConfig(next);
  };

  function tabs() {
    const items: { id: Tab; label: string }[] = [
      { id: 'log', label: 'Log' },
      { id: 'week', label: 'Week' },
      { id: 'month', label: 'Month' },
      { id: 'stats', label: 'Stats' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="sl-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sl-tab ${tab === t.id ? 'sl-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  function renderList(list: typeof stats.allRecords, empty: string) {
    if (list.length === 0) {
      return <EmptyState icon="😴" title="No nights logged" description={empty} />;
    }
    return (
      <Card style={{ padding: 0 }}>
        {list.map((r, i) => (
          <div
            key={r.id}
            className="sl-row"
            style={{
              borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {r.date} · {r.bedtimeHm ?? '—'}
                {r.wakeHm ? ` → ${r.wakeHm}` : ''}
              </div>
              <div className="sl-muted">
                {r.durationMinutes != null ? `${Math.round(r.durationMinutes / 60 * 10) / 10}h sleep` : ''}
                {r.quality ? ` · Q${r.quality}` : ''}
                {r.notes ? ` · ${r.notes}` : ''}
              </div>
            </div>
            <span className={`sl-badge sl-badge--${r.adherence ?? 'unknown'}`}>
              {formatAdherence(r.adherence)}
            </span>
          </div>
        ))}
      </Card>
    );
  }

  if (!config.enabled && tab === 'log') {
    return (
      <PageShell title="Sleep">
        {tabs()}
        <EmptyState
          icon="😴"
          title="Sleep tracking disabled"
          description="Enable it under Settings."
          action={
            <Button variant="secondary" onClick={() => setTab('settings')}>
              Settings
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Sleep">
      {tabs()}

      {tab === 'log' && (
        <>
          <Card>
            <strong>Log bedtime</strong>
            <p className="sl-muted">
              Target {config.targetBedtime} (±{config.toleranceMinutes} min). Secondary soft
              target {config.secondaryTargetBedtime}. Nothing about “% late nights” is fixed in
              code — only your target and tolerance.
            </p>
            <div className="sl-field">
              <label>Bedtime (HH:mm)</label>
              <input
                className="sl-input"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                placeholder="22:00"
              />
            </div>
            <div className="sl-field">
              <label>Wake time optional (HH:mm)</label>
              <input
                className="sl-input"
                value={wake}
                onChange={(e) => setWake(e.target.value)}
                placeholder="06:00"
              />
            </div>
            <div className="sl-field">
              <label>Quality 1–5 (optional)</label>
              <input
                className="sl-input"
                type="number"
                min={1}
                max={5}
                value={quality}
                onChange={(e) =>
                  setQuality(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>
            <div className="sl-field">
              <label>Notes</label>
              <input className="sl-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="sl-actions">
              <Button variant="primary" disabled={busy || !bedtime.trim()} onClick={logNight}>
                Save night
              </Button>
            </div>
          </Card>
        </>
      )}

      {tab === 'week' && (
        <>
          <SectionHeader title="This week" />
          {renderList(stats.weekRecords, 'Log bedtimes to build weekly history.')}
        </>
      )}

      {tab === 'month' && (
        <>
          <SectionHeader title="This month" />
          {renderList(stats.monthRecords, 'Log bedtimes to build monthly history.')}
        </>
      )}

      {tab === 'stats' && (
        <>
          <SectionHeader title="Statistics" />
          <div className="sl-stat-grid">
            <div className="sl-stat">
              <div className="sl-stat__value">{stats.averageBedtimeHm ?? '—'}</div>
              <div className="sl-stat__label">Average bedtime</div>
            </div>
            <div className="sl-stat">
              <div className="sl-stat__value">
                {stats.adherenceRate == null
                  ? '—'
                  : `${Math.round(stats.adherenceRate * 100)}%`}
              </div>
              <div className="sl-stat__label">Target adherence</div>
            </div>
            <div className="sl-stat">
              <div className="sl-stat__value">{stats.onTimeDays}</div>
              <div className="sl-stat__label">On-time days</div>
            </div>
            <div className="sl-stat">
              <div className="sl-stat__value">{stats.lateDays}</div>
              <div className="sl-stat__label">Late days</div>
            </div>
            <div className="sl-stat">
              <div className="sl-stat__value">{stats.earlyDays}</div>
              <div className="sl-stat__label">Early days</div>
            </div>
            <div className="sl-stat">
              <div className="sl-stat__value">{stats.loggedNights}</div>
              <div className="sl-stat__label">Nights logged</div>
            </div>
          </div>
          <p className="sl-muted">
            Adherence = on-time nights ÷ logged nights from real data only. No invented late-night
            percentage target.
          </p>
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Sleep settings" />
          <Card>
            <label className="sl-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => saveConfig({ enabled: e.target.checked })}
              />
              Enabled
            </label>
            <div className="sl-field">
              <label>Target bedtime (HH:mm)</label>
              <input
                className="sl-input"
                value={config.targetBedtime}
                onChange={(e) => saveConfig({ targetBedtime: e.target.value })}
              />
            </div>
            <div className="sl-field">
              <label>Secondary soft target (HH:mm)</label>
              <input
                className="sl-input"
                value={config.secondaryTargetBedtime}
                onChange={(e) => saveConfig({ secondaryTargetBedtime: e.target.value })}
              />
            </div>
            <div className="sl-field">
              <label>Tolerance (minutes after target still on-time)</label>
              <input
                className="sl-input"
                type="number"
                min={0}
                max={180}
                value={config.toleranceMinutes}
                onChange={(e) => saveConfig({ toleranceMinutes: Number(e.target.value) })}
              />
            </div>
            <label className="sl-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.reminderEnabled}
                onChange={(e) => saveConfig({ reminderEnabled: e.target.checked })}
              />
              Reminder enabled
            </label>
            <div className="sl-field">
              <label>Reminder time (HH:mm)</label>
              <input
                className="sl-input"
                value={config.reminderTime}
                onChange={(e) => saveConfig({ reminderTime: e.target.value })}
              />
            </div>
          </Card>
        </>
      )}
    </PageShell>
  );
}
