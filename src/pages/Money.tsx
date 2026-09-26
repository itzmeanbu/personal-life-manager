import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  moneyTransactionsRepo,
  lendingRecordsRepo,
  borrowingRecordsRepo,
} from '../data/repository';
import type {
  MoneyTransaction,
  LendingRecord,
  BorrowingRecord,
  MoneyPaidBy,
} from '../data/types';
import { toIsoDate } from '../routine/engine';
import {
  getMoneyConfig,
  setMoneyConfig,
  type MoneyConfig,
  DEFAULT_MONEY_CONFIG,
} from '../money/settings';
import {
  summarizeDay,
  outstandingLending,
  outstandingBorrowing,
  formatInr,
  myCashOut,
} from '../money/stats';
import '../money/money.css';

type Tab = 'daily' | 'lending' | 'borrowing' | 'settings';

export default function Money() {
  const [tab, setTab] = useState<Tab>('daily');
  const [config, setConfig] = useState<MoneyConfig>(DEFAULT_MONEY_CONFIG);
  const [busy, setBusy] = useState(false);

  // Daily form
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('bus');
  const [paidBy, setPaidBy] = useState<MoneyPaidBy>('self');
  const [personName, setPersonName] = useState('');
  const [myShare, setMyShare] = useState('');
  const [note, setNote] = useState('');
  const [startingInput, setStartingInput] = useState('');

  // Lending / borrowing forms
  const [lbPerson, setLbPerson] = useState('');
  const [lbAmount, setLbAmount] = useState('');
  const [lbNotes, setLbNotes] = useState('');
  const [partialAmount, setPartialAmount] = useState<Record<string, string>>({});

  const todayIso = toIsoDate(new Date());

  useEffect(() => {
    getMoneyConfig().then((c) => {
      setConfig(c);
      setStartingInput(String(c.dailyBudget));
    });
  }, []);

  const txs = useLiveQuery(() => moneyTransactionsRepo.list(), []);
  const lending = useLiveQuery(() => lendingRecordsRepo.list(), []);
  const borrowing = useLiveQuery(() => borrowingRecordsRepo.list(), []);

  const day = useMemo(
    () => summarizeDay(txs ?? [], todayIso, config.dailyBudget),
    [txs, todayIso, config.dailyBudget]
  );

  const lendOutstanding = useMemo(
    () => outstandingLending(lending ?? []),
    [lending]
  );
  const borrowOutstanding = useMemo(
    () => outstandingBorrowing(borrowing ?? []),
    [borrowing]
  );

  const setStarting = async () => {
    const n = Number(startingInput);
    if (Number.isNaN(n) || n < 0) return;
    setBusy(true);
    try {
      // Replace prior starting rows for today
      for (const t of day.transactions.filter((x) => x.type === 'starting')) {
        await moneyTransactionsRepo.remove(t.id, true);
      }
      await moneyTransactionsRepo.create({
        date: todayIso,
        type: 'starting',
        amount: n,
        note: 'Starting money',
      });
    } finally {
      setBusy(false);
    }
  };

  const addExpense = async () => {
    const n = Number(amount);
    if (Number.isNaN(n) || n <= 0) return;
    setBusy(true);
    try {
      await moneyTransactionsRepo.create({
        date: todayIso,
        type: 'expense',
        amount: n,
        category: category.trim() || 'custom',
        note: note.trim() || undefined,
        paidBy,
        personName:
          paidBy === 'friend' || paidBy === 'split'
            ? personName.trim() || undefined
            : undefined,
        myShare:
          paidBy === 'split' && myShare !== '' && !Number.isNaN(Number(myShare))
            ? Number(myShare)
            : undefined,
      });
      setAmount('');
      setNote('');
      setMyShare('');
    } finally {
      setBusy(false);
    }
  };

  const removeTx = async (id: string) => {
    await moneyTransactionsRepo.remove(id, true);
  };

  const addLending = async () => {
    const n = Number(lbAmount);
    if (!lbPerson.trim() || Number.isNaN(n) || n <= 0) return;
    setBusy(true);
    try {
      await lendingRecordsRepo.create({
        date: todayIso,
        personName: lbPerson.trim(),
        amount: n,
        amountRepaid: 0,
        status: 'outstanding',
        notes: lbNotes.trim() || undefined,
      });
      setLbPerson('');
      setLbAmount('');
      setLbNotes('');
    } finally {
      setBusy(false);
    }
  };

  const addBorrowing = async () => {
    const n = Number(lbAmount);
    if (!lbPerson.trim() || Number.isNaN(n) || n <= 0) return;
    setBusy(true);
    try {
      await borrowingRecordsRepo.create({
        date: todayIso,
        personName: lbPerson.trim(),
        amount: n,
        amountRepaid: 0,
        status: 'outstanding',
        notes: lbNotes.trim() || undefined,
      });
      setLbPerson('');
      setLbAmount('');
      setLbNotes('');
    } finally {
      setBusy(false);
    }
  };

  const applyPartialLending = async (row: LendingRecord) => {
    const add = Number(partialAmount[row.id] ?? '');
    if (Number.isNaN(add) || add <= 0) return;
    const repaid = Math.min(row.amount, (row.amountRepaid ?? 0) + add);
    const status =
      repaid >= row.amount ? 'settled' : repaid > 0 ? 'partial' : 'outstanding';
    await lendingRecordsRepo.update(row.id, {
      amountRepaid: repaid,
      status,
      settledDate: status === 'settled' ? todayIso : undefined,
    });
    setPartialAmount((p) => ({ ...p, [row.id]: '' }));
  };

  const applyPartialBorrowing = async (row: BorrowingRecord) => {
    const add = Number(partialAmount[row.id] ?? '');
    if (Number.isNaN(add) || add <= 0) return;
    const repaid = Math.min(row.amount, (row.amountRepaid ?? 0) + add);
    const status =
      repaid >= row.amount ? 'settled' : repaid > 0 ? 'partial' : 'outstanding';
    await borrowingRecordsRepo.update(row.id, {
      amountRepaid: repaid,
      status,
      settledDate: status === 'settled' ? todayIso : undefined,
    });
    setPartialAmount((p) => ({ ...p, [row.id]: '' }));
  };

  const markSettledLending = async (row: LendingRecord) => {
    await lendingRecordsRepo.update(row.id, {
      amountRepaid: row.amount,
      status: 'settled',
      settledDate: todayIso,
    });
  };

  const markSettledBorrowing = async (row: BorrowingRecord) => {
    await borrowingRecordsRepo.update(row.id, {
      amountRepaid: row.amount,
      status: 'settled',
      settledDate: todayIso,
    });
  };

  const saveConfig = async (patch: Partial<MoneyConfig>) => {
    const next = await setMoneyConfig(patch);
    setConfig(next);
  };

  const sym = config.currencySymbol;

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'daily', label: 'Daily' },
      { id: 'lending', label: 'Lending' },
      { id: 'borrowing', label: 'Borrowing' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="mo-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mo-tab ${tab === t.id ? 'mo-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  function paidByLabel(t: MoneyTransaction): string {
    if (t.type !== 'expense') return t.type;
    if (t.paidBy === 'friend') return `friend paid${t.personName ? ` (${t.personName})` : ''}`;
    if (t.paidBy === 'split')
      return `split${t.personName ? ` w/ ${t.personName}` : ''} · my share ${formatInr(t.myShare ?? t.amount, sym)}`;
    return 'I paid';
  }

  return (
    <PageShell title="Money">
      {tabsBar()}

      {tab === 'daily' && (
        <>
          <div className="mo-stat-grid">
            <div className="mo-stat">
              <div className="mo-stat__value">{formatInr(day.starting, sym)}</div>
              <div className="mo-stat__label">Starting</div>
            </div>
            <div className="mo-stat">
              <div className="mo-stat__value">{formatInr(day.expensesMyShare, sym)}</div>
              <div className="mo-stat__label">My expenses</div>
            </div>
            <div className="mo-stat">
              <div className="mo-stat__value">{formatInr(day.remaining, sym)}</div>
              <div className="mo-stat__label">Remaining</div>
            </div>
            <div className="mo-stat">
              <div className="mo-stat__value">{formatInr(config.dailyBudget, sym)}</div>
              <div className="mo-stat__label">Default budget</div>
            </div>
          </div>

          <Card>
            <strong>Starting money today</strong>
            <p className="mo-muted">
              Default budget {formatInr(config.dailyBudget, sym)}/day (editable). Set an explicit
              start if different.
            </p>
            <div className="mo-field">
              <label>Starting amount</label>
              <input
                className="mo-input"
                type="number"
                value={startingInput}
                onChange={(e) => setStartingInput(e.target.value)}
              />
            </div>
            <Button variant="secondary" disabled={busy} onClick={setStarting}>
              Set starting
            </Button>
          </Card>

          <Card>
            <strong>Add expense</strong>
            <div className="mo-field">
              <label>Amount</label>
              <input
                className="mo-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="40"
              />
            </div>
            <div className="mo-field">
              <label>Category</label>
              <input
                className="mo-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <div className="mo-chips">
                {config.expenseCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`mo-chip ${category === c ? 'mo-chip--on' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="mo-field">
              <label>Who paid? (never assumed)</label>
              <div className="mo-chips">
                {(
                  [
                    ['self', 'I paid'],
                    ['friend', 'Friend paid'],
                    ['split', 'Split bill'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`mo-chip ${paidBy === k ? 'mo-chip--on' : ''}`}
                    onClick={() => setPaidBy(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(paidBy === 'friend' || paidBy === 'split') && (
              <div className="mo-field">
                <label>Person</label>
                <input
                  className="mo-input"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Name"
                />
              </div>
            )}
            {paidBy === 'split' && (
              <div className="mo-field">
                <label>My share (optional — defaults to full amount)</label>
                <input
                  className="mo-input"
                  type="number"
                  value={myShare}
                  onChange={(e) => setMyShare(e.target.value)}
                />
              </div>
            )}
            <div className="mo-field">
              <label>Notes</label>
              <input className="mo-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button variant="primary" disabled={busy || !amount} onClick={addExpense}>
              Add expense
            </Button>
            <p className="mo-muted">
              Friend paid does not reduce remaining. Split uses my share only.
            </p>
          </Card>

          <SectionHeader title="Today’s log" />
          {day.transactions.length === 0 ? (
            <EmptyState
              icon="💰"
              title="No entries today"
              description={`Remaining uses default starting ${formatInr(config.dailyBudget, sym)} until you set one.`}
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {day.transactions.map((t, i) => (
                <div
                  key={t.id}
                  className="mo-row"
                  style={{
                    borderBottom:
                      i < day.transactions.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t.type === 'starting'
                        ? `Starting ${formatInr(t.amount, sym)}`
                        : t.type === 'income'
                          ? `+${formatInr(t.amount, sym)}`
                          : `${t.category ?? 'expense'} ${formatInr(t.amount, sym)}`}
                    </div>
                    <div className="mo-muted">
                      {paidByLabel(t)}
                      {t.type === 'expense' && t.paidBy !== 'friend'
                        ? ` · cash out ${formatInr(myCashOut(t), sym)}`
                        : ''}
                      {t.note ? ` · ${t.note}` : ''}
                    </div>
                  </div>
                  <button type="button" className="mo-link" onClick={() => removeTx(t.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'lending' && (
        <>
          <Card>
            <strong>Money others borrowed from me</strong>
            <p className="mo-muted">
              Outstanding: {formatInr(lendOutstanding, sym)}. Separate from daily expenses.
            </p>
            <div className="mo-field">
              <label>Person</label>
              <input
                className="mo-input"
                value={lbPerson}
                onChange={(e) => setLbPerson(e.target.value)}
              />
            </div>
            <div className="mo-field">
              <label>Amount</label>
              <input
                className="mo-input"
                type="number"
                value={lbAmount}
                onChange={(e) => setLbAmount(e.target.value)}
              />
            </div>
            <div className="mo-field">
              <label>Notes</label>
              <input
                className="mo-input"
                value={lbNotes}
                onChange={(e) => setLbNotes(e.target.value)}
              />
            </div>
            <Button variant="primary" disabled={busy} onClick={addLending}>
              Add lending
            </Button>
          </Card>
          <SectionHeader title="Records" />
          {(lending ?? []).filter((r) => !r.deleted).length === 0 ? (
            <EmptyState icon="🤝" title="No lending records" description="Add when someone borrows from you." />
          ) : (
            <Card style={{ padding: 0 }}>
              {(lending ?? [])
                .filter((r) => !r.deleted)
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((r, i, arr) => (
                  <div
                    key={r.id}
                    className="mo-row"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {r.personName} · {formatInr(r.amount, sym)}
                        </div>
                        <div className="mo-muted">
                          {r.date}
                          {r.notes ? ` · ${r.notes}` : ''} · repaid{' '}
                          {formatInr(r.amountRepaid ?? 0, sym)}
                        </div>
                      </div>
                      <span className={`mo-badge mo-badge--${r.status}`}>{r.status}</span>
                    </div>
                    {r.status !== 'settled' && (
                      <div className="mo-actions">
                        <input
                          className="mo-input"
                          style={{ maxWidth: 120 }}
                          type="number"
                          placeholder="Partial"
                          value={partialAmount[r.id] ?? ''}
                          onChange={(e) =>
                            setPartialAmount((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                        />
                        <Button variant="secondary" onClick={() => applyPartialLending(r)}>
                          Partial pay
                        </Button>
                        <Button variant="ghost" onClick={() => markSettledLending(r)}>
                          Mark paid
                        </Button>
                        <button
                          type="button"
                          className="mo-link"
                          onClick={() => lendingRecordsRepo.remove(r.id, true)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </Card>
          )}
        </>
      )}

      {tab === 'borrowing' && (
        <>
          <Card>
            <strong>Money I borrowed</strong>
            <p className="mo-muted">
              Outstanding: {formatInr(borrowOutstanding, sym)}. Separate from daily expenses.
            </p>
            <div className="mo-field">
              <label>Person</label>
              <input
                className="mo-input"
                value={lbPerson}
                onChange={(e) => setLbPerson(e.target.value)}
              />
            </div>
            <div className="mo-field">
              <label>Amount</label>
              <input
                className="mo-input"
                type="number"
                value={lbAmount}
                onChange={(e) => setLbAmount(e.target.value)}
              />
            </div>
            <div className="mo-field">
              <label>Notes</label>
              <input
                className="mo-input"
                value={lbNotes}
                onChange={(e) => setLbNotes(e.target.value)}
              />
            </div>
            <Button variant="primary" disabled={busy} onClick={addBorrowing}>
              Add borrowing
            </Button>
          </Card>
          <SectionHeader title="Records" />
          {(borrowing ?? []).filter((r) => !r.deleted).length === 0 ? (
            <EmptyState icon="📥" title="No borrowing records" description="Add when you borrow." />
          ) : (
            <Card style={{ padding: 0 }}>
              {(borrowing ?? [])
                .filter((r) => !r.deleted)
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((r, i, arr) => (
                  <div
                    key={r.id}
                    className="mo-row"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {r.personName} · {formatInr(r.amount, sym)}
                        </div>
                        <div className="mo-muted">
                          {r.date}
                          {r.notes ? ` · ${r.notes}` : ''} · paid back{' '}
                          {formatInr(r.amountRepaid ?? 0, sym)}
                        </div>
                      </div>
                      <span className={`mo-badge mo-badge--${r.status}`}>{r.status}</span>
                    </div>
                    {r.status !== 'settled' && (
                      <div className="mo-actions">
                        <input
                          className="mo-input"
                          style={{ maxWidth: 120 }}
                          type="number"
                          placeholder="Partial"
                          value={partialAmount[r.id] ?? ''}
                          onChange={(e) =>
                            setPartialAmount((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                        />
                        <Button variant="secondary" onClick={() => applyPartialBorrowing(r)}>
                          Partial pay
                        </Button>
                        <Button variant="ghost" onClick={() => markSettledBorrowing(r)}>
                          Mark paid
                        </Button>
                        <button
                          type="button"
                          className="mo-link"
                          onClick={() => borrowingRecordsRepo.remove(r.id, true)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </Card>
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Money settings" />
          <Card>
            <label className="mo-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => saveConfig({ enabled: e.target.checked })}
              />
              Enabled
            </label>
            <div className="mo-field">
              <label>Daily budget / transport default (₹)</label>
              <input
                className="mo-input"
                type="number"
                value={config.dailyBudget}
                onChange={(e) => saveConfig({ dailyBudget: Number(e.target.value) })}
              />
            </div>
            <div className="mo-field">
              <label>Currency symbol</label>
              <input
                className="mo-input"
                value={config.currencySymbol}
                onChange={(e) => saveConfig({ currencySymbol: e.target.value })}
              />
            </div>
            <div className="mo-field">
              <label>Expense categories (comma-separated)</label>
              <input
                className="mo-input"
                value={config.expenseCategories.join(', ')}
                onChange={(e) =>
                  saveConfig({
                    expenseCategories: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </Card>
        </>
      )}
    </PageShell>
  );
}
