import { useEffect, useState } from 'react';
import { getAppearanceConfig } from './settings';
import { blobUrl } from './media';

/** Default logo: compass + energy + subtle A — not childish, not hard-coded permanent. */
export function DefaultLogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="App logo"
    >
      <defs>
        <linearGradient id="lg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B7CFF" />
          <stop offset="0.55" stopColor="#C084FC" />
          <stop offset="1" stopColor="#6FE3C0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" stroke="url(#lg)" strokeWidth="3" fill="rgba(26,26,34,0.9)" />
      <circle cx="32" cy="32" r="6" fill="url(#lg)" />
      <path d="M32 12 L35 28 L32 26 L29 28 Z" fill="#6FE3C0" />
      <path d="M32 52 L29 36 L32 38 L35 36 Z" fill="#8B7CFF" opacity="0.7" />
      <path d="M48 32 L34 29 L36 32 L34 35 Z" fill="#FFB020" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="#F3F3F6"
        fontFamily="system-ui,sans-serif"
      >
        A
      </text>
    </svg>
  );
}

export function AppLogo({ size = 40, className }: { size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      const cfg = await getAppearanceConfig();
      if (!cfg.customLogoBlobKey) {
        if (!cancelled) setSrc(null);
        return;
      }
      const url = await blobUrl(cfg.customLogoBlobKey);
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      revoke = url;
      setSrc(url);
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  if (src) {
    return (
      <img
        src={src}
        alt="App logo"
        className={className}
        width={size}
        height={size}
        style={{ borderRadius: 10, objectFit: 'cover' }}
      />
    );
  }
  return (
    <span className={className}>
      <DefaultLogoMark size={size} />
    </span>
  );
}
