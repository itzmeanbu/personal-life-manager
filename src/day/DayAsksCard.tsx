/**
 * Morning / leave / night asks — Yes / No only.
 * Completed (Yes) items vanish so the list stays clear until the job is finished.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getDayAsks,
  toggleAskDone,
  dismissSlot,
  suggestedSlot,
  isSlotActive,
  slotTitle,
  slotHint,
  itemsForSlot,
  addCustomAsk,
  removeCustomAsk,
  getCustomAsks,
  setDayAsks,
  type AskSlot,
  type AskItem,
  type DayAsksState,
} from './dayAsks';
import { notify, getWellnessDay, setWellnessDay } from './wellness';

export function DayAsksCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [state, setState] = useState<DayAsksState | null>(null);
  const [slot, setSlot] = useState<AskSlot>(() => suggestedSlot(date));
  const [items, setItems] = useState<AskItem[]>([]);
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const reload = useCallback(async () => {
    setState(await getDayAsks(iso));
    const list = await itemsForSlot(slot);
    setItems(list);
    const custom = await getCustomAsks();
    setCustomIds(new Set(custom[slot].map((i) => i.id)));
  }, [iso, slot]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setSlot(suggestedSlot(date));
  }, [date]);

  // Morning notification once per day when morning window opens
  useEffect(() => {
    void (async () => {
      const now = new Date();
      if (!isSlotActive('morning', now)) return;
      const s = await getWellnessDay(iso);
      if (s.notified?.morningAsks) return;
      const asks = await getDayAsks(iso);
      const pending = (await itemsForSlot('morning')).filter((i) => !asks.done[i.id]);
      if (pending.length === 0) return;
      await notify('Morning check', `${pending.length} things — Yes/No on Day Brief`);
      await setWellnessDay({
        ...s,
        date: iso,
        notified: { ...s.notified, morningAsks: true },
      });
    })();
  }, [iso]);

  const dismissed = state?.dismissed?.[slot];
  const slotActive = isSlotActive(slot, new Date());
  const pending = slotActive || slot !== 'night'
    ? items.filter((i) => !state?.done[i.id])
    : [];
  const doneItems = items.filter((i) => state?.done[i.id]);
  const doneCount = doneItems.length;

  if (!state) return null;

  if (dismissed) {
    return (
      <Card style={{ marginBottom: 12, opacity: 0.85 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {slotTitle(slot)} dismissed for today
          </span>
          <Button
            variant="ghost"
            onClick={async () => {
              const s = await getDayAsks(iso);
              const next = { ...s, dismissed: { ...s.dismissed, [slot]: false } };
              await setDayAsks(next);
              setState(next);
            }}
          >
            Show again
          </Button>
        </div>
      </Card>
    );
  }

  const sayYes = async (id: string) => {
    setState(await toggleAskDone(iso, id, true));
  };
  const sayNo = async (id: string) => {
    setState(await toggleAskDone(iso, id, false));
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['morning', 'leave', 'night'] as AskSlot[]).map((s) => {
          const active = isSlotActive(s, new Date());
          return (
            <Button
              key={s}
              variant={slot === s ? 'primary' : 'ghost'}
              onClick={() => setSlot(s)}
              disabled={!active && s === 'night'}
            >
              {s === 'morning' ? 'Morning' : s === 'leave' ? 'Leave / college' : 'Night'}
              {!active && s === 'night' ? ' (later)' : ''}
            </Button>
          );
        })}
      </div>

      <strong>{slotTitle(slot)}</strong>
      <p
        style={{
          margin: '4px 0 10px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {slotHint(slot)} · Yes removes the item · {doneCount}/{items.length} done
      </p>
      {!isSlotActive(slot, new Date()) && slot === 'night' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Night checklist unlocks after 8:00 PM.
        </p>
      )}

      {pending.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          All clear for this slot.{' '}
          {doneCount > 0 && (
            <Button variant="ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Hide done' : `Show ${doneCount} done`}
            </Button>
          )}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {pending.map((item) => {
            const isCustom = customIds.has(item.id);
            return (
              <li
                key={item.id}
                style={{
                  marginBottom: 10,
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{item.label}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="primary" onClick={() => sayYes(item.id)}>
                    Yes
                  </Button>
                  <Button variant="secondary" onClick={() => sayNo(item.id)}>
                    No
                  </Button>
                  {isCustom && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await removeCustomAsk(slot, item.id);
                        await reload();
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showDone && doneItems.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '12px 0 0',
            padding: 0,
            opacity: 0.65,
          }}
        >
          {doneItems.map((item) => (
            <li key={item.id} style={{ marginBottom: 6, fontSize: 'var(--text-sm)' }}>
              ✓ {item.label}{' '}
              <Button
                variant="ghost"
                onClick={async () => setState(await toggleAskDone(iso, item.id, false))}
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && pending.length > 0 && (
        <Button variant="ghost" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Hide done' : `Show ${doneCount} done`}
        </Button>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!adding ? (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + Add item
          </Button>
        ) : (
          <>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Helmet, umbrella, assignment"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newLabel.trim()) {
                  await addCustomAsk(slot, newLabel);
                  setNewLabel('');
                  setAdding(false);
                  await reload();
                }
              }}
              style={{
                flex: 1,
                minWidth: 160,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'inherit',
              }}
            />
            <Button
              variant="primary"
              disabled={!newLabel.trim()}
              onClick={async () => {
                await addCustomAsk(slot, newLabel);
                setNewLabel('');
                setAdding(false);
                await reload();
              }}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setNewLabel('');
              }}
            >
              Cancel
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={async () => setState(await dismissSlot(iso, slot))}>
          Hide for today
        </Button>
      </div>
    </Card>
  );
}
