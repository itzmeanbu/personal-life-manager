import type { ReactNode } from 'react';

interface StateBlockProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '○', title, description, action }: StateBlockProps) {
  return (
    <div className="state-block">
      <div className="state-block__icon">{icon}</div>
      <div className="state-block__title">{title}</div>
      {description && <div className="state-block__desc">{description}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ icon = '⚠', title, description, action }: StateBlockProps) {
  return (
    <div className="state-block state-block--error">
      <div className="state-block__icon">{icon}</div>
      <div className="state-block__title">{title}</div>
      {description && <div className="state-block__desc">{description}</div>}
      {action}
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 56, width: '100%' }} />
      ))}
    </div>
  );
}
