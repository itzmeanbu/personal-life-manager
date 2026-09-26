import type { MoneyTransaction, LendingRecord, BorrowingRecord } from '../data/types';

/** Amount that reduces my remaining cash for the day. */
export function myCashOut(tx: MoneyTransaction): number {
  if (tx.type === 'starting' || tx.type === 'income') return 0;
  if (tx.paidBy === 'friend') return 0; // friend paid — not my remaining
  if (tx.paidBy === 'split') return tx.myShare ?? tx.amount;
  // self or unset → full amount from my pocket
  return tx.amount;
}

export interface DayMoneySummary {
  date: string;
  starting: number;
  income: number;
  expensesMyShare: number;
  remaining: number;
  transactions: MoneyTransaction[];
}

export function summarizeDay(
  all: MoneyTransaction[],
  date: string,
  defaultStarting: number
): DayMoneySummary {
  const txs = all
    .filter((t) => !t.deleted && t.date === date)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const startingRows = txs.filter((t) => t.type === 'starting');
  const starting =
    startingRows.length > 0
      ? startingRows.reduce((s, t) => s + t.amount, 0)
      : defaultStarting;

  let income = 0;
  let expensesMyShare = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expensesMyShare += myCashOut(t);
  }

  // If user logged starting explicitly, remaining = starting + income - expenses
  // If not, still use defaultStarting as virtual start
  const remaining = starting + income - expensesMyShare;

  return { date, starting, income, expensesMyShare, remaining, transactions: txs };
}

export function outstandingLending(rows: LendingRecord[]): number {
  return rows
    .filter((r) => !r.deleted && r.status !== 'settled')
    .reduce((s, r) => s + Math.max(0, r.amount - (r.amountRepaid ?? 0)), 0);
}

export function outstandingBorrowing(rows: BorrowingRecord[]): number {
  return rows
    .filter((r) => !r.deleted && r.status !== 'settled')
    .reduce((s, r) => s + Math.max(0, r.amount - (r.amountRepaid ?? 0)), 0);
}

export function formatInr(n: number, symbol = '₹'): string {
  const rounded = Math.round(n * 100) / 100;
  return `${symbol}${rounded}`;
}
