/**
 * Sample an image's average colour and turn it into a readable accent.
 * Runs in the browser only; the result is stored as CSS variables.
 */

export interface AdaptiveColors {
  accent: string;
  tint: string;
  dominant: string;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export function sampleColors(url: string): Promise<AdaptiveColors | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const size = 24;
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const [h, s] = rgbToHsl(r, g, b);
        // Bright, saturated accent that stays readable on the dark UI.
        const accent = `hsl(${Math.round(h)}, ${Math.max(55, Math.min(85, s + 25))}%, 68%)`;
        resolve({
          accent,
          tint: `rgba(${r}, ${g}, ${b}, 0.14)`,
          dominant: `rgb(${r}, ${g}, ${b})`,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function applyAdaptiveColors(colors: AdaptiveColors | null, userAccent: string): void {
  const root = document.documentElement;
  if (!colors) {
    root.style.removeProperty('--bg-tint');
    root.style.removeProperty('--bg-dominant');
    return;
  }
  root.style.setProperty('--bg-tint', colors.tint);
  root.style.setProperty('--bg-dominant', colors.dominant);
  // A custom accent picked by the user always wins.
  if (!userAccent) root.style.setProperty('--color-accent', colors.accent);
}
