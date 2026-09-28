import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { completionRecordsRepo, moneyTransactionsRepo, spinHistoriesRepo, workoutSessionsRepo, guitarSessionsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { getDemoDate } from '../demo/DemoTools';
import '../styles/insights.css';

export default function Insights() {
  const now = getDemoDate(); const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const completions = useLiveQuery(() => completionRecordsRepo.list(), [], []);
  const money = useLiveQuery(() => moneyTransactionsRepo.list(), [], []);
  const spins = useLiveQuery(() => spinHistoriesRepo.list(), [], []);
  const workouts = useLiveQuery(() => workoutSessionsRepo.list(), [], []);
  const guitar = useLiveQuery(() => guitarSessionsRepo.list(), [], []);
  const monthSpend = useMemo(() => (money ?? []).filter(t=>t.type==='expense'&&t.date>=monthStart).reduce((s,t)=>s+(t.myShare??t.amount),0), [money, monthStart]);
  const monthDone = useMemo(() => (completions ?? []).filter(c=>c.date>=monthStart&&c.status==='done').length, [completions, monthStart]);
  const spinMinutes = useMemo(() => (spins ?? []).filter(s=>s.date>=monthStart&&s.completed).reduce((n,s)=>n+(s.actualMinutes??s.durationMinutes??0),0), [spins, monthStart]);
  const workoutMinutes = useMemo(() => (workouts ?? []).filter(w=>w.date>=monthStart&&w.status==='completed').reduce((n,w)=>n+(w.durationMinutes??0),0), [workouts, monthStart]);
  const guitarMinutes = useMemo(() => (guitar ?? []).filter(g=>g.date>=monthStart&&g.status!=='skipped').reduce((n,g)=>n+g.durationMinutes,0), [guitar, monthStart]);
  return <PageShell title="Insights" showBack={false}><p style={{color:'var(--color-text-secondary)',marginBottom:14}}>A professional view of how you spend time and money. Month-to-date.</p><div className="insight-grid"><Card><span>Spending</span><strong>₹{monthSpend.toFixed(0)}</strong><small>this month</small></Card><Card><span>Completed</span><strong>{monthDone}</strong><small>routine phases</small></Card><Card><span>Workout</span><strong>{workoutMinutes}m</strong><small>completed</small></Card><Card><span>Guitar</span><strong>{guitarMinutes}m</strong><small>practice</small></Card><Card><span>Spin</span><strong>{spinMinutes}m</strong><small>free-time activities</small></Card></div></PageShell>;
}
