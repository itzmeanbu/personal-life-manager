/**
 * Timed spend asks on Day Brief — Yes/No then amount when needed.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { toIsoDate } from '../routine/engine';
import {
  getSpendPromptsState,
  activeSpendPrompts,
  answerSpendNo,
  answerSpendAmount,
  markNotified,
  SPEND_PROMPTS,
  type SpendPromptDef,
  type SpendPromptsState,
  type SpendPromptId,
} from './spendPrompts';

export function SpendPromptsCard({ date = new Date() }: { date?: Date }) {
  const iso = toIsoDate(date);
  const [state, setState] = useState<SpendPromptsState | null>(null);
  const [tick, setTick] = useState(0);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [awaitingAmount, setAwaitingAmount] = useState<SpendPromptId | null>(null);

  const reload = useCallback(async () => {
    setState(await getSpendPromptsState(iso));
  }, [iso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await getSpendPromptsState(iso);
      const active = activeSpendPrompts(new Date(), s);
      for (const p of active) {
        if (s.notified.includes(p.id)) continue;
        try {
          if ('Notification' in window) {
            if (Notification.permission === 'default') {
              await Notification.requestPermission();
            }
            if (Notification.permission === 'granted') {
              new Notification(p.notifyTitle, { body: p.notifyBody });
            }
          }
        } catch {
          /* ignore */
        }
        setState(await markNotified(iso, p.id));
      }
    })();
  }, [iso, tick]);

  if (!state) return null;

  const active = activeSpendPrompts(new Date(), state);
  if (active.length === 0 && !awaitingAmount) return null;

  const list: SpendPromptDef[] = awaitingAmount
    ? SPEND_PROMPTS.filter((p) => p.id === awaitingAmount)
    : active;

  const renderPrompt = (p: SpendPromptDef) => {
    const needAmount =
      awaitingAmount === p.id || (!p.yesNoFirst && !state.answers[p.id]?.answered);

    if (needAmount) {
      return (
        <div key={p.id} style={{ marginBottom: 12 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>{p.question}</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="₹ amount"
              value={amountDraft[p.id] ?? ''}
              onChange={(e) =>
                setAmountDraft((d) => ({ ...d, [p.id]: e.target.value }))
              }
              style={{
                width: 120,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'inherit',
              }}
            />
            <Button
              variant="primary"
              onClick={async () => {
                const n = Number(amountDraft[p.id]);
                if (!(n > 0)) return;
                setState(await answerSpendAmount(iso, p.id, n, p.category));
                setAwaitingAmount(null);
                setAmountDraft((d) => ({ ...d, [p.id]: '' }));
              }}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                setState(await answerSpendNo(iso, p.id));
                setAwaitingAmount(null);
              }}
            >
              Skip / ₹0
            </Button>
          </div>
        </div>
      );
    }

    if (p.yesNoFirst) {
      return (
        <div key={p.id} style={{ marginBottom: 12 }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>
            {p.yesNoLabel ?? p.question}
          </strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => setAwaitingAmount(p.id)}>
              Yes
            </Button>
            <Button
              variant="secondary"
              onClick={async () => setState(await answerSpendNo(iso, p.id))}
            >
              No
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      <strong>💰 Spend check</strong>
      <p
        style={{
          margin: '4px 0 12px',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Timed asks — answers go to Money. Done items disappear.
      </p>
      {list.map(renderPrompt)}
    </Card>
  );
}
