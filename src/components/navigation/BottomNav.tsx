import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { ModuleDrawer } from './ModuleDrawer';

export function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
          <span>☀</span>
          Today
        </NavLink>
        <button className="bottom-nav__fab" onClick={() => setDrawerOpen(true)} aria-label="All modules">
          ▦
        </button>
        <NavLink to="/progress" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
          <span>◐</span>
          Progress
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
          <span>⚙</span>
          Settings
        </NavLink>
      </nav>
      {drawerOpen && <ModuleDrawer onClose={() => setDrawerOpen(false)} />}
    </>
  );
}
