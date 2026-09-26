import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <span className="section-header__title">{title}</span>
      {action && <span className="section-header__action">{action}</span>}
    </div>
  );
}
