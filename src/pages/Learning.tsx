import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { learningSessionsRepo } from '../data/repository';
import type { LearningSession } from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  getLearningConfig,
  setLearningConfig,
  type LearningConfig,
  DEFAULT_LEARNING_CONFIG,
} from '../learning/settings';
import { computeLearningTotals, formatMinutes } from '../learning/stats';
import '../learning/learning.css';

type Tab = 'log' | 'history' | 'totals' | 'settings';

export default function Learning() {
  const [tab, setTab] = useState<Tab>('log');
  const [config, setConfig] = useState<LearningConfig>(DEFAULT_LEARNING_CONFIG);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('Frontend');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');

  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    getLearningConfig().then((c) => {
      setConfig(c);
      setDuration(c.defaultDurationMinutes);
      if (c.categories[0]) setCategory(c.categories[0]);
    });
  }, []);

  const sessions = useLiveQuery(() => learningSessionsRepo.list(), []);
  const totals = useMemo(() => computeLearningTotals(sessions ?? []), [sessions]);
  const today = useMemo(
    () => (sessions ?? []).filter((s) => s.date === todayIso && !s.deleted),
    [sessions, todayIso]
  );

  const log = async (status: LearningSession['status']) => {
    setBusy(true);
    try {
      await learningSessionsRepo.create({
        date: todayIso,
        category,
        topic: topic.trim() || category,
        durationMinutes: status === 'skipped' ? 0 : duration,
        status,
        notes: notes.trim() || undefined,
        goal: config.mainGoal,
      });
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async (patch: Partial<LearningConfig>) => {
    const next = await setLearningConfig(patch);
    setConfig(next);
  };

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'log', label: 'Log' },
      { id: 'history', label: 'History' },
      { id: 'totals', label: 'Totals' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="ln-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ln-tab ${tab === t.id ? 'ln-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Learning">
      {tabsBar()}
      <p className="ln-muted" style={{ marginBottom: 12 }}>
        Goal: <strong>{config.mainGoal}</strong> · Weekend Spin can land on Full-stack learning
        (nested wheels).{' '}
        <Link to="/spin">Open Spin</Link>
      </p>

      {tab === 'log' && (
        <>
          <Card>
            <strong>Session</strong>
            <div className="ln-field">
              <label>Category</label>
              <input
                className="ln-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <div className="ln-chips">
                {config.categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ln-chip ${category === c ? 'ln-chip--on' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="ln-field">
              <label>Topic</label>
              <input
                className="ln-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Express routes"
              />
            </div>
            <div className="ln-field">
              <label>Duration (minutes)</label>
              <input
                className="ln-input"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
            <div className="ln-field">
              <label>Notes</label>
              <input className="ln-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="ln-actions">
              <Button variant="primary" disabled={busy} onClick={() => log('completed')}>
                Completed
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => log('partial')}>
                Partial
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => log('skipped')}>
                Skipped
              </Button>
            </div>
          </Card>
          <SectionHeader title="Today" />
          {today.length === 0 ? (
            <EmptyState icon="📚" title="No sessions today" description="Log full-stack work above." />
          ) : (
            <Card style={{ padding: 0 }}>
              {today.map((s, i) => (
                <div
                  key={s.id}
                  className="ln-row"
                  style={{
                    borderBottom: i < today.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.category} · {s.topic}
                    </div>
                    <div className="ln-muted">
                      {s.status}
                      {s.status !== 'skipped' ? ` · ${formatMinutes(s.durationMinutes)}` : ''}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ln-link"
                    onClick={() => learningSessionsRepo.remove(s.id, true)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <SectionHeader title="Daily history" />
          {totals.history.length === 0 ? (
            <EmptyState icon="📜" title="No history" description="Only sessions you log appear here." />
          ) : (
            <Card style={{ padding: 0 }}>
              {totals.history.map((s, i) => (
                <div
                  key={s.id}
                  className="ln-row"
                  style={{
                    borderBottom:
                      i < totals.history.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.date} · {s.category} · {s.topic}
                    </div>
                    <div className="ln-muted">
                      {s.status}
                      {s.status !== 'skipped' ? ` · ${formatMinutes(s.durationMinutes)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'totals' && (
        <div className="ln-stat-grid">
          <div className="ln-stat">
            <div className="ln-stat__value">{formatMinutes(totals.todayMin)}</div>
            <div className="ln-stat__label">Today</div>
          </div>
          <div className="ln-stat">
            <div className="ln-stat__value">{formatMinutes(totals.weekMin)}</div>
            <div className="ln-stat__label">This week</div>
          </div>
          <div className="ln-stat">
            <div className="ln-stat__value">{formatMinutes(totals.monthMin)}</div>
            <div className="ln-stat__label">This month</div>
          </div>
          <div className="ln-stat">
            <div className="ln-stat__value">{formatMinutes(totals.lifeMin)}</div>
            <div className="ln-stat__label">Lifetime</div>
          </div>
          <div className="ln-stat">
            <div className="ln-stat__value">{totals.completed}</div>
            <div className="ln-stat__label">Completed</div>
          </div>
          <div className="ln-stat">
            <div className="ln-stat__value">{totals.skipped}</div>
            <div className="ln-stat__label">Skipped</div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <Card>
          <div className="ln-field">
            <label>Main learning goal</label>
            <input
              className="ln-input"
              value={config.mainGoal}
              onChange={(e) => saveConfig({ mainGoal: e.target.value })}
            />
          </div>
          <div className="ln-field">
            <label>Default duration (minutes)</label>
            <input
              className="ln-input"
              type="number"
              value={config.defaultDurationMinutes}
              onChange={(e) => saveConfig({ defaultDurationMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="ln-field">
            <label>Categories (comma-separated)</label>
            <input
              className="ln-input"
              value={config.categories.join(', ')}
              onChange={(e) =>
                saveConfig({
                  categories: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </Card>
      )}
    </PageShell>
  );
}
