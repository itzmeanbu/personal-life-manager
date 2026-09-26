import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import {
  workoutSessionsRepo,
  guitarSessionsRepo,
  learningSessionsRepo,
  completionRecordsRepo,
  collegeDayStatusesRepo,
  socialRecordsRepo,
  bucketListItemsRepo,
  sleepRecordsRepo,
  achievementDefsRepo,
  achievementUnlocksRepo,
  moneyTransactionsRepo,
} from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { useToday } from '../hooks/useToday';
import { useActiveDayProfile } from '../day/hooks';
import {
  getGamificationConfig,
  setGamificationConfig,
  type GamificationConfig,
  DEFAULT_GAMIFICATION_CONFIG,
} from '../gamification/settings';
import { seedAchievementsIfNeeded } from '../gamification/seed';
import {
  buildMetrics,
  buildStreaks,
  computeXp,
  evaluateAchievements,
  greetingForHour,
} from '../gamification/engine';
import '../gamification/progress.css';

type Tab = 'dashboard' | 'achievements' | 'settings';

export default function Progress() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [config, setConfig] = useState<GamificationConfig>(DEFAULT_GAMIFICATION_CONFIG);
  const [seeded, setSeeded] = useState(false);
  const today = useToday();
  const { profile } = useActiveDayProfile(today.date);
  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    seedAchievementsIfNeeded().then(() => setSeeded(true));
    getGamificationConfig().then(setConfig);
  }, []);

  const workouts = useLiveQuery(() => workoutSessionsRepo.list(), [seeded]);
  const guitar = useLiveQuery(() => guitarSessionsRepo.list(), [seeded]);
  const learning = useLiveQuery(() => learningSessionsRepo.list(), [seeded]);
  const completions = useLiveQuery(() => completionRecordsRepo.list(), [seeded]);
  const collegeDays = useLiveQuery(() => collegeDayStatusesRepo.list(), [seeded]);
  const social = useLiveQuery(() => socialRecordsRepo.list(), [seeded]);
  const bucket = useLiveQuery(() => bucketListItemsRepo.list(), [seeded]);
  const sleep = useLiveQuery(() => sleepRecordsRepo.list(), [seeded]);
  const defs = useLiveQuery(() => achievementDefsRepo.list(), [seeded]);
  const unlocks = useLiveQuery(() => achievementUnlocksRepo.list(), [seeded]);
  const money = useLiveQuery(() => moneyTransactionsRepo.list(), [seeded]);

  // Persist new unlocks when metrics cross thresholds
  useEffect(() => {
    if (!config.achievementsEnabled || !defs || !unlocks) return;
    const metrics = buildMetrics({
      workouts: workouts ?? [],
      guitar: guitar ?? [],
      learning: learning ?? [],
      completions: completions ?? [],
      collegeDays: collegeDays ?? [],
      social: social ?? [],
      bucket: bucket ?? [],
      sleep: sleep ?? [],
    });
    const { newlyUnlocked } = evaluateAchievements(defs, metrics, unlocks);
    for (const a of newlyUnlocked) {
      void achievementUnlocksRepo.create({
        achievementKey: a.key,
        unlockedAt: new Date().toISOString(),
      });
    }
  }, [config.achievementsEnabled, defs, unlocks, workouts, guitar, learning, completions, collegeDays, social, bucket, sleep]);

  const snapshot = useMemo(() => {
    const metrics = buildMetrics({
      workouts: workouts ?? [],
      guitar: guitar ?? [],
      learning: learning ?? [],
      completions: completions ?? [],
      collegeDays: collegeDays ?? [],
      social: social ?? [],
      bucket: bucket ?? [],
      sleep: sleep ?? [],
    });
    const xp = config.xpEnabled ? computeXp(metrics, config) : 0;
    const streaks = config.streaksEnabled
      ? buildStreaks({
          workouts: workouts ?? [],
          guitar: guitar ?? [],
          learning: learning ?? [],
          completions: completions ?? [],
        })
      : [];
    const { unlockedKeys } = evaluateAchievements(defs ?? [], metrics, unlocks ?? []);
    return { metrics, xp, streaks, unlockedKeys };
  }, [workouts, guitar, learning, completions, collegeDays, social, bucket, sleep, defs, unlocks, config]);

  const todayWorkout = (workouts ?? []).find((w) => w.date === todayIso && !w.deleted);
  const todayGuitar = (guitar ?? []).filter((g) => g.date === todayIso && !g.deleted);
  const todaySleep = (sleep ?? []).find((s) => s.date === todayIso && !s.deleted);
  const todayMoney = (money ?? []).filter((m) => m.date === todayIso && !m.deleted);
  const todayRoutinesDone = (completions ?? []).filter(
    (c) => c.date === todayIso && !c.deleted && c.status === 'done'
  ).length;

  const contextBits: string[] = [];
  if (profile) contextBits.push(profile.name);
  if (today.isWeekend) contextBits.push(today.dayIndex === 0 ? 'Sunday' : 'Weekend');
  if (today.dayName === 'Monday' || today.dayName === 'Thursday' || today.dayName === 'Friday')
    contextBits.push('Workout day');
  if (todayWorkout?.status === 'cancelled') contextBits.push('Late / cancelled workout');

  const level = Math.floor(snapshot.xp / 500) + 1;
  const xpIntoLevel = snapshot.xp % 500;
  const xpPct = Math.min(100, (xpIntoLevel / 500) * 100);
  const bestStreak = snapshot.streaks.reduce((m, s) => Math.max(m, s.count), 0);

  const hour = new Date().getHours();
  const greet = greetingForHour(hour);

  const saveConfig = async (patch: Partial<GamificationConfig>) => {
    const next = await setGamificationConfig(patch);
    setConfig(next);
  };

  function tabsBar() {
    return (
      <div className="pg-tabs">
        {(
          [
            ['dashboard', 'Dashboard'],
            ['achievements', 'Achievements'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pg-tab ${tab === id ? 'pg-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (!config.enabled) {
    return (
      <PageShell title="Progress">
        {tabsBar()}
        <Card>
          <p className="pg-muted">Gamification is disabled. Turn it on under Settings.</p>
          <Button variant="secondary" onClick={() => setTab('settings')}>
            Settings
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="Progress">
      {tabsBar()}

      {tab === 'dashboard' && (
        <>
          <div className="pg-hero">
            {contextBits.length > 0 && (
              <div className="pg-context">{contextBits.join(' · ')}</div>
            )}
            <div className="pg-hero__eyebrow">
              {today.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            </div>
            <div className="pg-hero__title">
              {greet}.
              <br />
              {today.dayName}.
            </div>
            <div className="pg-hero__sub">
              {profile?.effects.bannerMessage ??
                (today.isWeekend
                  ? 'Rest-day mode — spin, learn, or recover.'
                  : 'Focus on what matters today.')}
            </div>
            {config.xpEnabled && (
              <>
                <div className="pg-xp-row">
                  <span className="pg-xp-value">{snapshot.xp.toLocaleString()}</span>
                  <span className="pg-xp-label">XP · Level {level}</span>
                </div>
                <div className="pg-bar" aria-hidden>
                  <div className="pg-bar__fill" style={{ width: `${xpPct}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="pg-grid">
            <div className="pg-tile pg-tile--accent">
              <div className="pg-tile__label">Today</div>
              <div className="pg-tile__value">{todayRoutinesDone} done</div>
              <div className="pg-tile__hint">Routine completions</div>
            </div>
            <div className="pg-tile">
              <div className="pg-tile__label">Workout</div>
              <div className="pg-tile__value">
                {todayWorkout
                  ? todayWorkout.status.replace('_', ' ')
                  : today.isWeekend
                    ? 'Rest'
                    : 'Not started'}
              </div>
              <div className="pg-tile__hint">
                <Link to="/workout">Open</Link>
              </div>
            </div>
            <div className="pg-tile">
              <div className="pg-tile__label">Guitar</div>
              <div className="pg-tile__value">
                {todayGuitar.length
                  ? `${todayGuitar.reduce((s, g) => s + (g.durationMinutes || 0), 0)} min`
                  : '—'}
              </div>
              <div className="pg-tile__hint">
                <Link to="/guitar">Open</Link>
              </div>
            </div>
            <div className="pg-tile">
              <div className="pg-tile__label">Sleep</div>
              <div className="pg-tile__value">
                {todaySleep?.bedtimeHm ?? 'Not logged'}
              </div>
              <div className="pg-tile__hint">
                <Link to="/sleep">Open</Link>
              </div>
            </div>
            <div className="pg-tile">
              <div className="pg-tile__label">Money</div>
              <div className="pg-tile__value">{todayMoney.length} entries</div>
              <div className="pg-tile__hint">
                <Link to="/money">Open</Link>
              </div>
            </div>
            <div className="pg-tile">
              <div className="pg-tile__label">Best streak</div>
              <div className="pg-tile__value">{bestStreak}d</div>
              <div className="pg-tile__hint">Across tracked modules</div>
            </div>
          </div>

          {config.streaksEnabled && (
            <>
              <SectionHeader title="Streaks" />
              <div className="pg-streaks">
                {snapshot.streaks.map((s) => (
                  <div key={s.key} className="pg-streak">
                    <span>{s.label}</span>
                    <span className="pg-streak__count">{s.count}d</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {config.statsEnabled && (
            <>
              <SectionHeader title="Lifetime (real data)" />
              <div className="pg-grid">
                <div className="pg-tile">
                  <div className="pg-tile__label">Workouts</div>
                  <div className="pg-tile__value">{snapshot.metrics.workout_completed}</div>
                </div>
                <div className="pg-tile">
                  <div className="pg-tile__label">Guitar min</div>
                  <div className="pg-tile__value">{snapshot.metrics.guitar_minutes}</div>
                </div>
                <div className="pg-tile">
                  <div className="pg-tile__label">Learning min</div>
                  <div className="pg-tile__value">{snapshot.metrics.learning_minutes}</div>
                </div>
                <div className="pg-tile">
                  <div className="pg-tile__label">Bucket done</div>
                  <div className="pg-tile__value">{snapshot.metrics.bucket_done}</div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'achievements' && (
        <>
          <p className="pg-muted" style={{ marginBottom: 12 }}>
            Thresholds are configurable. Unlocks only from your logged activity — nothing invented.
          </p>
          <div className="pg-ach">
            {(defs ?? [])
              .filter((d) => d.enabled && !d.deleted)
              .sort((a, b) => a.order - b.order)
              .map((d) => {
                const unlocked = snapshot.unlockedKeys.has(d.key);
                const value =
                  (snapshot.metrics as unknown as Record<string, number>)[d.metric] ?? 0;
                return (
                  <div
                    key={d.id}
                    className={`pg-ach-card ${unlocked ? '' : 'pg-ach-card--locked'}`}
                  >
                    <div className="pg-ach-card__icon">{d.icon ?? '🏅'}</div>
                    <div>
                      <div className="pg-ach-card__title">
                        {d.title}
                        {unlocked ? ' · unlocked' : ''}
                      </div>
                      <div className="pg-ach-card__desc">
                        {d.description} · {value}/{d.threshold} · +{d.xpReward} XP
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <SectionHeader title="Edit achievements" />
          {(defs ?? []).map((d) => (
            <Card key={d.id} style={{ marginBottom: 8 }}>
              <div className="pg-field">
                <label>Title</label>
                <input
                  className="pg-input"
                  value={d.title}
                  onChange={(e) => achievementDefsRepo.update(d.id, { title: e.target.value })}
                />
              </div>
              <div className="pg-field">
                <label>Threshold</label>
                <input
                  className="pg-input"
                  type="number"
                  value={d.threshold}
                  onChange={(e) =>
                    achievementDefsRepo.update(d.id, { threshold: Number(e.target.value) })
                  }
                />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) =>
                    achievementDefsRepo.update(d.id, { enabled: e.target.checked })
                  }
                />
                Enabled
              </label>
            </Card>
          ))}
        </>
      )}

      {tab === 'settings' && (
        <Card>
          <strong>Gamification toggles</strong>
          {(
            [
              ['enabled', 'Master enable'],
              ['xpEnabled', 'XP'],
              ['streaksEnabled', 'Streaks'],
              ['achievementsEnabled', 'Achievements'],
              ['badgesEnabled', 'Badges'],
              ['statsEnabled', 'Personal statistics'],
              ['completionEnabled', 'Completion %'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="pg-field"
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <input
                type="checkbox"
                checked={Boolean(config[key])}
                onChange={(e) => saveConfig({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <p className="pg-muted" style={{ marginTop: 12 }}>
            XP is calculated from real module logs only.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
