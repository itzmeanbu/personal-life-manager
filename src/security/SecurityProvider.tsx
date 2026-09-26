import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getSecurityConfig } from './lockManager';
import { setScreenshotProtection } from './privacyScreen';
import type { SecurityConfig } from './types';

interface SecurityContextValue {
  config: SecurityConfig;
  locked: boolean;
  loading: boolean;
  /** Called by LockScreen after a successful PIN/biometric verification. */
  unlock: () => void;
  /** Force a re-lock (e.g. after the user disables/enables settings). */
  lockNow: () => void;
  refreshConfig: () => Promise<SecurityConfig>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useSecurity(): SecurityContextValue {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used within SecurityProvider');
  return ctx;
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const backgroundedAtRef = useRef<number | null>(null);

  const refreshConfig = useCallback(async () => {
    const next = await getSecurityConfig();
    setConfig(next);
    void setScreenshotProtection(next.screenshotProtectionEnabled);
    return next;
  }, []);

  // Initial load: lock immediately if app-lock is configured.
  useEffect(() => {
    void refreshConfig().then((cfg) => {
      if (cfg.appLockEnabled && cfg.isSetUp) setLocked(true);
    });
  }, [refreshConfig]);

  // Lock on background / auto-lock after N minutes of being backgrounded.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!config?.appLockEnabled || !config.isSetUp) return;

      if (!isActive) {
        backgroundedAtRef.current = Date.now();
        if (config.lockOnBackground || config.autoLockMinutes === 0) {
          setLocked(true);
        }
      } else if (backgroundedAtRef.current) {
        const awayMinutes = (Date.now() - backgroundedAtRef.current) / 60_000;
        if (!config.lockOnBackground && awayMinutes >= config.autoLockMinutes) {
          setLocked(true);
        }
        backgroundedAtRef.current = null;
      }
    });

    return () => {
      void sub.then((s) => s.remove());
    };
  }, [config]);

  const unlock = useCallback(() => setLocked(false), []);
  const lockNow = useCallback(() => setLocked(true), []);

  if (!config) {
    // Config not loaded yet — render nothing rather than a flash of unlocked content.
    return null;
  }

  const shouldShowLock = config.appLockEnabled && config.isSetUp && locked;

  return (
    <SecurityContext.Provider
      value={{ config, locked: shouldShowLock, loading: false, unlock, lockNow, refreshConfig }}
    >
      {children}
    </SecurityContext.Provider>
  );
}
