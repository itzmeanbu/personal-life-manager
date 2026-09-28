/**
 * Day order (college 1–6) + live class from RVS timetable.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import { formatHm12 } from '../lib/timeFormat';
import {
  currentTimeSlot,
  liveClassLine,
  scheduleForDayOrder,
  formatMinHm,
} from '../college/timetable';
import { checkPeriodTransition } from '../college/periodNotify';
import { forceRebuildToday } from './migrateWeekend';
import {
  getDayOrderForDate,
  setDayOrderForDate,
  suggestNextDayOrder,
} from '../college/dayOrder';
import {
  effectiveDayStatus,
  setDayStatus,
  DAY_STATUS_OPTIONS,
  type TomorrowDayOrder,
} from './spendPrompts';
import { collegeDayStatusesRepo, moneyTransactionsRepo } from '../data/repository';
import { summarizeDay, formatInr } from '../money/stats';
import { getMoneyConfig, DEFAULT_MONEY_CONFIG } from '../money/settings';
import { useLiveQuery } from 'dexie-react-hooks';

function modeLabel(
  order: TomorrowDayOrder | 'attended' | 'bunked' | 'left_early' | 'none' | null
): string {
  if (order === 'college' || order === 'attended') return '🎓 College day';
  if (order === 'bunk' || order === 'bunked') return '🏃 College: bunked';
  if (order === 'didnt_go') return "🙈 College: didn't go";
  if (order === 'left_early') return '🚪 College: left early';
  if (order === 'coding') return '💻 Coding day — no guitar / workout / spin';
  if (order === 'leave') return '🏠 Leave / holiday';
  if (order === 'coimbatore_stay') return '🌆 Coimbatore stay';
  return 'Mode not set';
}

export function PeriodBoard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [tick, setTick] = useState(0);
  const [dayOrder, setDayOrder] = useState<number | null>(null);
  const [fromNight, setFromNight] = useState<TomorrowDayOrder | null>(null);
  const [picking, setPicking] = useState(false);

  const reload = useCallback(async () => {
    setDayOrder(await getDayOrderForDate(iso));
    setFromNight(await effectiveDayStatus(iso));
  }, [iso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const college = useLiveQuery(async () => {
    const rows = await collegeDayStatusesRepo.list();
    return rows.find((d) => d.date === iso && !d.deleted) ?? null;
  }, [iso]);

  const moneyConfig = useLiveQuery(() => getMoneyConfig(), [], DEFAULT_MONEY_CONFIG);
  const txs = useLiveQuery(() => moneyTransactionsRepo.list(), []);

  void tick;
  const slot = currentTimeSlot(new Date());

  const statusFromCollege =
    college?.status === 'bunked'
      ? 'bunked'
      : college?.status === 'left_early'
        ? 'left_early'
        : college?.status === 'attended'
          ? 'attended'
          : null;
  const mode: TomorrowDayOrder | 'attended' | 'bunked' | 'left_early' | 'none' | null =
    fromNight && fromNight !== 'unset' ? fromNight : statusFromCollege;

  const attending = mode === 'college' || mode === 'attended';

  // Full bunk skips timetable; left_early still shows morning periods as normal
  const showTimetable =
    mode !== 'bunk' &&
    mode !== 'bunked' &&
    mode !== 'didnt_go' &&
    mode !== 'coding' &&
    mode !== 'leave' &&
    mode !== 'coimbatore_stay';

  const pickOrder = async (n: number) => {
    await setDayOrderForDate(iso, n);
    setDayOrder(n);
    setPicking(false);
  };

  const suggest = async () => {
    const n = await suggestNextDayOrder(iso);
    await pickOrder(n);
  };

  const setStatus = async (order: TomorrowDayOrder) => {
    await setDayStatus(iso, order);
    await forceRebuildToday(date);
    await reload();
    window.dispatchEvent(new Event('day-status-changed'));
  };

  // Live period notifications — only while actually attending today.
  useEffect(() => {
    if (!attending || !dayOrder) return;
    void checkPeriodTransition(dayOrder, new Date());
  }, [attending, dayOrder, tick]);

  const schedule = dayOrder ? scheduleForDayOrder(dayOrder) : [];

  const daySpend =
    txs && moneyConfig
      ? summarizeDay(txs, iso, moneyConfig.dailyBudget)
      : null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <strong>Day order & class</strong>
      <p style={{ margin: '6px 0 8px', fontSize: 'var(--text-sm)' }}>
        {modeLabel(mode)}
        {fromNight && fromNight !== 'unset' && (
          <span style={{ color: 'var(--color-text-secondary)' }}> · set last night</span>
        )}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 10,
        }}
      >
        {DAY_STATUS_OPTIONS.map((o) => (
          <Button
            key={o.id}
            variant={fromNight === o.id ? 'primary' : 'secondary'}
            onClick={() => setStatus(o.id)}
          >
            {o.emoji} {o.label}
          </Button>
        ))}
      </div>

      {slot && (slot.kind === 'break' || slot.kind === 'lunch') && daySpend && (
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 'var(--text-sm)',
            padding: '6px 10px',
            borderRadius: 8,
            background: 'var(--color-surface-2, var(--color-surface))',
            border: '1px solid var(--color-border)',
          }}
        >
          Spent today: <strong>{formatInr(daySpend.expensesMyShare, moneyConfig?.currencySymbol)}</strong>
        </p>
      )}

      {showTimetable && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Day order
            </span>
            {dayOrder ? (
              <strong style={{ fontSize: '1.25rem' }}>{dayOrder}</strong>
            ) : (
              <span style={{ color: 'var(--color-text-secondary)' }}>not set (pick once)</span>
            )}
            {dayOrder ? (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                · auto-advances next day until you change
              </span>
            ) : null}
            <Button variant="secondary" onClick={() => setPicking((v) => !v)}>
              {dayOrder ? 'Change' : 'Set 1–6'}
            </Button>
            {!dayOrder && (
              <Button variant="ghost" onClick={suggest}>
                Suggest next
              </Button>
            )}
          </div>

          {picking && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Button
                  key={n}
                  variant={dayOrder === n ? 'primary' : 'secondary'}
                  onClick={() => pickOrder(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          )}

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--color-surface-2, var(--color-surface))',
              border: '1px solid var(--color-border)',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Live now
            </div>
            {dayOrder ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 2 }}>
                  {liveClassLine(dayOrder, new Date())}
                </div>
                {slot && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {formatHm12(formatMinHm(slot.startMin))} –{' '}
                    {formatHm12(formatMinHm(slot.endMin))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                Set day order (1–6) to see which class you&apos;re in.
              </div>
            )}
          </div>

          {dayOrder && (
            <div style={{ fontSize: 'var(--text-sm)' }}>
              <strong>Today&apos;s timetable (order {dayOrder})</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {schedule.map(({ slot: s, line }) => {
                  const active = slot?.id === s.id;
                  return (
                    <li
                      key={s.id}
                      style={{
                        fontWeight: active ? 700 : 400,
                        color: active ? 'var(--color-accent, inherit)' : undefined,
                        marginBottom: 2,
                      }}
                    >
                      {formatHm12(formatMinHm(s.startMin))} {s.label}: {line}
                      {active ? ' ← now' : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {(mode === 'bunk' || mode === 'bunked' || mode === 'didnt_go') && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {mode === 'didnt_go' ? "Didn't go" : 'Bunk day'} — timetable hidden. Same as a bunk day
          for everything else; only the history label is different.
        </p>
      )}
    </Card>
  );
}
