import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  spinWheelsRepo,
  spinHistoriesRepo,
  generateId,
} from '../data/repository';
import type { SpinWheel, SpinWheelOption } from '../data/types';
import { seedSpinWheelsIfNeeded } from '../spin/seed';
import { eligibleOptions, pickOption, formatAvailability } from '../spin/engine';
import { pickRandomFromWatchlist } from '../entertainment/random';
import { toIsoDate } from '../routine/engine';
import { SpinTimer } from '../spin/SpinTimer';
import { planSpinDuration, formatMinutes, DEFAULT_CUTOFF_HM } from '../spin/timeBudget';
import { formatIsoTime12 } from '../lib/timeFormat';
import { continueSuggestion } from '../entertainment/continue';
import { getDemoDate } from '../demo/DemoTools';
import { useActiveDayProfile } from '../day/hooks';
import '../spin/spin.css';

type Tab = 'spin' | 'wheels' | 'history';

export default function Spin() {
  const [tab, setTab] = useState<Tab>('spin');
  const { profile } = useActiveDayProfile(getDemoDate());
  const spinCutoff = profile?.systemKey === 'rest' || profile?.systemKey === 'sunday' ? '20:00' : profile?.systemKey === 'bunk' || profile?.systemKey === 'event' ? '19:30' : DEFAULT_CUTOFF_HM;
  const [seeded, setSeeded] = useState(false);
  const [currentWheelId, setCurrentWheelId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinWheelOption | null>(null);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [budgetNote, setBudgetNote] = useState<string | null>(null);
  const [watchlistPickLabel, setWatchlistPickLabel] = useState<string | null>(null);
  const [editWheelId, setEditWheelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    seedSpinWheelsIfNeeded().then(() => setSeeded(true));
  }, []);

  const wheels = useLiveQuery(
    () => spinWheelsRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    [seeded]
  );
  const history = useLiveQuery(
    async () => {
      const todayIso = toIsoDate(getDemoDate());
      const r = await spinHistoriesRepo.list();
      return r
        .filter((h) => !h.deleted && h.date === todayIso)
        .filter((h) => (h.actualMinutes ?? h.durationMinutes ?? 0) <= 12 * 60)
        .sort((a, b) => ((a.startedAt ?? a.createdAt) < (b.startedAt ?? b.createdAt) ? 1 : -1));
    },
    [seeded]
  );

  const roots = useMemo(
    () => (wheels ?? []).filter((w) => w.isRoot && w.enabled && !w.deleted),
    [wheels]
  );

  const currentWheel = useMemo(() => {
    if (!wheels) return null;
    if (currentWheelId) return wheels.find((w) => w.id === currentWheelId) ?? null;
    return roots[0] ?? null;
  }, [wheels, currentWheelId, roots]);

  useEffect(() => {
    if (!currentWheelId && roots[0]) {
      setCurrentWheelId(roots[0].id);
      setPath([roots[0].name]);
    }
  }, [roots, currentWheelId]);

  const sessionOpen = Boolean(activeHistoryId) || Boolean(timerMinutes && timerMinutes > 0);

  const doSpin = useCallback(async () => {
    if (!currentWheel || spinning) return;
    // Must complete current wall session before next spin
    if (activeHistoryId || (timerMinutes != null && timerMinutes > 0)) return;
    // Must resolve leaf result first (no skipping)
    if (result && !result.childWheelId) return;
    const demoNow = getDemoDate();
    const eligible = eligibleOptions(currentWheel, demoNow.getHours() * 60 + demoNow.getMinutes());
    if (eligible.length === 0) {
      setResult(null);
      return;
    }
    setSpinning(true);
    setResult(null);
    setWatchlistPickLabel(null);
    setRotation((r) => r + 1080 + Math.random() * 360);
    await new Promise((r) => setTimeout(r, 1200));
    const picked = pickOption(eligible);
    setResult(picked);
    setSpinning(false);
    if (picked) {
      await spinWheelsRepo.update(currentWheel.id, {
        lastResult: picked.label,
        lastResultOptionId: picked.id,
        lastSpunAt: new Date().toISOString(),
      });
    }
  }, [currentWheel, spinning, activeHistoryId, timerMinutes, result]);

  const acceptResult = useCallback(async () => {
    if (!result || !currentWheel) return;
    // Drill into child wheel
    if (result.childWheelId) {
      const child = (wheels ?? []).find((w) => w.id === result.childWheelId);
      if (child) {
        setCurrentWheelId(child.id);
        setPath((p) => [...p, child.name]);
        setResult(null);
        setWatchlistPickLabel(null);
        return;
      }
    }
    // Leaf — real session start; duration capped by time until evening cutoff
    setBusy(true);
    try {
      let label = result.label;
      let optionDuration = result.durationMinutes;
      const tags = result.tags ?? [];
      if (tags.includes('random_watchlist') || tags.includes('random_kdrama') || tags.includes('random_anime')) {
        const systemKey = tags.includes('random_kdrama')
          ? 'kdrama'
          : tags.includes('random_anime')
            ? 'anime'
            : undefined;
        const pick = await pickRandomFromWatchlist({ systemKey });
        if (pick) {
          label = `${result.label}: ${pick.item.title}`;
          optionDuration = pick.bingeMinutes;
          setWatchlistPickLabel(`${label} — ${continueSuggestion(pick.item)}`);
          // remember item id on label is messy; store via budgetNote suffix
          setBudgetNote(continueSuggestion(pick.item));
          (window as unknown as { __spinWatchId?: string }).__spinWatchId = pick.item.id;
        } else {
          label = `${result.label}: (watchlist empty — add titles in Entertainment)`;
          setWatchlistPickLabel(label);
        }
      }

      const now = getDemoDate();
      const budget = planSpinDuration(optionDuration, now, spinCutoff);
      const planned = budget.plannedMinutes;

      if (budget.capped) {
        setBudgetNote(
          `Capped to ${formatMinutes(planned)} (until ${spinCutoff} — had ${formatMinutes(optionDuration ?? 0)} on the option)`
        );
      } else if (budget.remainingUntilCutoff > 0) {
        setBudgetNote(`${formatMinutes(budget.remainingUntilCutoff)} left until ${spinCutoff}`);
      } else {
        setBudgetNote(`Past ${spinCutoff} — logging real time only`);
      }

      const startedAt = now.toISOString();
      const row = await spinHistoriesRepo.create({
        date: toIsoDate(now),
        wheelId: currentWheel.id,
        wheelName: currentWheel.name,
        optionId: result.id,
        optionLabel: label,
        path: [...path, label],
        durationMinutes: planned || optionDuration,
        plannedMinutes: optionDuration,
        startedAt,
        completed: false,
      });
      setActiveHistoryId(row.id);
      if (planned && planned > 0) setTimerMinutes(planned);
    } finally {
      setBusy(false);
    }
  }, [result, currentWheel, wheels, path]);

  const finishActiveSession = useCallback(
    async (actualMinutes?: number) => {
      if (!activeHistoryId) {
        setTimerMinutes(null);
        return;
      }
      const endedAt = getDemoDate().toISOString();
      const rows = await spinHistoriesRepo.list();
      const row = rows.find((h) => h.id === activeHistoryId);
      let actual = actualMinutes;
      if (actual == null && row?.startedAt) {
        actual = Math.max(
          1,
          Math.round((getDemoDate().getTime() - new Date(row.startedAt).getTime()) / 60000)
        );
      }
      await spinHistoriesRepo.update(activeHistoryId, {
        endedAt,
        actualMinutes: actual,
        durationMinutes: actual ?? row?.durationMinutes,
        completed: true,
      });
      // History only — episode +1 is manual in Entertainment (+1 ep), not auto
      delete (window as unknown as { __spinWatchId?: string }).__spinWatchId;
      setActiveHistoryId(null);
      setTimerMinutes(null);
      setResult(null);
      setWatchlistPickLabel(null);
      setBudgetNote("Saved to today's history — next spin unlocked");
    },
    [activeHistoryId]
  );

  const spinAgain = () => {
    // Only allowed after current session fully closed
    if (activeHistoryId || (timerMinutes != null && timerMinutes > 0)) return;
    setResult(null);
    setTimerMinutes(null);
    setActiveHistoryId(null);
    setBudgetNote(null);
    setWatchlistPickLabel(null);
    void doSpin();
  };

  const goRoot = () => {
    if (roots[0]) {
      setCurrentWheelId(roots[0].id);
      setPath([roots[0].name]);
      setResult(null);
    }
  };

  // ---- Editor helpers ----
  const saveWheel = async (wheel: SpinWheel, patch: Partial<SpinWheel>) => {
    await spinWheelsRepo.update(wheel.id, patch);
  };

  const addOption = async (wheel: SpinWheel) => {
    const option: SpinWheelOption = {
      id: generateId(),
      label: 'New option',
      enabled: true,
      order: wheel.options.length,
      weight: 1,
    };
    await spinWheelsRepo.update(wheel.id, { options: [...wheel.options, option] });
  };

  const updateOption = async (
    wheel: SpinWheel,
    optionId: string,
    patch: Partial<SpinWheelOption>
  ) => {
    const options = wheel.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o));
    await spinWheelsRepo.update(wheel.id, { options });
  };

  const removeOption = async (wheel: SpinWheel, optionId: string) => {
    await spinWheelsRepo.update(wheel.id, {
      options: wheel.options.filter((o) => o.id !== optionId),
    });
  };

  const moveOption = async (wheel: SpinWheel, optionId: string, dir: -1 | 1) => {
    const sorted = [...wheel.options].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((o) => o.id === optionId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    const options = wheel.options.map((o) => {
      if (o.id === a.id) return { ...o, order: b.order };
      if (o.id === b.id) return { ...o, order: a.order };
      return o;
    });
    await spinWheelsRepo.update(wheel.id, { options });
  };

  const createWheel = async (asRoot = false) => {
    const max = (wheels ?? []).reduce((m, w) => Math.max(m, w.order), -1);
    const row = await spinWheelsRepo.create({
      name: asRoot ? 'New main wheel' : 'New nested wheel',
      parentWheelId: null,
      isRoot: asRoot,
      enabled: true,
      order: max + 1,
      options: [],
    });
    setEditWheelId(row.id);
    setTab('wheels');
  };

  const createChildAndLink = async (parent: SpinWheel, optionId: string) => {
    const max = (wheels ?? []).reduce((m, w) => Math.max(m, w.order), -1);
    const child = await spinWheelsRepo.create({
      name: 'Nested wheel',
      parentWheelId: parent.id,
      isRoot: false,
      enabled: true,
      order: max + 1,
      options: [],
    });
    await updateOption(parent, optionId, { childWheelId: child.id });
    setEditWheelId(child.id);
  };

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'spin', label: 'Spin' },
      { id: 'wheels', label: 'Edit wheels' },
      { id: 'history', label: 'History' },
    ];
    return (
      <div className="sp-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sp-tab ${tab === t.id ? 'sp-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  function renderSpin() {
    if (!currentWheel) {
      return (
        <EmptyState
          icon="🎡"
          title="No wheels yet"
          description="Seed may still be loading, or create a main wheel under Edit wheels."
          action={
            <Button variant="secondary" onClick={() => createWheel(true)}>
              Create main wheel
            </Button>
          }
        />
      );
    }

    const demoNow = getDemoDate();
    const eligible = eligibleOptions(currentWheel, demoNow.getHours() * 60 + demoNow.getMinutes());
    const hidden = (currentWheel.options ?? []).filter((o) => o.enabled).length - eligible.length;

    return (
      <>
        <Card>
          <div className="sp-path">{path.join(' → ') || currentWheel.name}</div>
          <div
            className="sp-wheel-visual"
            style={{ transform: `rotate(${rotation}deg)` }}
            aria-hidden
          >
            <div className="sp-wheel-visual__hub">
              {spinning ? '…' : result?.label ?? currentWheel.name}
            </div>
          </div>
          <p className="sp-muted" style={{ textAlign: 'center' }}>
            {eligible.length} option{eligible.length === 1 ? '' : 's'} available now
            {hidden > 0 ? ` · ${hidden} hidden by time window` : ''}
          </p>

          {(sessionOpen || (result && !result.childWheelId)) && (
            <p className="sp-muted" style={{ textAlign: 'center', marginBottom: 8 }}>
              Finish this spin before starting the next one.
            </p>
          )}
          {!result && (
            <div className="sp-actions">
              <Button variant="primary" disabled={spinning || eligible.length === 0 || sessionOpen} onClick={doSpin}>
                {spinning ? 'Spinning…' : sessionOpen ? 'Complete current first' : 'SPIN'}
              </Button>
              {path.length > 1 && (
                <Button variant="ghost" onClick={goRoot}>
                  Back to main
                </Button>
              )}
            </div>
          )}

          {result && (
            <div className="sp-result">
              <div className="sp-result__label">{result.label}</div>
              <div className="sp-result__meta">
                {formatAvailability(result) || (result.childWheelId ? 'Opens nested wheel' : 'Activity')}
                {result.notes ? ` · ${result.notes}` : ''}
              </div>
              {result.tags?.includes('naveen_anna') && (
                <p className="sp-muted">Specifically for Naveen Anna (not other friends).</p>
              )}
              {watchlistPickLabel && (
                <p className="sp-muted">Picked: {watchlistPickLabel}</p>
              )}
              {budgetNote && (
                <p className="sp-muted" style={{ marginTop: 8 }}>{budgetNote}</p>
              )}
              {timerMinutes != null && timerMinutes > 0 && (
                <SpinTimer
                  durationMinutes={timerMinutes}
                  label={watchlistPickLabel || result.label}
                  onComplete={(actualMin) => {
                    void finishActiveSession(actualMin);
                  }}
                />
              )}
              {activeHistoryId && (timerMinutes == null || timerMinutes <= 0) && (
                <Button variant="primary" onClick={() => void finishActiveSession()}>
                  Mark session finished (real time)
                </Button>
              )}
              <div className="sp-actions">
                {result.childWheelId ? (
                  <Button variant="primary" disabled={busy} onClick={acceptResult}>
                    Open nested wheel
                  </Button>
                ) : (
                  <Button variant="primary" disabled={busy} onClick={acceptResult}>
                    Start session (real time)
                  </Button>
                )}
                <Button variant="secondary" onClick={spinAgain}>
                  SPIN AGAIN
                </Button>
                {path.length > 1 && (
                  <Button variant="ghost" onClick={goRoot}>
                    Main wheel
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <SectionHeader title="Options on this wheel" />
        <Card style={{ padding: 0 }}>
          {[...currentWheel.options]
            .sort((a, b) => a.order - b.order)
            .map((o, i, arr) => {
              const avail = eligible.some((e) => e.id === o.id);
              return (
                <div
                  key={o.id}
                  className="sp-row"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                    opacity: o.enabled && avail ? 1 : 0.45,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {o.label}
                      {o.childWheelId && <span className="sp-badge"> nested</span>}
                    </div>
                    <div className="sp-muted">
                      {formatAvailability(o) || 'Always'}
                      {!avail && o.enabled ? ' · not available now' : ''}
                      {!o.enabled ? ' · disabled' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
        </Card>
      </>
    );
  }

  function renderEditor() {
    const list = wheels ?? [];
    if (editWheelId) {
      const wheel = list.find((w) => w.id === editWheelId);
      if (!wheel) {
        setEditWheelId(null);
        return null;
      }
      const otherWheels = list.filter((w) => w.id !== wheel.id);
      return (
        <>
          <SectionHeader title={`Edit · ${wheel.name}`} />
          <Card>
            <div className="sp-field">
              <label>Name</label>
              <input
                className="sp-input"
                value={wheel.name}
                onChange={(e) => saveWheel(wheel, { name: e.target.value })}
              />
            </div>
            <label className="sp-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={wheel.isRoot}
                onChange={(e) => saveWheel(wheel, { isRoot: e.target.checked })}
              />
              Main / root wheel (shown as entry point)
            </label>
            <label className="sp-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={wheel.enabled}
                onChange={(e) => saveWheel(wheel, { enabled: e.target.checked })}
              />
              Enabled
            </label>
            <div className="sp-field">
              <label>Notes</label>
              <input
                className="sp-input"
                value={wheel.notes ?? ''}
                onChange={(e) => saveWheel(wheel, { notes: e.target.value })}
              />
            </div>
          </Card>

          <SectionHeader
            title="Options"
            action={
              <Button variant="ghost" onClick={() => addOption(wheel)}>
                + Add
              </Button>
            }
          />
          {[...wheel.options]
            .sort((a, b) => a.order - b.order)
            .map((o) => (
              <Card key={o.id} className="sp-option-card">
                <div className="sp-field">
                  <label>Label</label>
                  <input
                    className="sp-input"
                    value={o.label}
                    onChange={(e) => updateOption(wheel, o.id, { label: e.target.value })}
                  />
                </div>
                <label className="sp-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={o.enabled}
                    onChange={(e) => updateOption(wheel, o.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <div className="sp-field">
                  <label>Duration (minutes)</label>
                  <input
                    className="sp-input"
                    type="number"
                    value={o.durationMinutes ?? ''}
                    onChange={(e) =>
                      updateOption(wheel, o.id, {
                        durationMinutes: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="sp-field">
                  <label>Available after (HH:mm) — e.g. 18:00</label>
                  <input
                    className="sp-input"
                    value={o.availableAfterHm ?? ''}
                    onChange={(e) =>
                      updateOption(wheel, o.id, {
                        availableAfterHm: e.target.value.trim() || null,
                      })
                    }
                  />
                </div>
                <div className="sp-field">
                  <label>Available before (HH:mm)</label>
                  <input
                    className="sp-input"
                    value={o.availableBeforeHm ?? ''}
                    onChange={(e) =>
                      updateOption(wheel, o.id, {
                        availableBeforeHm: e.target.value.trim() || null,
                      })
                    }
                  />
                </div>
                <div className="sp-field">
                  <label>Nested child wheel</label>
                  <select
                    className="sp-input"
                    value={o.childWheelId ?? ''}
                    onChange={(e) =>
                      updateOption(wheel, o.id, {
                        childWheelId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— none (leaf activity) —</option>
                    {otherWheels.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sp-field">
                  <label>Notes</label>
                  <input
                    className="sp-input"
                    value={o.notes ?? ''}
                    onChange={(e) => updateOption(wheel, o.id, { notes: e.target.value })}
                  />
                </div>
                <div className="sp-field">
                  <label>Tags (comma)</label>
                  <input
                    className="sp-input"
                    value={(o.tags ?? []).join(', ')}
                    onChange={(e) =>
                      updateOption(wheel, o.id, {
                        tags: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div className="sp-actions" style={{ justifyContent: 'flex-start' }}>
                  <Button variant="ghost" onClick={() => moveOption(wheel, o.id, -1)}>
                    ↑
                  </Button>
                  <Button variant="ghost" onClick={() => moveOption(wheel, o.id, 1)}>
                    ↓
                  </Button>
                  <Button variant="secondary" onClick={() => createChildAndLink(wheel, o.id)}>
                    + Nested wheel
                  </Button>
                  <Button variant="ghost" onClick={() => removeOption(wheel, o.id)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}

          <Button variant="secondary" onClick={() => setEditWheelId(null)}>
            Done editing
          </Button>
        </>
      );
    }

    return (
      <>
        <SectionHeader
          title="All wheels"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={() => createWheel(true)}>
                + Root
              </Button>
              <Button variant="ghost" onClick={() => createWheel(false)}>
                + Nested
              </Button>
            </div>
          }
        />
        <p className="sp-muted">
          Unlimited nesting via child wheel links. Nothing is hard-coded — edit or delete the
          seed freely. Sat/Sun rest days typically use the Main Wheel.
        </p>
        {list.length === 0 ? (
          <EmptyState icon="🎡" title="No wheels" description="Create a root wheel to start." />
        ) : (
          <Card style={{ padding: 0 }}>
            {list.map((w, i) => (
              <div
                key={w.id}
                className="sp-row"
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                  opacity: w.enabled ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {w.name}
                    {w.isRoot && <span className="sp-badge"> root</span>}
                  </div>
                  <div className="sp-muted">
                    {w.options.length} options
                    {w.notes ? ` · ${w.notes}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="sp-link" onClick={() => setEditWheelId(w.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="sp-link"
                    onClick={() => {
                      setCurrentWheelId(w.id);
                      setPath([w.name]);
                      setResult(null);
                      setTab('spin');
                    }}
                  >
                    Spin
                  </button>
                  <button
                    type="button"
                    className="sp-link"
                    onClick={() => spinWheelsRepo.remove(w.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  function renderHistory() {
    const todayIso = toIsoDate(getDemoDate());
    const list = (history ?? []).filter((h) => !h.deleted && h.date === todayIso).filter((h) => (h.actualMinutes ?? h.durationMinutes ?? 0) <= 12 * 60);
    if (list.length === 0) {
      return (
        <EmptyState
          icon="📜"
          title="No spins logged today"
          description="Finish a spin session — it shows here and on the Today tab."
        />
      );
    }
    return (
      <>
      <div style={{ marginBottom: 8 }}>
        <Button
          variant="ghost"
          onClick={async () => {
            const rows = await spinHistoriesRepo.list();
            for (const h of rows) {
              if (!h.deleted && h.date === todayIso) await spinHistoriesRepo.remove(h.id);
            }
          }}
        >
          Clear today&apos;s history
        </Button>
      </div>
      <Card style={{ padding: 0 }}>
        {list.map((h, i) => (
          <div
            key={h.id}
            className="sp-row"
            style={{
              borderBottom: i < list.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {h.date} · {h.optionLabel}
              </div>
              <div className="sp-muted">
                {(h.path ?? []).join(' → ')}
                {h.actualMinutes != null ? ` · lived ${h.actualMinutes}m` : h.durationMinutes ? ` · planned ${h.durationMinutes}m` : ''}{h.startedAt ? ` · ${formatIsoTime12(h.startedAt)}` : ''}{h.completed ? '' : ' · in progress'}
              </div>
            </div>
          </div>
        ))}
      </Card>
      </>
    );
  }

  return (
    <PageShell title="Spin Wheel">
      {tabsBar()}
      {tab === 'spin' && renderSpin()}
      {tab === 'wheels' && renderEditor()}
      {tab === 'history' && renderHistory()}
    </PageShell>
  );
}
