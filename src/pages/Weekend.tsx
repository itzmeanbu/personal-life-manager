import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function Weekend() {
  return (
    <PageShell title="Weekend">
      <Card>
        <strong>Rest day · Spin Wheel</strong>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Saturday and Sunday normally use the configurable Spin Wheel for activities —
          nested wheels, time windows, durations. Nothing is hard-coded.
        </p>
        <Link to="/spin" style={{ marginTop: 12, display: 'inline-block' }}>
          <Button variant="primary">Open Spin Wheel</Button>
        </Link>
      </Card>
      <EmptyState
        icon="🌴"
        title="Weekend space"
        description="Add more weekend-only plans here later — the wheel handles activity choice."
      />
    </PageShell>
  );
}
