import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { bucketListItemsRepo, generateId } from '../data/repository';
import { saveBlob, getBlob, deleteBlob } from '../data/settings';
import type { BucketListItem } from '../data/types';
import { toIsoDate } from '../routine/engine';
import { seedBucketListIfNeeded } from '../bucket/seed';
import '../bucket/bucket.css';

type Filter = 'all' | 'planned' | 'in_progress' | 'done';

export default function BucketList() {
  const [seeded, setSeeded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BucketListItem['status']>('planned');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    seedBucketListIfNeeded().then(() => setSeeded(true));
  }, []);

  const items = useLiveQuery(() => bucketListItemsRepo.list(), [seeded]);

  const list = useMemo(() => {
    let rows = (items ?? []).filter((i) => !i.deleted);
    if (filter !== 'all') rows = rows.filter((i) => i.status === filter);
    return rows.sort((a, b) => a.order - b.order);
  }, [items, filter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const urls: Record<string, string> = {};
      for (const i of items ?? []) {
        if (i.deleted || !i.photoBlobKey) continue;
        const blob = await getBlob(i.photoBlobKey);
        if (blob && !cancelled) urls[i.id] = URL.createObjectURL(blob);
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
  }, [items]);

  const resetForm = () => {
    setEditId(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setNotes('');
    setStatus('planned');
  };

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const today = toIsoDate(new Date());
      if (editId) {
        const patch: Partial<BucketListItem> = {
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          status,
        };
        if (status === 'done') patch.completedDate = today;
        await bucketListItemsRepo.update(editId, patch);
      } else {
        const max = (items ?? []).reduce((m, i) => Math.max(m, i.order ?? 0), -1);
        await bucketListItemsRepo.create({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          status,
          createdDate: today,
          completedDate: status === 'done' ? today : undefined,
          order: max + 1,
        });
      }
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (i: BucketListItem) => {
    setEditId(i.id);
    setTitle(i.title);
    setDescription(i.description ?? '');
    setCategory(i.category ?? '');
    setNotes(i.notes ?? '');
    setStatus(i.status);
  };

  const setItemStatus = async (i: BucketListItem, s: BucketListItem['status']) => {
    await bucketListItemsRepo.update(i.id, {
      status: s,
      completedDate: s === 'done' ? toIsoDate(new Date()) : undefined,
    });
  };

  const remove = async (i: BucketListItem) => {
    if (!confirm(`Delete “${i.title}”?`)) return;
    if (i.photoBlobKey) {
      try {
        await deleteBlob(i.photoBlobKey);
      } catch {
        /* ignore */
      }
    }
    await bucketListItemsRepo.remove(i.id, true);
  };

  const addPhoto = (i: BucketListItem) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const key = `bucket:${generateId()}`;
      await saveBlob(key, file);
      if (i.photoBlobKey) {
        try {
          await deleteBlob(i.photoBlobKey);
        } catch {
          /* ignore */
        }
      }
      await bucketListItemsRepo.update(i.id, { photoBlobKey: key });
      input.remove();
    };
    input.click();
  };

  return (
    <PageShell title="Bucket List">
      <p className="bk-note" style={{ marginBottom: 12 }}>
        Initial items are seed data only — edit or delete freely. Nothing is locked.
      </p>

      <div className="bk-tabs">
        {(['all', 'planned', 'in_progress', 'done'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`bk-tab ${filter === f ? 'bk-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'in_progress' ? 'in progress' : f}
          </button>
        ))}
      </div>

      <Card>
        <strong>{editId ? 'Edit item' : 'Add item'}</strong>
        <div className="bk-field">
          <label>Title</label>
          <input className="bk-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="bk-field">
          <label>Description</label>
          <input
            className="bk-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="bk-field">
          <label>Category</label>
          <input
            className="bk-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="bk-field">
          <label>Status</label>
          <select
            className="bk-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as BucketListItem['status'])}
          >
            <option value="planned">planned</option>
            <option value="in_progress">in progress</option>
            <option value="done">done</option>
          </select>
        </div>
        <div className="bk-field">
          <label>Notes</label>
          <input className="bk-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="bk-actions">
          <Button variant="primary" disabled={busy || !title.trim()} onClick={save}>
            {editId ? 'Save' : 'Add'}
          </Button>
          {editId && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <SectionHeader title={`${list.length} items`} />
      {list.length === 0 ? (
        <EmptyState icon="✨" title="Empty" description="Add goals or wait for seed on first open." />
      ) : (
        <Card style={{ padding: 0 }}>
          {list.map((i, idx) => (
            <div
              key={i.id}
              className="bk-row"
              style={{
                borderBottom: idx < list.length - 1 ? '1px solid var(--color-border)' : 'none',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {i.photoBlobKey && photoUrls[i.id] && (
                    <img src={photoUrls[i.id]} alt="" className="bk-photo" />
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.title}</div>
                    <div className="bk-muted">
                      {i.category ?? '—'}
                      {i.description ? ` · ${i.description}` : ''}
                      {i.createdDate ? ` · created ${i.createdDate}` : ''}
                      {i.completedDate ? ` · done ${i.completedDate}` : ''}
                      {i.notes ? ` · ${i.notes}` : ''}
                    </div>
                  </div>
                </div>
                <span className={`bk-badge bk-badge--${i.status}`}>
                  {i.status === 'in_progress' ? 'in progress' : i.status}
                </span>
              </div>
              <div className="bk-actions">
                <button type="button" className="bk-link" onClick={() => setItemStatus(i, 'planned')}>
                  Planned
                </button>
                <button
                  type="button"
                  className="bk-link"
                  onClick={() => setItemStatus(i, 'in_progress')}
                >
                  In progress
                </button>
                <button type="button" className="bk-link" onClick={() => setItemStatus(i, 'done')}>
                  Done
                </button>
                <button type="button" className="bk-link" onClick={() => startEdit(i)}>
                  Edit
                </button>
                <button type="button" className="bk-link" onClick={() => addPhoto(i)}>
                  Photo
                </button>
                <button type="button" className="bk-link" onClick={() => remove(i)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
