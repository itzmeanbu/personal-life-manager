import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { friendsRepo, socialRecordsRepo } from '../data/repository';
import type { SocialRecord } from '../data/types';
import { toIsoDate } from '../routine/engine';
import '../social/social.css';

type Tab = 'log' | 'friends';

export default function Social() {
  const [tab, setTab] = useState<Tab>('log');
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<SocialRecord['kind']>('call');
  const [personName, setPersonName] = useState('');
  const [friendId, setFriendId] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));

  const [newFriend, setNewFriend] = useState('');
  const [naveenNotes, setNaveenNotes] = useState('');

  const friends = useLiveQuery(
    () => friendsRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    []
  );
  const social = useLiveQuery(() => socialRecordsRepo.list(), []);

  const enabledFriends = useMemo(
    () => (friends ?? []).filter((f) => !f.deleted && f.enabled),
    [friends]
  );
  const naveen = useMemo(
    () => (friends ?? []).find((f) => !f.deleted && f.isNaveenAnna),
    [friends]
  );
  const logs = useMemo(
    () =>
      (social ?? [])
        .filter((s) => !s.deleted)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [social]
  );

  const ensureNaveen = async () => {
    if (naveen) return naveen;
    const max = (friends ?? []).reduce((m, f) => Math.max(m, f.order), -1);
    return friendsRepo.create({
      name: 'Naveen Anna',
      isNaveenAnna: true,
      enabled: true,
      order: max + 1,
      notes: 'Separate from other friends — use for “Spend time with Naveen Anna”.',
    });
  };

  const addFriend = async () => {
    if (!newFriend.trim()) return;
    const max = (friends ?? []).reduce((m, f) => Math.max(m, f.order), -1);
    await friendsRepo.create({
      name: newFriend.trim(),
      enabled: true,
      order: max + 1,
      isNaveenAnna: false,
    });
    setNewFriend('');
  };

  const addLog = async () => {
    const name =
      personName.trim() ||
      enabledFriends.find((f) => f.id === friendId)?.name ||
      '';
    if (!name) return;
    setBusy(true);
    try {
      await socialRecordsRepo.create({
        date,
        kind,
        friendId: friendId || undefined,
        personName: name,
        notes: notes.trim() || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
      });
      setNotes('');
      setDuration('');
      setPersonName('');
    } finally {
      setBusy(false);
    }
  };

  const logNaveen = async () => {
    setBusy(true);
    try {
      const n = await ensureNaveen();
      await socialRecordsRepo.create({
        date: toIsoDate(new Date()),
        kind: 'meet',
        friendId: n.id,
        personName: n.name,
        notes: naveenNotes.trim() || 'Spend time with Naveen Anna',
      });
      setNaveenNotes('');
    } finally {
      setBusy(false);
    }
  };

  function tabsBar() {
    return (
      <div className="so-tabs">
        {(
          [
            ['log', 'Calls / meets'],
            ['friends', 'Friends'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`so-tab ${tab === id ? 'so-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Social">
      {tabsBar()}

      {tab === 'log' && (
        <>
          <Card>
            <strong>Log call / meet</strong>
            <div className="so-field">
              <label>Type</label>
              <select
                className="so-input"
                value={kind}
                onChange={(e) => setKind(e.target.value as SocialRecord['kind'])}
              >
                <option value="call">Call</option>
                <option value="meet">Meet</option>
                <option value="message">Message</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="so-field">
              <label>Friend (optional)</label>
              <select
                className="so-input"
                value={friendId}
                onChange={(e) => {
                  setFriendId(e.target.value);
                  const f = enabledFriends.find((x) => x.id === e.target.value);
                  if (f) setPersonName(f.name);
                }}
              >
                <option value="">—</option>
                {enabledFriends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.isNaveenAnna ? ' (Naveen Anna)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="so-field">
              <label>Person name</label>
              <input
                className="so-input"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            </div>
            <div className="so-field">
              <label>Date</label>
              <input
                className="so-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="so-field">
              <label>Duration (min, optional)</label>
              <input
                className="so-input"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="so-field">
              <label>Notes</label>
              <input className="so-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button variant="primary" disabled={busy || !personName.trim()} onClick={addLog}>
              Save
            </Button>
          </Card>

          <Card>
            <strong>Spend time with Naveen Anna</strong>
            <p className="so-note">
              Separate from other friends. Also available on the Spin Wheel as its own option.
            </p>
            <div className="so-field">
              <label>Notes (optional)</label>
              <input
                className="so-input"
                value={naveenNotes}
                onChange={(e) => setNaveenNotes(e.target.value)}
              />
            </div>
            <Button variant="secondary" disabled={busy} onClick={logNaveen}>
              Log time with Naveen Anna
            </Button>
          </Card>

          <SectionHeader title="History" />
          {logs.length === 0 ? (
            <EmptyState icon="💬" title="No social logs" description="Only what you enter appears here." />
          ) : (
            <Card style={{ padding: 0 }}>
              {logs.map((s, i) => (
                <div
                  key={s.id}
                  className="so-row"
                  style={{
                    borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.date} · {s.personName}
                    </div>
                    <div className="so-muted">
                      {s.kind}
                      {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="so-link"
                    onClick={() => socialRecordsRepo.remove(s.id, true)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'friends' && (
        <>
          <Card>
            <strong>Add friend</strong>
            <div className="so-field">
              <label>Name</label>
              <input
                className="so-input"
                value={newFriend}
                onChange={(e) => setNewFriend(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={addFriend}>
              Add
            </Button>
            <div className="so-actions">
              <Button variant="secondary" onClick={() => void ensureNaveen()}>
                Ensure Naveen Anna entry
              </Button>
            </div>
          </Card>
          <SectionHeader title="People" />
          {(friends ?? []).filter((f) => !f.deleted).length === 0 ? (
            <EmptyState icon="👥" title="No friends listed" description="Add people you call or meet." />
          ) : (
            <Card style={{ padding: 0 }}>
              {(friends ?? [])
                .filter((f) => !f.deleted)
                .map((f, i, arr) => (
                  <div
                    key={f.id}
                    className="so-row"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {f.name}
                        {f.isNaveenAnna && <span className="so-badge"> Naveen Anna</span>}
                      </div>
                      <div className="so-muted">{f.notes ?? (f.enabled ? '' : 'disabled')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="so-link"
                        onClick={() => friendsRepo.update(f.id, { enabled: !f.enabled })}
                      >
                        {f.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="so-link"
                        onClick={() => friendsRepo.remove(f.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
