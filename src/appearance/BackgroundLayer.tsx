import { useEffect, useState } from 'react';
import { getAppearanceConfig, setAppearanceConfig } from './settings';
import { getMediaIndex, blobUrl } from './media';
import { pickDailyBackground } from './shuffleBg';
import { toIsoDate } from '../routine/engine';

/**
 * Soft daily background behind the app shell. Lazy single-image load only.
 */
export function BackgroundLayer() {
  const [url, setUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      const cfg = await getAppearanceConfig();
      setEnabled(cfg.dailyBackgroundEnabled);
      if (!cfg.dailyBackgroundEnabled) {
        setUrl(null);
        return;
      }
      const index = await getMediaIndex();
      const today = toIsoDate(new Date());
      const { key, history } = pickDailyBackground(index, cfg, today);
      if (key !== cfg.todayBackgroundKey || cfg.todayBackgroundDate !== today) {
        await setAppearanceConfig({
          todayBackgroundKey: key,
          todayBackgroundDate: today,
          backgroundHistory: history,
        });
      }
      if (!key) return;
      const u = await blobUrl(key);
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      revoke = u;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  if (!enabled || !url) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.22,
        filter: 'saturate(1.1)',
      }}
    />
  );
}
