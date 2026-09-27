/**
 * Shows whichever catalog notifications are due *right now*.
 * Options on Day Brief change as time windows open/close.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { dueRulesNow } from '../notify/engine';
import { ruleScheduleLabel, type NotifyRule } from '../notify/catalog';

export function DueNotifyCard() {
  const [due, setDue] = useState<NotifyRule[]>([]);

  useEffect(() => {
    const load = () => void dueRulesNow().then(setDue);
    load();
    const t = window.setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  if (due.length === 0) {
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        No timed ping right now.{' '}
        <Link to="/notifications">Edit notification times</Link>
      </p>
    );
  }

  return (
    <Card style={{ marginBottom: 12, borderLeft: '3px solid var(--color-accent, #6c9eff)' }}>
      <strong>🔔 Due now</strong>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '4px 0 10px' }}>
        These windows are open — cards below match them. Change times anytime.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {due.map((r) => (
          <li key={r.id} style={{ marginBottom: 6, fontSize: 'var(--text-sm)' }}>
            <strong>{r.title}</strong> · {ruleScheduleLabel(r)}
          </li>
        ))}
      </ul>
      <Link to="/notifications">
        <Button variant="ghost">Add / delete / change times</Button>
      </Link>
    </Card>
  );
}
