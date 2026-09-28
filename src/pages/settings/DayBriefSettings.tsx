/**
 * One simple screen for everything added by the day-type system:
 * day types, wake coach, travel + music, greetings, notifications.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';
import {
  DAY_TYPES,
  endRangeOn,
  getRanges,
  getSundayDefault,
  setSundayDefault,
  type DateRange,
} from '../../day/dayTypes';
import {
  DEFAULT_WAKE_COACH,
  getWakeCoachConfig,
  setWakeCoachConfig,
  type WakeCoachConfig,
} from '../../day/wakeCoach';
import { getDefaultFare, setDefaultFare } from '../../day/travel';
import {
  DEFAULT_TRAVEL_MUSIC,
  getTravelMusicConfig,
  setTravelMusicConfig,
  type TravelMusicConfig,
} from '../../music/travelMusic';
import {
  DEFAULT_GREETINGS,
  getGreetingConfig,
  setGreetingConfig,
  type GreetingConfig,
} from '../../day/greeting';
import {
  NOTIFY_LABELS,
  DEFAULT_NOTIFY,
  getNotifyConfig,
  setNotifyConfig,
  notificationPermission,
  requestNotificationPermission,
  type NotifyConfig,
  type NotifyTypeId,
  type PermissionResult,
} from '../../notifications/scheduler';
import { toIsoDate } from '../../routine/engine';
import {
  DEFAULT_APPEARANCE,
  getAppearanceConfig,
  setAppearanceConfig,
  type AppearanceConfig,
} from '../../appearance/settings';

const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '8px 0',
};
const input: CSSProperties = { padding: 8, maxWidth: 140 };

export default function DayBriefSettings() {
  const [sunday, setSunday] = useState(false);
  const [wake, setWake] = useState<WakeCoachConfig>(DEFAULT_WAKE_COACH);
  const [fare, setFare] = useState('');
  const [tm, setTm] = useState<TravelMusicConfig>(DEFAULT_TRAVEL_MUSIC);
  const [gr, setGr] = useState<GreetingConfig>({ enabled: true, name: '', list: DEFAULT_GREETINGS });
  const [nf, setNf] = useState<NotifyConfig>(DEFAULT_NOTIFY);
  const [perm, setPerm] = useState<PermissionResult>('denied');
  const [deep, setDeep] = useState<DateRange[]>([]);
  const [stay, setStay] = useState<DateRange[]>([]);
  const [ap, setAp] = useState<AppearanceConfig>(DEFAULT_APPEARANCE);
  const [newLang, setNewLang] = useState('');
  const [newText, setNewText] = useState('');
  const [newMeaning, setNewMeaning] = useState('');

  const load = useCallback(async () => {
    setSunday(await getSundayDefault());
    setWake(await getWakeCoachConfig());
    const f = await getDefaultFare();
    setFare(f > 0 ? String(f) : '');
    setTm(await getTravelMusicConfig());
    setGr(await getGreetingConfig());
    setNf(await getNotifyConfig());
    setPerm(await notificationPermission());
    setDeep(await getRanges('deep_work'));
    setStay(await getRanges('coimbatore_stay'));
    setAp(await getAppearanceConfig());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveWake = async (patch: Partial<WakeCoachConfig>) => {
    const next = { ...wake, ...patch };
    setWake(next);
    await setWakeCoachConfig(patch);
  };
  const saveGr = async (patch: Partial<GreetingConfig>) => {
    const next = { ...gr, ...patch };
    setGr(next);
    await setGreetingConfig(patch);
  };
  const saveNf = async (next: NotifyConfig) => {
    setNf(next);
    await setNotifyConfig(next);
  };
  const today = toIsoDate(new Date());

  return (
    <PageShell title="Day Brief settings">
      {/* ---------- day types ---------- */}
      <SectionHeader title="Day types" />
      <Card>
        {DAY_TYPES.map((d) => (
          <div key={d.key} style={row}>
            <span>
              {d.icon} {d.name}
            </span>
          </div>
        ))}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Rename or change what each type does in Special Days. Any weekday or weekend can be any
          type. You pick tomorrow&apos;s type at night.
        </p>
        <Link to="/special-days">
          <Button variant="secondary">Edit day types</Button>
        </Link>
        <label style={{ ...row, marginTop: 8 }}>
          <span>Treat every Sunday as a special day</span>
          <input
            type="checkbox"
            checked={sunday}
            onChange={async (e) => {
              setSunday(e.target.checked);
              await setSundayDefault(e.target.checked);
            }}
          />
        </label>
        {(deep.length > 0 || stay.length > 0) && (
          <div style={{ marginTop: 8 }}>
            {[
              { title: 'Deep Work Day', key: 'deep_work' as const, list: deep },
              { title: 'Coimbatore Stay', key: 'coimbatore_stay' as const, list: stay },
            ]
              .filter((g) => g.list.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <strong style={{ fontSize: 'var(--text-sm)' }}>{g.title} ranges</strong>
                  {g.list.map((r) => (
                    <div key={r.start} style={row}>
                      <span style={{ fontSize: 'var(--text-sm)' }}>
                        {r.start} to {r.end}
                      </span>
                      {r.end >= today && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            await endRangeOn(g.key, today);
                            await load();
                          }}
                        >
                          End today
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* ---------- wake coach ---------- */}
      <SectionHeader title="Wake coach (Campus and Early Exit days)" />
      <Card>
        <label style={row}>
          <span>Coach on</span>
          <input
            type="checkbox"
            checked={wake.enabled}
            onChange={(e) => saveWake({ enabled: e.target.checked })}
          />
        </label>
        {(['planA', 'planB'] as const).map((k) => (
          <div key={k}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>
              {k === 'planA' ? 'Plan A (early bus)' : 'Plan B (later bus)'}
            </strong>
            {(
              [
                ['wakeBy', 'Wake by'],
                ['bus', 'Bus time'],
                ['arrive', 'Reach college'],
              ] as const
            ).map(([f, label]) => (
              <label key={f} style={row}>
                <span>{label}</span>
                <input
                  type="time"
                  style={input}
                  value={wake[k][f]}
                  onChange={(e) => saveWake({ [k]: { ...wake[k], [f]: e.target.value } })}
                />
              </label>
            ))}
          </div>
        ))}
        <label style={row}>
          <span>Bus counted as missed after</span>
          <input
            type="time"
            style={input}
            value={wake.missedAfter}
            onChange={(e) => saveWake({ missedAfter: e.target.value })}
          />
        </label>
        <label style={row}>
          <span>Minutes to reach the bus stop</span>
          <input
            type="number"
            style={input}
            value={wake.leaveBufferMin}
            onChange={(e) => saveWake({ leaveBufferMin: Number(e.target.value) || 0 })}
          />
        </label>
        <label style={row}>
          <span>Water reminder (min after waking)</span>
          <input
            type="number"
            style={input}
            value={wake.waterAfterMin}
            onChange={(e) => saveWake({ waterAfterMin: Number(e.target.value) || 0 })}
          />
        </label>
        <label style={row}>
          <span>Eat reminder (min after waking)</span>
          <input
            type="number"
            style={input}
            value={wake.eatAfterMin}
            onChange={(e) => saveWake({ eatAfterMin: Number(e.target.value) || 0 })}
          />
        </label>

        <strong style={{ fontSize: 'var(--text-sm)' }}>Morning steps (minutes)</strong>
        {wake.steps.map((s, i) => (
          <div key={i} style={row}>
            <input
              style={{ ...input, flex: 1, maxWidth: 'none' }}
              value={s.label}
              onChange={(e) => {
                const steps = wake.steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
                void saveWake({ steps });
              }}
            />
            <input
              type="number"
              style={{ ...input, width: 70 }}
              value={s.minutes}
              onChange={(e) => {
                const steps = wake.steps.map((x, j) =>
                  j === i ? { ...x, minutes: Number(e.target.value) || 0 } : x
                );
                void saveWake({ steps });
              }}
            />
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={!!s.optional}
                onChange={(e) => {
                  const steps = wake.steps.map((x, j) =>
                    j === i ? { ...x, optional: e.target.checked } : x
                  );
                  void saveWake({ steps });
                }}
              />{' '}
              skip if late
            </label>
            <Button
              variant="ghost"
              onClick={() => saveWake({ steps: wake.steps.filter((_, j) => j !== i) })}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => saveWake({ steps: [...wake.steps, { label: 'New step', minutes: 5 }] })}
        >
          + Add step
        </Button>

        <strong style={{ display: 'block', marginTop: 12, fontSize: 'var(--text-sm)' }}>
          Coach messages (use {'{bus} {arrive} {mins}'})
        </strong>
        {(Object.keys(wake.messages) as (keyof WakeCoachConfig['messages'])[]).map((k) => (
          <label key={k} style={{ display: 'block', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{k}</span>
            <input
              style={{ width: '100%', padding: 8 }}
              value={wake.messages[k]}
              onChange={(e) => saveWake({ messages: { ...wake.messages, [k]: e.target.value } })}
            />
          </label>
        ))}
      </Card>

      {/* ---------- travel + music ---------- */}
      <SectionHeader title="Travel and music" />
      <Card>
        <label style={row}>
          <span>Usual bus fare (₹)</span>
          <input
            type="number"
            style={input}
            value={fare}
            placeholder="0"
            onChange={async (e) => {
              setFare(e.target.value);
              await setDefaultFare(Number(e.target.value) || 0);
            }}
          />
        </label>
        <label style={row}>
          <span>Play music on the bus</span>
          <input
            type="checkbox"
            checked={tm.enabled}
            onChange={async (e) => {
              setTm({ ...tm, enabled: e.target.checked });
              await setTravelMusicConfig({ enabled: e.target.checked });
            }}
          />
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>
          <span style={{ fontSize: 'var(--text-sm)' }}>
            English {tm.englishShare}% / Tamil {100 - tm.englishShare}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={tm.englishShare}
            style={{ width: '100%' }}
            onChange={async (e) => {
              const v = Number(e.target.value);
              setTm({ ...tm, englishShare: v });
              await setTravelMusicConfig({ englishShare: v });
            }}
          />
        </label>
        <Link to="/music">
          <Button variant="secondary" style={{ marginTop: 8 }}>
            Import English and Tamil songs
          </Button>
        </Link>
      </Card>

      {/* ---------- greetings ---------- */}
      <SectionHeader title="Good morning greetings" />
      <Card>
        <label style={row}>
          <span>Show a random greeting</span>
          <input
            type="checkbox"
            checked={gr.enabled}
            onChange={(e) => saveGr({ enabled: e.target.checked })}
          />
        </label>
        <label style={row}>
          <span>Name after greeting (optional)</span>
          <input style={input} value={gr.name} onChange={(e) => saveGr({ name: e.target.value })} />
        </label>
        {gr.list.map((g, i) => (
          <div key={`${g.language}-${g.text}-${i}`} style={row}>
            <span style={{ fontSize: 'var(--text-sm)' }}>
              {g.language}: {g.text}
            </span>
            <Button variant="ghost" onClick={() => saveGr({ list: gr.list.filter((_, j) => j !== i) })}>
              ✕
            </Button>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <input placeholder="Language" value={newLang} onChange={(e) => setNewLang(e.target.value)} style={{ padding: 8 }} />
          <input placeholder="Good morning in English letters" value={newText} onChange={(e) => setNewText(e.target.value)} style={{ padding: 8 }} />
          <input placeholder="Meaning" value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} style={{ padding: 8 }} />
          <Button
            variant="secondary"
            onClick={async () => {
              if (!newLang.trim() || !newText.trim()) return;
              await saveGr({
                list: [...gr.list, { language: newLang.trim(), text: newText.trim(), meaning: newMeaning.trim() || 'Good morning' }],
              });
              setNewLang('');
              setNewText('');
              setNewMeaning('');
            }}
          >
            + Add greeting
          </Button>
          <Button variant="ghost" onClick={() => saveGr({ list: DEFAULT_GREETINGS })}>
            Reset to default list
          </Button>
        </div>
      </Card>

      {/* ---------- backgrounds ---------- */}
      <SectionHeader title="Backgrounds and colours" />
      <Card>
        {(
          [
            ['dailyBackgroundEnabled', 'Daily random background'],
            ['builtinBackgroundsEnabled', 'Use the 15 built-in scenes when I have no photos'],
            ['forceBuiltinBackgrounds', 'Always use the 15 built-in scenes'],
            ['adaptiveColors', 'Match colours to the background'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} style={row}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={ap[k]}
              onChange={async (e) => setAp(await setAppearanceConfig({ [k]: e.target.checked }))}
            />
          </label>
        ))}
        <Link to="/appearance">
          <Button variant="secondary">Import my own photos</Button>
        </Link>
      </Card>

      {/* ---------- notifications ---------- */}
      <SectionHeader title="Notifications" />
      <Card>
        <p style={{ fontSize: 'var(--text-sm)', margin: '0 0 8px' }}>
          Permission: <strong>{perm}</strong>
        </p>
        {perm !== 'granted' && (
          <Button
            onClick={async () => setPerm(await requestNotificationPermission())}
            style={{ marginBottom: 8 }}
          >
            Allow notifications
          </Button>
        )}
        <label style={row}>
          <span>All notifications</span>
          <input
            type="checkbox"
            checked={nf.master}
            onChange={(e) => saveNf({ ...nf, master: e.target.checked })}
          />
        </label>
        {(Object.keys(NOTIFY_LABELS) as NotifyTypeId[]).map((id) => (
          <div key={id} style={row}>
            <div>
              <div>{NOTIFY_LABELS[id].label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {NOTIFY_LABELS[id].hint}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {NOTIFY_LABELS[id].hasTime && (
                <input
                  type="time"
                  style={{ ...input, width: 110 }}
                  value={nf.types[id].time ?? ''}
                  onChange={(e) =>
                    saveNf({ ...nf, types: { ...nf.types, [id]: { ...nf.types[id], time: e.target.value } } })
                  }
                />
              )}
              <input
                type="checkbox"
                checked={nf.types[id].on}
                onChange={(e) =>
                  saveNf({ ...nf, types: { ...nf.types, [id]: { ...nf.types[id], on: e.target.checked } } })
                }
              />
            </div>
          </div>
        ))}

        <strong style={{ display: 'block', marginTop: 12, fontSize: 'var(--text-sm)' }}>
          Optional wake alarm per day type
        </strong>
        {DAY_TYPES.map((d) => (
          <div key={d.key} style={row}>
            <span>
              {d.icon} {d.name}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="time"
                style={{ ...input, width: 110 }}
                value={nf.alarms[d.key].time}
                onChange={(e) =>
                  saveNf({ ...nf, alarms: { ...nf.alarms, [d.key]: { ...nf.alarms[d.key], time: e.target.value } } })
                }
              />
              <input
                type="checkbox"
                checked={nf.alarms[d.key].on}
                onChange={(e) =>
                  saveNf({ ...nf, alarms: { ...nf.alarms, [d.key]: { ...nf.alarms[d.key], on: e.target.checked } } })
                }
              />
            </div>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}
