import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '../components/navigation/BottomNav';
import { WelcomeOverlay } from '../home/WelcomeOverlay';
import { BackgroundLayer } from '../appearance/BackgroundLayer';
import { DemoToolsPanel } from '../demo/DemoTools';

export function AppShell() {
  const location = useLocation();
  const journey = location.pathname === '/' || location.pathname === '/today';
  return (
    <div className="app-shell">
      <BackgroundLayer />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Outlet />
      </div>
      <WelcomeOverlay />
      {!journey && <BottomNav />}
      {/* DEMO — remove this line + src/demo/ before release */}
      <DemoToolsPanel />
    </div>
  );
}
