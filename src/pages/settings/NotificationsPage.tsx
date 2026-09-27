/**
 * Add / delete / time every notification.
 * Day Brief options follow these windows.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  getNotifyRules,
  upsertNotifyRule,
  deleteNotifyRule,
  ruleScheduleLabel,
  DAY_LABELS,
  type NotifyRule,
  type NotifyKind,
  type NotifyAction,
} from '../../notify/catalog';
import { requestNotifyPermission } from '../../notify/engine';

const ACTIONS: { id: NotifyAction; label: string }[] = [
  { id: 'water', label: 'Drink water' },
  { id: 'sunscreen', label: 'Sunscreen' },
  { id: 'lip', label: 'Lip balm' },
  { id: 'morning', label: 'Morning Yes/No' },
  { id: 'leave', label: 'Leave bag check' },
  { id: 'night', label: 'Night + tomorrow' },
  { id: 'commute', label: 'Commute spend' },
  { id: 'canteen', label: 'Canteen / snacks' },
  { id: 'lunch', label: 'Lunch spend' },
  { id: 'home', label: 'Heading home' },
  { id: 'custom', label: 'Custom reminder' },
];

function blank(): NotifyRule {
  return {
    id: `c_${Date.now()}`,
    title: '',
    body: '',
    enabled: true,
    kind: 'once',
    times: ['09:00'],
    intervalMin: 90,
    startHm: '08:00',
    endHm: '21:00',
    days: [],
    action: 'custom',
    custom: true,
  };
}

export default function NotificationsPage() {
  const [rules, setRules] = useState<NotifyRule[]>([]);
  const [edit, setEdit] = useState<NotifyRule | null>(null);
  const [perm, setPerm] = useState<string>('');

  const reload = useCallback(async () => {
    setRules(await getNotifyRules());
  }, []);

  useEffect(() => {
    void reload();
    void requestNotifyPermission().then((p) => setPerm(String(p)));
  }, [reload]);

  const save = async (rule: NotifyRule) => {
    if (!rule.title.trim()) return;
    const times = rule.times.map((t) => t.trim()).filter(Boolean);
    setRules(await upsertNotifyRule({ ...rule, title: rule.title.trim(), times }));
    setEdit(null);
  };

  return (
    <PageShell title="Notifications">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 0 }}>
        Every reminder you get — drink water, sunscreen, commute, night — lives here.
        Add, delete, or change the time. Day Brief shows the matching Yes/No when that window is open.
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        Permission: <strong>{perm || '…'}</strong>
        {perm !== 'granted' && ' — tap Allow when the phone asks, or you only see in-app cards.'}
      </p>
      <Button
        variant="secondary"
        onClick={async () => {
          setPerm(String(await requestNotifyPermission()));
        }}
      >
        Enable notifications
      </Button>

      <div style={{ margin: '16px 0' }}>
        <Button variant="primary" onClick={() => setEdit(blank())}>
          + Add notification
        </Button>
      </div>

      {edit && (
        <Card style={{ marginBottom: 16 }}>
          <strong>{edit.custom && !rules.some((r) => r.id === edit.id) ? 'New notification' : 'Edit'}</strong>
          <label style={lab}>Title</label>
          <input
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            placeholder="Drink water"
            style={inp}
          />
          <label style={lab}>Message</label>
          <input
            value={edit.body}
            onChange={(e) => setEdit({ ...edit, body: e.target.value })}
            placeholder="Log a glass on Day Brief"
            style={inp}
          />
          <label style={lab}>What it opens on Day Brief</label>
          <select
            value={edit.action}
            onChange={(e) => setEdit({ ...edit, action: e.target.value as NotifyAction })}
            style={inp}
          >
            {ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <label style={lab}>When</label>
          <select
            value={edit.kind}
            onChange={(e) => setEdit({ ...edit, kind: e.target.value as NotifyKind })}
            style={inp}
          >
            <option value="once">At exact times</option>
            <option value="interval">Repeat inside a window</option>
            <option value="window">Whole window (once when it opens)</option>
          </select>

          {edit.kind === 'once' && (
            <>
              <label style={lab}>Times (comma or one per line) — 24h HH:mm</label>
              <input
                value={edit.times.join(', ')}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    times: e.target.value.split(/[,\n]/).map((s) => s.trim()),
                  })
                }
                placeholder="07:00, 13:00, 21:00"
                style={inp}
              />
            </>
          )}

          {(edit.kind === 'interval' || edit.kind === 'window') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <label style={lab}>From</label>
                <input
                  type="time"
                  value={edit.startHm ?? '08:00'}
                  onChange={(e) => setEdit({ ...edit, startHm: e.target.value })}
                  style={inp}
                />
              </div>
              <div>
                <label style={lab}>To</label>
                <input
                  type="time"
                  value={edit.endHm ?? '21:00'}
                  onChange={(e) => setEdit({ ...edit, endHm: e.target.value })}
                  style={inp}
                />
              </div>
              {edit.kind === 'interval' && (
                <div>
                  <label style={lab}>Every (minutes)</label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={edit.intervalMin ?? 90}
                    onChange={(e) =>
                      setEdit({ ...edit, intervalMin: Number(e.target.value) || 90 })
                    }
                    style={inp}
                  />
                </div>
              )}
            </div>
          )}

          <label style={lab}>Days (empty = every day)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DAY_LABELS.map((d, i) => {
              const on = edit.days.includes(i);
              return (
                <Button
                  key={d}
                  variant={on ? 'primary' : 'ghost'}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      days: on ? edit.days.filter((x) => x !== i) : [...edit.days, i].sort(),
                    })
                  }
                >
                  {d}
                </Button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => save(edit)}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {rules.map((r) => (
        <Card key={r.id} style={{ marginBottom: 10, opacity: r.enabled ? 1 : 0.55 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <strong>{r.title}</strong>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                {ruleScheduleLabel(r)}
                {r.days.length ? ` · ${r.days.map((d) => DAY_LABELS[d]).join(' ')}` : ' · every day'}
              </div>
              {r.body && (
                <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>{r.body}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Button
                variant={r.enabled ? 'secondary' : 'ghost'}
                onClick={async () =>
                  setRules(await upsertNotifyRule({ ...r, enabled: !r.enabled }))
                }
              >
                {r.enabled ? 'On' : 'Off'}
              </Button>
              <Button variant="ghost" onClick={() => setEdit({ ...r })}>
                Time
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (confirm(`Delete “${r.title}”?`)) setRules(await deleteNotifyRule(r.id));
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </PageShell>
  );
}

const lab: CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--color-text-secondary)',
  margin: '10px 0 4px',
};
const inp: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'inherit',
};
