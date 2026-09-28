import { useEffect, useState } from 'react';
import { getAppearanceConfig, setAppearanceConfig } from './settings';
import { getMediaIndex, blobUrl, listBackgrounds } from './media';
import { pickDailyBackground } from './shuffleBg';
import { builtinBackgrounds, pickBuiltin } from './builtinBackgrounds';
import { applyAdaptiveColors, sampleColors } from './adaptiveColor';
import { toIsoDate } from '../routine/engine';

/**
 * Soft daily background behind the app shell. Lazy single-image load only.
 * Uses the user's imported photos; falls back to 15 built-in scenes.
 * Accent + card tint adapt to the picked background.
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
        applyAdaptiveColors(null, cfg.accentColor);
        return;
      }
      const index = await getMediaIndex();
      const today = toIsoDate(new Date());
      const hasPhotos = listBackgrounds(index).length > 0;
      const useBuiltin =
        cfg.builtinBackgroundsEnabled && (cfg.forceBuiltinBackgrounds || !hasPhotos);

      let finalUrl: string | null = null;

      if (useBuiltin) {
        const all = builtinBackgrounds();
        let chosen = all.find((b) => b.id === cfg.todayBuiltinId && cfg.todayBackgroundDate === today);
        if (!chosen) {
          chosen = pickBuiltin(cfg.lastBuiltinId);
          await setAppearanceConfig({
            todayBuiltinId: chosen.id,
            lastBuiltinId: chosen.id,
            todayBackgroundDate: today,
          });
        }
        finalUrl = chosen.url;
      } else {
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
        finalUrl = u;
      }

      if (cancelled || !finalUrl) return;
      setUrl(finalUrl);

      if (cfg.adaptiveColors) {
        const colors = await sampleColors(finalUrl);
        if (!cancelled) applyAdaptiveColors(colors, cfg.accentColor);
      } else {
        applyAdaptiveColors(null, cfg.accentColor);
      }
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
        backgroundImage: `url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.3,
        filter: 'saturate(1.1)',
      }}
    />
  );
}
