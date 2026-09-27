/**
 * Today's total spend on Day Brief (from moneyTransactions).
 */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { moneyTransactionsRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { summarizeDay, formatInr } from '../money/stats';
import { getMoneyConfig, DEFAULT_MONEY_CONFIG } from '../money/settings';
import { useEffect, useState } from 'react';

export function DaySpendSummary({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [budget, setBudget] = useState(DEFAULT_MONEY_CONFIG.dailyBudget);
  const [sym, setSym] = useState(DEFAULT_MONEY_CONFIG.currencySymbol);

  useEffect(() => {
    getMoneyConfig().then((c) => {
      setBudget(c.dailyBudget);
      setSym(c.currencySymbol);
    });
  }, []);

  const txs = useLiveQuery(() => moneyTransactionsRepo.list(), []);
  const day = useMemo(
    () => summarizeDay(txs ?? [], iso, budget),
    [txs, iso, budget]
  );

  const expenses = day.transactions.filter((t) => t.type === 'expense');

  return (
    <Card style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <strong>💸 Today&apos;s spend</strong>
        <span style={{ fontSize: 'var(--text-lg, 1.1rem)', fontWeight: 700 }}>
          {formatInr(day.expensesMyShare, sym)}
        </span>
      </div>
      <p
        style={{
          margin: '4px 0 8px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Remaining ~ {formatInr(day.remaining, sym)} of {formatInr(day.starting, sym)} start
      </p>
      {expenses.length > 0 && (
        <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 'var(--text-sm)' }}>
          {expenses.slice(-8).map((t) => (
            <li key={t.id}>
              {t.category ?? 'expense'} · {formatInr(t.amount, sym)}
              {t.note ? ` · ${t.note}` : ''}
            </li>
          ))}
        </ul>
      )}
      <Link to="/money">
        <Button variant="ghost">Open Money</Button>
      </Link>
    </Card>
  );
}
