import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { moneyTransactionsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { getDemoDate } from '../demo/DemoTools';
import '../money/money.css';

type Range = 'day' | 'week' | 'month' | 'year';
function startFor(range: Range, now: Date) { const d = new Date(now); if (range === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate()); if (range === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1); return new Date(d.getFullYear(), 0, 1); }

export default function Spending() {
  const [range, setRange] = useState<Range>('month');
  const txs = useLiveQuery(() => moneyTransactionsRepo.list(), [], []);
  const now = getDemoDate(); const start = toIsoDate(startFor(range, now)); const end = toIsoDate(now);
  const rows = useMemo(() => (txs ?? []).filter((t) => !t.deleted && t.type === 'expense' && t.date >= start && t.date <= end), [txs, start, end]);
  const total = rows.reduce((s, t) => s + (t.myShare ?? t.amount), 0);
  const categories = useMemo(() => Object.entries(rows.reduce<Record<string, number>>((a, t) => { const k = t.category ?? 'Other'; a[k] = (a[k] ?? 0) + (t.myShare ?? t.amount); return a; }, {})).sort((a, b) => b[1] - a[1]), [rows]);
  return <PageShell title="Spending" showBack={false} right={<Link to="/money"><Button variant="ghost">Manage</Button></Link>}>
    <div className="log-range">{(['day','week','month','year'] as Range[]).map((r) => <Button key={r} variant={range === r ? 'primary' : 'secondary'} onClick={() => setRange(r)}>{r === 'day' ? 'Today' : r[0].toUpperCase()+r.slice(1)}</Button>)}</div>
    <Card><div style={{color:'var(--color-text-secondary)'}}>Total spending</div><div style={{fontSize:38,fontWeight:800}}>₹{total.toFixed(0)}</div><div style={{color:'var(--color-text-secondary)'}}>{rows.length} transactions</div></Card>
    <Card><strong>Categories</strong>{categories.map(([k,v]) => <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--color-border)'}}><span>{k}</span><strong>₹{v.toFixed(0)}</strong></div>)}</Card>
    <Card><strong>Every transaction</strong>{rows.sort((a,b)=>b.date.localeCompare(a.date)).map(t => <div key={t.id} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'12px 0',borderBottom:'1px solid var(--color-border)'}}><div><strong>{t.category ?? 'Other'}</strong><div style={{color:'var(--color-text-secondary)',fontSize:13}}>{t.date}{t.note ? ` · ${t.note}` : ''}</div></div><strong>₹{(t.myShare ?? t.amount).toFixed(0)}</strong></div>)}{rows.length===0 && <p style={{color:'var(--color-text-secondary)',marginTop:10}}>No spending recorded in this range.</p>}</Card>
  </PageShell>;
}
