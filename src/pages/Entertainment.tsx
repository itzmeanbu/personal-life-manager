import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  entertainmentCategoriesRepo,
  watchlistItemsRepo,
} from '../data/repository';
import type { WatchlistItem } from '../data/types';
import { seedEntertainmentCategoriesIfNeeded } from '../entertainment/seed';
import {
  getEntertainmentConfig,
  setEntertainmentConfig,
  type EntertainmentConfig,
  DEFAULT_ENTERTAINMENT_CONFIG,
} from '../entertainment/settings';
import { pickRandomFromWatchlist } from '../entertainment/random';
import {
  continueSuggestion,
  encourageWatch,
  logEpisodesWatched,
  nextEpisode,
  getContinueCandidates,
} from '../entertainment/continue';
import '../entertainment/entertainment.css';

type Tab = 'list' | 'categories' | 'settings';

export default function Entertainment() {
  const [tab, setTab] = useState<Tab>('list');
  const [seeded, setSeeded] = useState(false);
  const [config, setConfig] = useState<EntertainmentConfig>(DEFAULT_ENTERTAINMENT_CONFIG);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [randomResult, setRandomResult] = useState<string | null>(null);
  const continueCards = useLiveQuery(() => getContinueCandidates(4), [seeded], []);

  useEffect(() => {
    seedEntertainmentCategoriesIfNeeded().then(() => setSeeded(true));
    getEntertainmentConfig().then(setConfig);
  }, []);

  const categories = useLiveQuery(
    () =>
      entertainmentCategoriesRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    [seeded]
  );
  const items = useLiveQuery(() => watchlistItemsRepo.list(), [seeded]);

  const enabledCats = useMemo(
    () => (categories ?? []).filter((c) => c.enabled && !c.deleted),
    [categories]
  );

  useEffect(() => {
    if (!activeCatId && enabledCats[0]) setActiveCatId(enabledCats[0].id);
  }, [enabledCats, activeCatId]);

  const activeCat = enabledCats.find((c) => c.id === activeCatId) ?? null;

  const listForCat = useMemo(() => {
    if (!activeCatId) return [];
    return (items ?? [])
      .filter((i) => i.categoryId === activeCatId && !i.deleted)
      .sort((a, b) => a.order - b.order);
  }, [items, activeCatId]);

  const addItem = useCallback(async () => {
    const title = newTitle.trim();
    if (!title || !activeCatId) return;
    setBusy(true);
    try {
      const max = listForCat.reduce((m, i) => Math.max(m, i.order), -1);
      await watchlistItemsRepo.create({
        title,
        categoryId: activeCatId,
        watched: false,
        status: 'planned',
        order: max + 1,
      });
      setNewTitle('');
    } finally {
      setBusy(false);
    }
  }, [newTitle, activeCatId, listForCat]);

  const toggleWatched = async (item: WatchlistItem) => {
    const watched = !item.watched;
    await watchlistItemsRepo.update(item.id, {
      watched,
      status: watched ? 'completed' : 'planned',
    });
  };

  const logEps = async (id: string, count: number) => {
    setBusy(true);
    try {
      await logEpisodesWatched(id, count);
    } finally {
      setBusy(false);
    }
  };

  const updateItem = async (id: string, patch: Partial<WatchlistItem>) => {
    await watchlistItemsRepo.update(id, patch);
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Remove this title from the watchlist?')) return;
    await watchlistItemsRepo.remove(id);
  };

  const randomPick = async () => {
    setBusy(true);
    setRandomResult(null);
    try {
      const pick = await pickRandomFromWatchlist({
        categoryId: activeCatId ?? undefined,
      });
      if (!pick) {
        setRandomResult('No items in this list yet — add some first.');
        return;
      }
      const hours = Math.round((pick.bingeMinutes / 60) * 10) / 10;
      setRandomResult(
        `${pick.item.title} · ~${hours}h session` +
          (pick.category?.systemKey === 'kdrama' ? ' (K-drama binge length applies)' : '')
      );
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = prompt('Category name?');
    if (!name?.trim()) return;
    const max = (categories ?? []).reduce((m, c) => Math.max(m, c.order), -1);
    await entertainmentCategoriesRepo.create({
      name: name.trim(),
      icon: '⭐',
      order: max + 1,
      enabled: true,
      systemKey: null,
      defaultBingeMinutes: config.defaultBingeMinutes,
    });
  };

  const saveConfig = async (patch: Partial<EntertainmentConfig>) => {
    const next = await setEntertainmentConfig(patch);
    setConfig(next);
  };

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'list', label: 'Watchlist' },
      { id: 'categories', label: 'Categories' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="en-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`en-tab ${tab === t.id ? 'en-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Entertainment">
      {tabsBar()}

      {tab === 'list' && (
        <>
          <div className="en-cat-chips">
            {enabledCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`en-chip ${activeCatId === c.id ? 'en-chip--on' : ''}`}
                onClick={() => {
                  setActiveCatId(c.id);
                  setRandomResult(null);
                  setEditItemId(null);
                }}
              >
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </button>
            ))}
          </div>

          {activeCat && (
            <Card>
              <strong>
                {activeCat.icon} {activeCat.name}
              </strong>
              <p className="en-muted">
                Default session:{' '}
                {Math.round(((activeCat.defaultBingeMinutes ?? config.defaultBingeMinutes) / 60) * 10) /
                  10}
                h
                {activeCat.systemKey === 'kdrama' ? ' (K-drama binge — configurable)' : ''}
              </p>
              <div className="en-field">
                <label>Add title</label>
                <input
                  className="en-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Show or movie name"
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                />
              </div>
              <div className="en-actions">
                <Button variant="primary" disabled={busy || !newTitle.trim()} onClick={addItem}>
                  Add
                </Button>
                <Button variant="secondary" disabled={busy} onClick={randomPick}>
                  Random from list
                </Button>
                <Link to="/spin">
                  <Button variant="ghost">Open Spin Wheel</Button>
                </Link>
              </div>
              {randomResult && <p className="en-muted">{randomResult}</p>}
            </Card>
          )}

          {continueCards && continueCards.length > 0 && (
            <>
              <SectionHeader title="Continue where you left off" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {continueCards.map(({ item, category, suggestion, nudge }) => (
                  <Card key={item.id}>
                    <div style={{ fontWeight: 600 }}>
                      {category?.icon ? `${category.icon} ` : ''}
                      {item.title}
                    </div>
                    <p style={{ margin: '6px 0 4px', color: 'var(--color-accent)' }}>{suggestion}</p>
                    <p className="en-muted" style={{ margin: '0 0 10px' }}>{nudge}</p>
                    <div className="en-actions">
                      <Button variant="primary" disabled={busy} onClick={() => logEps(item.id, 1)}>
                        +1 ep (now at {nextEpisode(item)})
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => logEps(item.id, 2)}>
                        +2 eps
                      </Button>
                      <button type="button" className="en-link" onClick={() => setEditItemId(item.id)}>
                        Edit
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          <SectionHeader title="List" />
          {listForCat.length === 0 ? (
            <EmptyState
              icon="🎬"
              title="Empty watchlist"
              description="No hard-coded titles — add what you actually want to watch."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {listForCat.map((item, i) => (
                <div
                  key={item.id}
                  className="en-row"
                  style={{
                    borderBottom:
                      i < listForCat.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {editItemId === item.id ? (
                    <div style={{ flex: 1 }}>
                      <div className="en-field">
                        <label>Title</label>
                        <input
                          className="en-input"
                          value={item.title}
                          onChange={(e) => updateItem(item.id, { title: e.target.value })}
                        />
                      </div>
                      <div className="en-field">
                        <label>Episode</label>
                        <input
                          className="en-input"
                          type="number"
                          value={item.episode ?? ''}
                          onChange={(e) =>
                            updateItem(item.id, {
                              episode: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="en-field">
                        <label>Total episodes</label>
                        <input
                          className="en-input"
                          type="number"
                          value={item.totalEpisodes ?? ''}
                          onChange={(e) =>
                            updateItem(item.id, {
                              totalEpisodes:
                                e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="en-field">
                        <label>Binge override (minutes)</label>
                        <input
                          className="en-input"
                          type="number"
                          value={item.bingeMinutes ?? ''}
                          onChange={(e) =>
                            updateItem(item.id, {
                              bingeMinutes:
                                e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="en-field">
                        <label>Notes</label>
                        <input
                          className="en-input"
                          value={item.notes ?? ''}
                          onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                        />
                      </div>
                      <Button variant="secondary" onClick={() => setEditItemId(null)}>
                        Done
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        <div className="en-muted">
                          {item.episode != null || item.status === 'watching'
                            ? continueSuggestion(item)
                            : ''}
                          {item.notes ? ` · ${item.notes}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <span
                          className={`en-badge ${item.watched ? 'en-badge--watched' : 'en-badge--unwatched'}`}
                        >
                          {item.watched ? 'Watched' : 'Unwatched'}
                        </span>
                        {!item.watched && (
                          <>
                            <button type="button" className="en-link" onClick={() => logEps(item.id, 1)}>
                              +1 ep
                            </button>
                            <button type="button" className="en-link" onClick={() => logEps(item.id, 2)}>
                              +2 eps
                            </button>
                          </>
                        )}
                        <button type="button" className="en-link" onClick={() => toggleWatched(item)}>
                          Toggle
                        </button>
                        <button type="button" className="en-link" onClick={() => setEditItemId(item.id)}>
                          Edit
                        </button>
                        <button type="button" className="en-link" onClick={() => deleteItem(item.id)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'categories' && (
        <>
          <SectionHeader
            title="Categories"
            action={
              <Button variant="secondary" onClick={addCategory}>
                + Custom
              </Button>
            }
          />
          <p className="en-muted">
            Seeded: K-drama, Anime, TV, Movies — all editable. No show titles are preloaded.
          </p>
          <Card style={{ padding: 0 }}>
            {(categories ?? []).map((c, i, arr) => (
              <div
                key={c.id}
                className="en-row"
                style={{
                  borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                  opacity: c.enabled ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.icon} {c.name}
                    {c.systemKey === 'kdrama' && ' · binge'}
                  </div>
                  <div className="en-field" style={{ marginTop: 8 }}>
                    <label>Default binge / session (minutes)</label>
                    <input
                      className="en-input"
                      type="number"
                      value={c.defaultBingeMinutes ?? ''}
                      onChange={(e) =>
                        entertainmentCategoriesRepo.update(c.id, {
                          defaultBingeMinutes:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="en-field">
                    <label>Name</label>
                    <input
                      className="en-input"
                      value={c.name}
                      onChange={(e) =>
                        entertainmentCategoriesRepo.update(c.id, { name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    className="en-link"
                    onClick={() =>
                      entertainmentCategoriesRepo.update(c.id, { enabled: !c.enabled })
                    }
                  >
                    {c.enabled ? 'Disable' : 'Enable'}
                  </button>
                  {!c.systemKey && (
                    <button
                      type="button"
                      className="en-link"
                      onClick={() => entertainmentCategoriesRepo.remove(c.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Entertainment settings" />
          <Card>
            <div className="en-field">
              <label>Global default binge (minutes) — fallback when category has none</label>
              <input
                className="en-input"
                type="number"
                value={config.defaultBingeMinutes}
                onChange={(e) => saveConfig({ defaultBingeMinutes: Number(e.target.value) })}
              />
              <p className="en-muted">
                K-drama category defaults to 240 (4h) on first install; change it under Categories.
              </p>
            </div>
            <label className="en-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.randomPreferUnwatched}
                onChange={(e) => saveConfig({ randomPreferUnwatched: e.target.checked })}
              />
              Random pick prefers unwatched
            </label>
            <p className="en-muted">
              Spin Wheel can land on “random from watchlist” via nested wheels that call the same
              picker — open Spin and complete a K-drama / watchlist path, or use Random here.
            </p>
            <Link to="/spin">
              <Button variant="secondary">Go to Spin Wheel</Button>
            </Link>
          </Card>
        </>
      )}
    </PageShell>
  );
}
