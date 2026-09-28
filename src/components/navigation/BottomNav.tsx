import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ModuleDrawer } from './ModuleDrawer';

/**
 * Four equal-width tabs (CSS grid), so nothing depends on label width or on
 * where a floating button happens to land. "Modules" opens the drawer.
 */
const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const TodayIcon = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const ModulesIcon = (
  <svg {...ICON_PROPS}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);

const ProgressIcon = (
  <svg {...ICON_PROPS}>
    <path d="M5 20V11M12 20V4M19 20v-6" />
  </svg>
);

const SettingsIcon = (
  <svg {...ICON_PROPS}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

function Tab({ to, end, label, icon }: { to: string; end?: boolean; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
    >
      <span className="bottom-nav__icon">{icon}</span>
      <span className="bottom-nav__label">{label}</span>
    </NavLink>
  );
}

export function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        <Tab to="/" end label="Today" icon={TodayIcon} />
        <button
          type="button"
          className={`bottom-nav__item${drawerOpen ? ' bottom-nav__item--active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          aria-label="All modules"
          aria-haspopup="dialog"
        >
          <span className="bottom-nav__icon">{ModulesIcon}</span>
          <span className="bottom-nav__label">Modules</span>
        </button>
        <Tab to="/progress" label="Progress" icon={ProgressIcon} />
        <Tab to="/settings" label="Settings" icon={SettingsIcon} />
      </nav>
      {drawerOpen && <ModuleDrawer onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
