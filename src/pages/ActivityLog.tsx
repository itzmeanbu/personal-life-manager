import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  completionRecordsRepo,
  routinesRepo,
  moneyTransactionsRepo,
  spinHistoriesRepo,
  workoutSessionsRepo,
  guitarSessionsRepo,
  sleepRecordsRepo,
  collegeDayStatusesRepo,
} from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { getDemoDate } from '../demo/DemoTools';
import { formatIsoTime12 } from '../lib/timeFormat';
import './activity-log.css';

type Range = 'day' | 'week' | 'month' | 'year';
type Entry = { at: string; title: string; detail: string; kind: string; amount?: number };

function startFor(range: Range, now: Date): Date {
  const d = new Date(now);
  if (range === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (range === 'week') {
    const day = d.getDay();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  }
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

export default function ActivityLog() {
  const [range, setRange] = useState<Range>('day');
  const now = getDemoDate();
  const start = startFor(range, now);
  const startIso = toIsoDate(start);
  const endIso = toIsoDate(now);
  const [expanded, setExpanded] = useState(false);

  const completions = useLiveQuery(() => completionRecordsRepo.list(), [], []);
  const routines = useLiveQuery(() => routinesRepo.list(), [], []);
  const money = useLiveQuery(() => moneyTransactionsRepo.list(), [], []);
  const spins = useLiveQuery(() => spinHistoriesRepo.list(), [], []);
  const workouts = useLiveQuery(() => workoutSessionsRepo.list(), [], []);
  const guitars = useLiveQuery(() => guitarSessionsRepo.list(), [], []);
  const sleep = useLiveQuery(() => sleepRecordsRepo.list(), [], []);
  const college = useLiveQuery(() => collegeDayStatusesRepo.list(), [], []);

  const inRange = (date: string) => date >= startIso && date <= endIso;
  const entries = useMemo<Entry[]>(() => {
    const rows: Entry[] = [];
    const routineMap = new Map((routines ?? []).map((r) => [r.id, r]));
    for (const c of completions ?? []) {
      if (!inRange(c.date)) continue;
      const r = c.refType === 'routine' ? routineMap.get(c.refId) : undefined;
      rows.push({ at: c.date, title: r?.title ?? c.refId, detail: `${c.status}${r?.durationMinutes ? ` · ${r.durationMinutes} min` : ''}`, kind: 'Routine' });
    }
    for (const s of spins ?? []) if (inRange(s.date) && s.completed) rows.push({ at: s.endedAt ?? s.startedAt ?? s.date, title: s.optionLabel, detail: `${s.actualMinutes ?? s.durationMinutes ?? 0} min · ${s.wheelName}`, kind: 'Spin' });
    for (const w of workouts ?? []) if (inRange(w.date) && w.status === 'completed') rows.push({ at: w.endedAt ?? w.startedAt ?? w.date, title: w.title, detail: `${w.durationMinutes ?? 0} min workout`, kind: 'Workout' });
    for (const g of guitars ?? []) if (inRange(g.date) && g.status !== 'skipped') rows.push({ at: g.date, title: 'Guitar practice', detail: `${g.durationMinutes} min${g.songOrPiece ? ` · ${g.songOrPiece}` : ''}`, kind: 'Guitar' });
    for (const s of sleep ?? []) if (inRange(s.date)) rows.push({ at: s.date, title: 'Sleep', detail: `${s.bedtimeHm ?? '—'} → ${s.wakeHm ?? '—'}`, kind: 'Sleep' });
    for (const c of college ?? []) if (inRange(c.date) && c.status !== 'none') rows.push({ at: c.date, title: c.status === 'bunked' ? 'Bunk / early departure' : 'College attendance', detail: c.homeArrivalTime ? `Home around ${c.homeArrivalTime}` : 'Recorded', kind: 'College' });
    for (const m of money ?? []) if (inRange(m.date) && m.type === 'expense') rows.push({ at: m.date, title: m.category ?? 'Expense', detail: m.note ?? 'Expense recorded', kind: 'Spending', amount: m.myShare ?? m.amount });
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [completions, routines, money, spins, workouts, guitars, sleep, college, startIso, endIso]);

  const visible = expanded ? entries : entries.slice(0, 30);
  const spend = entries.filter((e) => e.amount != null).reduce((s, e) => s + (e.amount ?? 0), 0);

  return (
    <PageShell title="Activity Log" showBack={false}>
      <div className="log-range">
        {(['day', 'week', 'month', 'year'] as Range[]).map((r) => <Button key={r} variant={range === r ? 'primary' : 'secondary'} onClick={() => setRange(r)}>{r === 'day' ? 'Today' : r[0].toUpperCase() + r.slice(1)}</Button>)}
      </div>
      <Card className="log-summary"><strong>{entries.length}</strong><span> recorded activities</span><b>₹{spend.toFixed(0)}</b><span> spending in range</span></Card>
      {visible.map((e, i) => <div className="log-row" key={`${e.kind}-${e.at}-${e.title}-${i}`}><div className="log-dot" /><div><strong>{e.title}</strong><div>{e.kind} · {e.detail}</div><small>{e.at.includes('T') ? formatIsoTime12(e.at) : e.at}</small></div>{e.amount != null && <strong>₹{e.amount.toFixed(0)}</strong>}</div>)}
      {entries.length > 30 && <Button variant="secondary" onClick={() => setExpanded((v) => !v)}>{expanded ? 'Show less' : `Show all ${entries.length}`}</Button>}
      {entries.length === 0 && <Card>No records in this period yet.</Card>}
    </PageShell>
  );
}
