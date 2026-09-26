import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  developmentRecordsRepo,
  developmentPhotosRepo,
  generateId,
} from '../data/repository';
import { saveBlob, getBlob, deleteBlob } from '../data/settings';
import type { DevelopmentRecord, DevelopmentPhoto } from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  getDevelopmentConfig,
  setDevelopmentConfig,
  type DevelopmentConfig,
  DEFAULT_DEVELOPMENT_CONFIG,
} from '../development/settings';
import { computeDevelopmentStats } from '../development/stats';
import '../development/development.css';

type Tab = 'records' | 'photos' | 'stats' | 'settings';

export default function Development() {
  const [tab, setTab] = useState<Tab>('records');
  const [config, setConfig] = useState<DevelopmentConfig>(DEFAULT_DEVELOPMENT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('custom');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    getDevelopmentConfig().then(setConfig);
  }, []);

  const records = useLiveQuery(() => developmentRecordsRepo.list(), []);
  const photos = useLiveQuery(() => developmentPhotosRepo.list(), []);

  const stats = useMemo(() => computeDevelopmentStats(records ?? []), [records]);

  // Load object URLs for local photos (never uploaded)
  useEffect(() => {
    let cancelled = false;
    const urls: Record<string, string> = {};
    (async () => {
      for (const p of photos ?? []) {
        if (p.deleted) continue;
        const blob = await getBlob(p.blobKey);
        if (blob && !cancelled) urls[p.id] = URL.createObjectURL(blob);
      }
      if (!cancelled) {
        setPhotoUrls((prev) => {
          Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
          return urls;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const saveRecord = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (editId) {
        await developmentRecordsRepo.update(editId, {
          title: title.trim(),
          category: category.trim() || 'custom',
          date,
          notes: notes.trim() || undefined,
        });
        setEditId(null);
      } else {
        await developmentRecordsRepo.create({
          title: title.trim(),
          category: category.trim() || 'custom',
          date,
          notes: notes.trim() || undefined,
        });
      }
      setTitle('');
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: DevelopmentRecord) => {
    setEditId(r.id);
    setTitle(r.title);
    setCategory(r.category);
    setDate(r.date);
    setNotes(r.notes ?? '');
    setTab('records');
  };

  const removeRecord = async (r: DevelopmentRecord) => {
    if (!confirm('Delete this record?')) return;
    await developmentRecordsRepo.remove(r.id, true);
  };

  const importPhoto = async (kind: DevelopmentPhoto['kind']) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const blobKey = `devphoto:${generateId()}`;
        await saveBlob(blobKey, file);
        await developmentPhotosRepo.create({
          date: toIsoDate(new Date()),
          kind,
          blobKey,
          mimeType: file.type || 'image/jpeg',
          caption: file.name,
        });
      } finally {
        setBusy(false);
        input.remove();
      }
    };
    input.click();
  };

  const removePhoto = async (p: DevelopmentPhoto) => {
    if (!confirm('Remove this local photo?')) return;
    await developmentPhotosRepo.remove(p.id, true);
    try {
      await deleteBlob(p.blobKey);
    } catch {
      /* ignore */
    }
  };

  const saveConfig = async (patch: Partial<DevelopmentConfig>) => {
    const next = await setDevelopmentConfig(patch);
    setConfig(next);
  };

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'records', label: 'Records' },
      { id: 'photos', label: 'Photos' },
      { id: 'stats', label: 'Stats' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="dv-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dv-tab ${tab === t.id ? 'dv-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Development">
      {tabsBar()}
      <p className="dv-note" style={{ marginBottom: 12 }}>
        Record system only — no invented achievements, missions, or personality levels. You write
        what happened.
      </p>

      {tab === 'records' && (
        <>
          <Card>
            <strong>{editId ? 'Edit record' : 'Add record'}</strong>
            <div className="dv-field">
              <label>Title</label>
              <input
                className="dv-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What happened?"
              />
            </div>
            <div className="dv-field">
              <label>Category</label>
              <input
                className="dv-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <div className="dv-chips">
                {config.categoryPresets.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`dv-chip ${category === c ? 'dv-chip--on' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="dv-field">
              <label>Date</label>
              <input
                className="dv-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="dv-field">
              <label>Notes</label>
              <input className="dv-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="dv-actions">
              <Button variant="primary" disabled={busy || !title.trim()} onClick={saveRecord}>
                {editId ? 'Save' : 'Add'}
              </Button>
              {editId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditId(null);
                    setTitle('');
                    setNotes('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Card>

          <SectionHeader title="Your records" />
          {stats.records.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No records yet"
              description="Examples you might log: overcame stage fear, talked to someone new, spoke English — only if they happened."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {stats.records.map((r, i) => (
                <div
                  key={r.id}
                  className="dv-row"
                  style={{
                    borderBottom:
                      i < stats.records.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {r.date} · {r.title}
                    </div>
                    <div className="dv-muted">
                      {r.category}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="dv-link" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <button type="button" className="dv-link" onClick={() => removeRecord(r)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'photos' && (
        <>
          <Card>
            <strong>Personal photos (local only)</strong>
            <p className="dv-note">
              Stored on this device in IndexedDB. Not uploaded automatically.
            </p>
            <div className="dv-actions">
              <Button variant="secondary" disabled={busy} onClick={() => importPhoto('old')}>
                Add old photo
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => importPhoto('current')}>
                Add current photo
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => importPhoto('other')}>
                Other
              </Button>
            </div>
          </Card>
          <SectionHeader title="Library" />
          {(photos ?? []).filter((p) => !p.deleted).length === 0 ? (
            <EmptyState icon="📷" title="No photos" description="Optional — only if you choose to add." />
          ) : (
            <Card style={{ padding: 0 }}>
              {(photos ?? [])
                .filter((p) => !p.deleted)
                .map((p, i, arr) => (
                  <div
                    key={p.id}
                    className="dv-row"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {photoUrls[p.id] ? (
                        <img src={photoUrls[p.id]} alt="" className="dv-photo" />
                      ) : (
                        <div className="dv-photo" style={{ background: 'var(--color-bg)' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {p.kind} · {p.date}
                        </div>
                        <div className="dv-muted">{p.caption ?? ''}</div>
                      </div>
                    </div>
                    <button type="button" className="dv-link" onClick={() => removePhoto(p)}>
                      Delete
                    </button>
                  </div>
                ))}
            </Card>
          )}
        </>
      )}

      {tab === 'stats' && (
        <>
          <div className="dv-stat-grid">
            <div className="dv-stat">
              <div className="dv-stat__value">{stats.total}</div>
              <div className="dv-stat__label">Total records</div>
            </div>
            <div className="dv-stat">
              <div className="dv-stat__value">{stats.monthly}</div>
              <div className="dv-stat__label">This month</div>
            </div>
            <div className="dv-stat">
              <div className="dv-stat__value">{stats.yearly}</div>
              <div className="dv-stat__label">This year</div>
            </div>
            <div className="dv-stat">
              <div className="dv-stat__value">{stats.byCategory.length}</div>
              <div className="dv-stat__label">Categories used</div>
            </div>
          </div>
          <SectionHeader title="Category history" />
          {stats.byCategory.length === 0 ? (
            <EmptyState icon="📊" title="No data yet" description="Counts come only from records you add." />
          ) : (
            <Card style={{ padding: 0 }}>
              {stats.byCategory.map((c, i) => (
                <div
                  key={c.category}
                  className="dv-row"
                  style={{
                    borderBottom:
                      i < stats.byCategory.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{c.category}</div>
                  <div>{c.count}</div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'settings' && (
        <Card>
          <strong>Category presets</strong>
          <p className="dv-note">Labels for quick pick — not missions or scores.</p>
          <div className="dv-field">
            <label>Comma-separated</label>
            <input
              className="dv-input"
              value={config.categoryPresets.join(', ')}
              onChange={(e) =>
                saveConfig({
                  categoryPresets: e.target.value
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
