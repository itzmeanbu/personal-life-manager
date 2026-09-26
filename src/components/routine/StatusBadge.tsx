import type { DerivedStatus } from '../../routine/engine';
import { STATUS_LABELS } from '../../routine/engine';

export function StatusBadge({ status }: { status: DerivedStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABELS[status]}</span>;
}
