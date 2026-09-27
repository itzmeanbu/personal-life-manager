import { useEffect } from 'react';
import { tickNotifications, requestNotifyPermission } from './engine';

/** Runs in the background of the app — ticks every 30s while open. */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void requestNotifyPermission();
    void tickNotifications();
    const t = window.setInterval(() => {
      void tickNotifications();
    }, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void tickNotifications();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <>{children}</>;
}
