import { NavLink } from 'react-router-dom';

const items = [
  { to: '/today', label: 'Daily Flow', icon: '◉' },
  { to: '/activity-log', label: 'Activity Log', icon: '◷' },
  { to: '/spending', label: 'Spending', icon: '₹' },
  { to: '/insights', label: 'Insights', icon: '◌' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav bottom-nav--five" aria-label="Primary navigation">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}>
          <span className="bottom-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
