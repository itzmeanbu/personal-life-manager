import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  collegeCategoriesRepo,
  collegeActivitiesRepo,
  collegeDayStatusesRepo,
} from '../data/repository';
import type { CollegeCategory, CollegeDayStatus } from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  seedCollegeCategoriesIfNeeded,
  getBunkArrivalTimes,
  setBunkArrivalTimes,
  getNormalHomeArrival,
  setNormalHomeArrival,
  DEFAULT_BUNK_ARRIVAL_TIMES,
} from '../college/defaults';
import { totalsByCategory, periodLabel, formatArrivalTime, type Period } from '../college/stats';
import '../college/college.css';

type View = 'today' | 'stats' | 'categories' | 'settings';

export default function College() {
  const [view, setView] = useState<View>('today');
  const [seeded, setSeeded] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [busy, setBusy] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [bunkTimes, setBunkTimes] = useState<string[]>(DEFAULT_BUNK_ARRIVAL_TIMES);
  const [normalHome, setNormalHome] = useState('19:15');
  const [newTimeInput, setNewTimeInput] = useState('');

  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    seedCollegeCategoriesIfNeeded().then(() => setSeeded(true));
    getBunkArrivalTimes().then(setBunkTimes);
    getNormalHomeArrival().then(setNormalHome);
  }, []);

  const categories = useLiveQuery(
    () => collegeCategoriesRepo.list().then((rows) => rows.sort((a, b) => a.order - b.order)),
    [seeded]
  );

  const activities = useLiveQuery(() => collegeActivitiesRepo.list(), [seeded]);

  const dayStatuses = useLiveQuery(() => collegeDayStatusesRepo.list(), [seeded]);

  const todayStatus = useMemo(() => {
    if (!dayStatuses) return undefined;
    return dayStatuses.find((d) => d.date === todayIso && !d.deleted);
  }, [dayStatuses, todayIso]);

  const enabledCategories = useMemo(
    () => (categories ?? []).filter((c) => c.enabled && !c.deleted),
    [categories]
  );

  const stats = useMemo(() => {
    if (!activities || !categories) return [];
    return totalsByCategory(activities, categories, period, new Date());
  }, [activities, categories, period]);

  const logActivity = useCallback(async (categoryId: string) => {
    setBusy(true);
    try {
      const existing = (activities ?? []).find(
        (a) => a.date === todayIso && a.categoryId === categoryId && !a.deleted
      );
      if (existing) {
        await collegeActivitiesRepo.update(existing.id, { count: (existing.count || 1) + 1 });
      } else {
        await collegeActivitiesRepo.create({
          date: todayIso,
          categoryId,
          count: 1,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [activities, todayIso]);

  const setDayStatus = useCallback(
    async (status: CollegeDayStatus['status'], homeArrivalTime?: string) => {
      setBusy(true);
      try {
        const needsArrival = status === 'bunked' || status === 'left_early';
        const patch = {
          status,
          homeArrivalTime: needsArrival ? homeArrivalTime : undefined,
          leftEarlyTime: status === 'left_early' ? homeArrivalTime : undefined,
        };
        if (todayStatus) {
          await collegeDayStatusesRepo.update(todayStatus.id, patch);
        } else {
          await collegeDayStatusesRepo.create({
            date: todayIso,
            ...patch,
          });
        }

        // Log activity category for attended / full bunk only (left_early stays "attended" path)
        const sysKey =
          status === 'attended' || status === 'left_early'
            ? 'attended'
            : status === 'bunked'
              ? 'bunked'
              : null;
        if (sysKey && categories) {
          const cat = categories.find((c) => c.systemKey === sysKey && !c.deleted);
          if (cat) {
            const already = (activities ?? []).some(
              (a) => a.date === todayIso && a.categoryId === cat.id && !a.deleted
            );
            if (!already) {
              await collegeActivitiesRepo.create({
                date: todayIso,
                categoryId: cat.id,
                count: 1,
              });
            }
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [todayStatus, todayIso, categories, activities]
  );

  const addCategory = useCallback(async () => {
    const name = newCatName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const maxOrder = (categories ?? []).reduce((m, c) => Math.max(m, c.order), -1);
      await collegeCategoriesRepo.create({
        name,
        icon: newCatIcon.trim() || undefined,
        order: maxOrder + 1,
        enabled: true,
        systemKey: null,
      });
      setNewCatName('');
      setNewCatIcon('');
    } finally {
      setBusy(false);
    }
  }, [newCatName, newCatIcon, categories]);

  const renameCategory = useCallback(async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      await collegeCategoriesRepo.update(id, { name });
      setRenameId(null);
      setRenameValue('');
    } finally {
      setBusy(false);
    }
  }, [renameValue]);

  const toggleCategory = useCallback(async (cat: CollegeCategory) => {
    setBusy(true);
    try {
      await collegeCategoriesRepo.update(cat.id, { enabled: !cat.enabled });
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    if (!confirm('Delete this category? Existing activity history stays but the category will be gone from lists.')) return;
    setBusy(true);
    try {
      await collegeCategoriesRepo.remove(id);
    } finally {
      setBusy(false);
    }
  }, []);

  const saveBunkTimes = useCallback(async (times: string[]) => {
    const cleaned = [...new Set(times.filter(Boolean))].sort();
    setBunkTimes(cleaned);
    await setBunkArrivalTimes(cleaned);
  }, []);

  const addBunkTime = useCallback(async () => {
    const t = newTimeInput.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return;
    const [h, m] = t.split(':').map(Number);
    if (h > 23 || m > 59) return;
    const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    await saveBunkTimes([...bunkTimes, normalized]);
    setNewTimeInput('');
  }, [newTimeInput, bunkTimes, saveBunkTimes]);

  const removeBunkTime = useCallback(
    async (t: string) => {
      await saveBunkTimes(bunkTimes.filter((x) => x !== t));
    },
    [bunkTimes, saveBunkTimes]
  );

  const saveNormalHome = useCallback(async () => {
    await setNormalHomeArrival(normalHome);
  }, [normalHome]);

  function renderTabs() {
    const tabs: { id: View; label: string }[] = [
      { id: 'today', label: 'Today' },
      { id: 'stats', label: 'Stats' },
      { id: 'categories', label: 'Categories' },
      { id: 'settings', label: 'Bunk times' },
    ];
    return (
      <div className="college-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`college-tab ${view === t.id ? 'college-tab--active' : ''}`}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  function renderToday() {
    const status = todayStatus?.status ?? 'none';
    return (
      <>
        <SectionHeader title="Today's status" />
        <Card className="college-status-card">
          <div className="college-status-row">
            <Button
              variant={status === 'attended' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => setDayStatus('attended')}
            >
              🎓 Attended
            </Button>
            <Button
              variant={status === 'left_early' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => {
                setDayStatus('left_early', bunkTimes[0] ?? '16:30');
              }}
            >
              🚪 Left early
            </Button>
            <Button
              variant={status === 'bunked' ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => {
                setDayStatus('bunked', bunkTimes[0] ?? '16:30');
              }}
            >
              🏃 Bunked
            </Button>
            {status !== 'none' && (
              <Button variant="ghost" disabled={busy} onClick={() => setDayStatus('none')}>
                Clear
              </Button>
            )}
          </div>

          {(status === 'bunked' || status === 'left_early') && (
            <div className="college-bunk-panel">
              <p className="college-hint">
                Morning routines stay normal. Pick when free time starts (home / leave campus):
              </p>
              <div className="college-time-chips">
                {bunkTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`college-chip ${todayStatus?.homeArrivalTime === t ? 'college-chip--active' : ''}`}
                    disabled={busy}
                    onClick={() => setDayStatus(status === 'left_early' ? 'left_early' : 'bunked', t)}
                  >
                    {formatArrivalTime(t)}
                  </button>
                ))}
              </div>
              {todayStatus?.homeArrivalTime && (
                <p className="college-arrival-note">
                  Free time from <strong>{formatArrivalTime(todayStatus.homeArrivalTime)}</strong>{' '}
                  until your next fixed routine (~{formatArrivalTime(normalHome)}).
                  Spin will open automatically when the window is active.
                </p>
              )}
            </div>
          )}

          {status === 'attended' && (
            <p className="college-arrival-note">
              Full day: home around {formatArrivalTime(normalHome)}. You can switch to Left early
              later if you leave campus early.
            </p>
          )}
        </Card>

        <SectionHeader title="Log activity" />
        {enabledCategories.length === 0 ? (
          <EmptyState
            icon="📂"
            title="No categories yet"
            description="Add categories under the Categories tab, then log them here."
          />
        ) : (
          <div className="college-log-grid">
            {enabledCategories.map((cat) => {
              const todayCount =
                (activities ?? [])
                  .filter((a) => a.date === todayIso && a.categoryId === cat.id && !a.deleted)
                  .reduce((s, a) => s + (a.count || 1), 0) || 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className="college-log-tile"
                  disabled={busy}
                  onClick={() => logActivity(cat.id)}
                >
                  <span className="college-log-tile__icon">{cat.icon ?? '•'}</span>
                  <span className="college-log-tile__name">{cat.name}</span>
                  {todayCount > 0 && (
                    <span className="college-log-tile__count">×{todayCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  }

  function renderStats() {
    const hasAny = stats.some((s) => s.total > 0);
    return (
      <>
        <SectionHeader title="Historical statistics" />
        <div className="college-period-row">
          {(['day', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`college-chip ${period === p ? 'college-chip--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'day' ? 'Today' : p === 'month' ? 'This month' : 'This year'}
            </button>
          ))}
        </div>
        <p className="college-hint">{periodLabel(period)}</p>
        {!hasAny ? (
          <EmptyState
            icon="📊"
            title="No logs yet"
            description="Stats only show real activity you logged. Nothing is invented."
          />
        ) : (
          <Card style={{ padding: 0 }}>
            {stats
              .filter((s) => s.total > 0)
              .map((s, i, arr) => (
                <div
                  key={s.categoryId}
                  className="college-stat-row"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <span className="college-stat-row__icon">{s.icon ?? '•'}</span>
                  <span className="college-stat-row__name">{s.name}</span>
                  <span className="college-stat-row__total">
                    {s.total} {s.total === 1 ? 'time' : 'times'}
                  </span>
                </div>
              ))}
          </Card>
        )}
      </>
    );
  }

  function renderCategories() {
    const list = categories ?? [];
    return (
      <>
        <SectionHeader title="Manage categories" />
        <Card>
          <div className="college-add-row">
            <input
              className="college-input college-input--icon"
              placeholder="😀"
              value={newCatIcon}
              onChange={(e) => setNewCatIcon(e.target.value)}
              maxLength={4}
            />
            <input
              className="college-input"
              placeholder="New category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button variant="secondary" disabled={busy || !newCatName.trim()} onClick={addCategory}>
              Add
            </Button>
          </div>
        </Card>

        {list.length === 0 ? (
          <EmptyState icon="📂" title="No categories" description="Add one above." />
        ) : (
          <Card style={{ padding: 0 }}>
            {list.map((cat, i) => (
              <div
                key={cat.id}
                className="college-cat-row"
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                  opacity: cat.enabled ? 1 : 0.5,
                }}
              >
                {renameId === cat.id ? (
                  <div className="college-rename-row">
                    <input
                      className="college-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && renameCategory(cat.id)}
                    />
                    <Button variant="primary" disabled={busy} onClick={() => renameCategory(cat.id)}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setRenameId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="college-cat-row__icon">{cat.icon ?? '•'}</span>
                    <span className="college-cat-row__name">
                      {cat.name}
                      {cat.systemKey && <span className="college-badge">system</span>}
                    </span>
                    <div className="college-cat-row__actions">
                      <button
                        type="button"
                        className="college-link"
                        onClick={() => {
                          setRenameId(cat.id);
                          setRenameValue(cat.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="college-link"
                        onClick={() => toggleCategory(cat)}
                      >
                        {cat.enabled ? 'Disable' : 'Enable'}
                      </button>
                      {!cat.systemKey && (
                        <button
                          type="button"
                          className="college-link college-link--danger"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <SectionHeader title="Bunk day home-arrival times" />
        <Card>
          <p className="college-hint">
            When you mark <strong>Bunked today</strong>, these early arrival options appear.
            Normal college day still ends around {formatArrivalTime(normalHome)} — that template
            is never destroyed.
          </p>
          <div className="college-time-chips" style={{ marginTop: 12 }}>
            {bunkTimes.map((t) => (
              <span key={t} className="college-chip college-chip--removable">
                {formatArrivalTime(t)}
                <button type="button" aria-label="Remove" onClick={() => removeBunkTime(t)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="college-add-row" style={{ marginTop: 12 }}>
            <input
              className="college-input"
              placeholder="HH:mm e.g. 16:30"
              value={newTimeInput}
              onChange={(e) => setNewTimeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBunkTime()}
            />
            <Button variant="secondary" onClick={addBunkTime}>
              Add time
            </Button>
          </div>
        </Card>

        <SectionHeader title="Normal home arrival" />
        <Card>
          <div className="college-add-row">
            <input
              className="college-input"
              value={normalHome}
              onChange={(e) => setNormalHome(e.target.value)}
              placeholder="19:15"
            />
            <Button variant="secondary" onClick={saveNormalHome}>
              Save
            </Button>
          </div>
          <p className="college-hint" style={{ marginTop: 8 }}>
            Used only as a reference for normal college days (≈ 7:00–7:30 PM).
          </p>
        </Card>
      </>
    );
  }

  return (
    <PageShell title="College">
      {renderTabs()}
      {view === 'today' && renderToday()}
      {view === 'stats' && renderStats()}
      {view === 'categories' && renderCategories()}
      {view === 'settings' && renderSettings()}
    </PageShell>
  );
}
