import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageShellProps {
  title: string;
  showBack?: boolean;
  right?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, showBack = true, right, children }: PageShellProps) {
  const navigate = useNavigate();
  return (
    <div className="page-shell">
      <header className="page-shell__header">
        {showBack && (
          <button className="page-shell__back" onClick={() => navigate(-1)} aria-label="Back">
            ‹
          </button>
        )}
        <h1 className="page-shell__title">{title}</h1>
        <div style={{ marginLeft: 'auto' }}>{right}</div>
      </header>
      <div className="page-shell__content">{children}</div>
    </div>
  );
}
