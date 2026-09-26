import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { guitarSessionsRepo } from '../data/repository';
import type { GuitarSession } from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  getGuitarConfig,
  setGuitarConfig,
  type GuitarConfig,
  DEFAULT_GUITAR_CONFIG,
} from '../guitar/settings';
import { computeGuitarTotals, formatMinutes } from '../guitar/stats';
import '../guitar/guitar.css';

type Tab = 'today' | 'history' | 'stats' | 'settings';

export default function Guitar() {
  const [tab, setTab] = useState<Tab>('today');
  const [config, setConfig] = useState<GuitarConfig>(DEFAULT_GUITAR_CONFIG);
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(60);
  const [focus, setFocus] = useState('');
  const [song, setSong] = useState('');
  const [notes, setNotes] = useState('');

  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    getGuitarConfig().then((c) => {
      setConfig(c);
      setDuration(c.defaultDurationMinutes);
    });
  }, []);

  const sessions = useLiveQuery(() => guitarSessionsRepo.list(), []);
  const totals = useMemo(() => computeGuitarTotals(sessions ?? []), [sessions]);
  const todaySessions = useMemo(
    () => (sessions ?? []).filter((s) => s.date === todayIso && !s.deleted),
    [sessions, todayIso]
  );

  const logSession = useCallback(
    async (status: GuitarSession['status']) => {
      setBusy(true);
      try {
        await guitarSessionsRepo.create({
          date: todayIso,
          durationMinutes: status === 'skipped' ? 0 : duration,
          status,
          focus: focus.trim() || undefined,
          songOrPiece: song.trim() || undefined,
          notes: notes.trim() || undefined,
          targetMinutes: config.defaultDurationMinutes,
        });
        setNotes('');
      } finally {
        setBusy(false);
      }
    },
    [todayIso, duration, focus, song, notes, config.defaultDurationMinutes]
  );

  const saveConfig = async (patch: Partial<GuitarConfig>) => {
    const next = await setGuitarConfig(patch);
    setConfig(next);
    if (patch.defaultDurationMinutes != null) setDuration(patch.defaultDurationMinutes);
  };

  function tabs() {
    const items: { id: Tab; label: string }[] = [
      { id: 'today', label: 'Today' },
      { id: 'history', label: 'History' },
      { id: 'stats', label: 'Totals' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="gt-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`gt-tab ${tab === t.id ? 'gt-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  if (!config.enabled && tab === 'today') {
    return (
      <PageShell title="Guitar">
        {tabs()}
        <EmptyState
          icon="🎸"
          title="Guitar tracking disabled"
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
    <PageShell title="Guitar">
      {tabs()}

      {tab === 'today' && (
        <>
          <Card>
            <strong>Practice session</strong>
            <p className="gt-muted">
              Default target: {config.defaultDurationMinutes} min (editable in Settings)
            </p>
            <div className="gt-field">
              <label>Duration (minutes)</label>
              <input
                className="gt-input"
                type="number"
                min={1}
                max={300}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
            <div className="gt-field">
              <label>Focus</label>
              <input
                className="gt-input"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="scales, song, technique…"
              />
              <div className="gt-chips">
                {config.focusPresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`gt-chip ${focus === p ? 'gt-chip--on' : ''}`}
                    onClick={() => setFocus(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="gt-field">
              <label>Song / piece</label>
              <input className="gt-input" value={song} onChange={(e) => setSong(e.target.value)} />
            </div>
            <div className="gt-field">
              <label>Notes</label>
              <input className="gt-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="gt-actions">
              <Button variant="primary" disabled={busy} onClick={() => logSession('completed')}>
                Completed
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => logSession('partial')}
              >
                Partial
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => logSession('skipped')}>
                Skipped
              </Button>
            </div>
          </Card>

          <SectionHeader title="Today" />
          {todaySessions.length === 0 ? (
            <EmptyState icon="🎸" title="Nothing logged today" description="Log a session above." />
          ) : (
            <Card style={{ padding: 0 }}>
              {todaySessions.map((s, i) => (
                <div
                  key={s.id}
                  className="gt-row"
                  style={{
                    borderBottom:
                      i < todaySessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.status === 'skipped' ? 'Skipped' : formatMinutes(s.durationMinutes)}
                      {s.focus ? ` · ${s.focus}` : ''}
                    </div>
                    <div className="gt-muted">
                      {s.status}
                      {s.songOrPiece ? ` · ${s.songOrPiece}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <SectionHeader title="Daily history" />
          {totals.sessions.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No sessions yet"
              description="History only shows practice you logged."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {totals.sessions.map((s, i) => (
                <div
                  key={s.id}
                  className="gt-row"
                  style={{
                    borderBottom:
                      i < totals.sessions.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.date} ·{' '}
                      {s.status === 'skipped' ? 'Skipped' : formatMinutes(s.durationMinutes)}
                    </div>
                    <div className="gt-muted">
                      {s.status}
                      {s.focus ? ` · ${s.focus}` : ''}
                      {s.songOrPiece ? ` · ${s.songOrPiece}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'stats' && (
        <>
          <SectionHeader title="Totals" />
          <div className="gt-stat-grid">
            <div className="gt-stat">
              <div className="gt-stat__value">{formatMinutes(totals.todayMinutes)}</div>
              <div className="gt-stat__label">Today</div>
            </div>
            <div className="gt-stat">
              <div className="gt-stat__value">{formatMinutes(totals.weekMinutes)}</div>
              <div className="gt-stat__label">This week</div>
            </div>
            <div className="gt-stat">
              <div className="gt-stat__value">{formatMinutes(totals.monthMinutes)}</div>
              <div className="gt-stat__label">This month</div>
            </div>
            <div className="gt-stat">
              <div className="gt-stat__value">{formatMinutes(totals.lifetimeMinutes)}</div>
              <div className="gt-stat__label">Lifetime</div>
            </div>
            <div className="gt-stat">
              <div className="gt-stat__value">{totals.completedCount}</div>
              <div className="gt-stat__label">Completed sessions</div>
            </div>
            <div className="gt-stat">
              <div className="gt-stat__value">{totals.skippedCount}</div>
              <div className="gt-stat__label">Skipped</div>
            </div>
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Guitar settings" />
          <Card>
            <label className="gt-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => saveConfig({ enabled: e.target.checked })}
              />
              Enabled
            </label>
            <div className="gt-field">
              <label>Default session duration (minutes)</label>
              <input
                className="gt-input"
                type="number"
                min={5}
                max={300}
                value={config.defaultDurationMinutes}
                onChange={(e) => saveConfig({ defaultDurationMinutes: Number(e.target.value) })}
              />
            </div>
            <label className="gt-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={config.reminderEnabled}
                onChange={(e) => saveConfig({ reminderEnabled: e.target.checked })}
              />
              Reminder enabled
            </label>
            <div className="gt-field">
              <label>Reminder time (HH:mm)</label>
              <input
                className="gt-input"
                value={config.reminderTime}
                onChange={(e) => saveConfig({ reminderTime: e.target.value })}
              />
            </div>
            <div className="gt-field">
              <label>Focus presets (comma-separated)</label>
              <input
                className="gt-input"
                value={config.focusPresets.join(', ')}
                onChange={(e) =>
                  saveConfig({
                    focusPresets: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </Card>
        </>
      )}
    </PageShell>
  );
}
