/**
 * 15 built-in scenic backgrounds, generated as SVG (no files to ship,
 * fully offline). Used when the user has not imported their own photos,
 * or when "use built-in backgrounds" is on. Each has its own palette so
 * the accent colour can adapt to it.
 */

interface Scene {
  id: string;
  name: string;
  sky: [string, string, string];
  sun: string;
  hills: [string, string, string];
  stars: boolean;
}

const SCENES: Scene[] = [
  { id: 'dawn-peaks', name: 'Dawn peaks', sky: ['#1b1f3a', '#5a4a8a', '#f2a07b'], sun: '#ffd9a0', hills: ['#3b3358', '#2a2542', '#1a1730'], stars: true },
  { id: 'ocean-dusk', name: 'Ocean dusk', sky: ['#0b1d3a', '#1f5f8b', '#f6b26b'], sun: '#ffe0b0', hills: ['#14415e', '#0d2f47', '#081c2c'], stars: false },
  { id: 'forest-mist', name: 'Forest mist', sky: ['#0e2a24', '#2f6b58', '#a7d7b8'], sun: '#eaffd8', hills: ['#1f5445', '#153b31', '#0b241d'], stars: false },
  { id: 'violet-night', name: 'Violet night', sky: ['#0d0a24', '#3a1f6b', '#8a4fd1'], sun: '#e9d5ff', hills: ['#2a1a55', '#1c1240', '#100a29'], stars: true },
  { id: 'desert-gold', name: 'Desert gold', sky: ['#3a1f14', '#b5541f', '#ffc36b'], sun: '#fff1c1', hills: ['#8a3b18', '#5e2810', '#3a190a'], stars: false },
  { id: 'arctic-blue', name: 'Arctic blue', sky: ['#081a2e', '#1f6f9c', '#b8ecff'], sun: '#ffffff', hills: ['#2d6f94', '#1d4f6e', '#0f2f45'], stars: true },
  { id: 'rose-city', name: 'Rose city', sky: ['#2a0f2a', '#a3315f', '#ff9a8b'], sun: '#ffe1d6', hills: ['#6b2246', '#471531', '#2a0c1d'], stars: false },
  { id: 'teal-lagoon', name: 'Teal lagoon', sky: ['#04252b', '#0f7f8a', '#8be9d6'], sun: '#eafff9', hills: ['#0e5f68', '#093f47', '#05262b'], stars: false },
  { id: 'ember-sky', name: 'Ember sky', sky: ['#1a0a0a', '#8a1f1f', '#ff7a3d'], sun: '#ffd27a', hills: ['#5a1414', '#3a0d0d', '#210707'], stars: false },
  { id: 'lime-fields', name: 'Lime fields', sky: ['#0d2410', '#3f8a2f', '#d9f27a'], sun: '#fffbd0', hills: ['#2f6b25', '#1f4a19', '#112c0e'], stars: false },
  { id: 'indigo-space', name: 'Indigo space', sky: ['#05051a', '#141a6b', '#4b5de6'], sun: '#dfe4ff', hills: ['#1a2380', '#111860', '#090c38'], stars: true },
  { id: 'peach-morning', name: 'Peach morning', sky: ['#3a1f2a', '#d0686b', '#ffd0a6'], sun: '#fff4dc', hills: ['#8a3f4a', '#5f2a34', '#3a1a20'], stars: false },
  { id: 'steel-storm', name: 'Steel storm', sky: ['#10141a', '#3a4a5e', '#8fa3ba'], sun: '#dbe6f2', hills: ['#2a3a4c', '#1c2836', '#0f1720'], stars: false },
  { id: 'mint-dream', name: 'Mint dream', sky: ['#0c2a26', '#3fb59a', '#c9fff0'], sun: '#ffffff', hills: ['#2a8a75', '#1c6252', '#0f3a30'], stars: true },
  { id: 'sunset-magenta', name: 'Sunset magenta', sky: ['#1f0a2e', '#8a1f7a', '#ff6b9a'], sun: '#ffd6e6', hills: ['#5a1a6b', '#3a1147', '#220a2b'], stars: true },
];

function starDots(seed: number): string {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  let out = '';
  for (let i = 0; i < 40; i++) {
    out += `<circle cx="${(rnd() * 800).toFixed(0)}" cy="${(rnd() * 380).toFixed(0)}" r="${(rnd() * 1.4 + 0.4).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.6 + 0.3).toFixed(2)}"/>`;
  }
  return out;
}

function svgFor(sc: Scene, idx: number): string {
  const sunX = 140 + ((idx * 97) % 520);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${sc.sky[0]}"/><stop offset="0.55" stop-color="${sc.sky[1]}"/><stop offset="1" stop-color="${sc.sky[2]}"/>
</linearGradient></defs>
<rect width="800" height="1200" fill="url(#g)"/>
${sc.stars ? starDots(idx + 7) : ''}
<circle cx="${sunX}" cy="640" r="70" fill="${sc.sun}" opacity="0.9"/>
<path d="M0 780 Q160 ${640 + (idx % 4) * 20} 320 760 T640 720 T800 770 V1200 H0Z" fill="${sc.hills[0]}"/>
<path d="M0 900 Q220 ${800 - (idx % 3) * 25} 420 880 T800 860 V1200 H0Z" fill="${sc.hills[1]}"/>
<path d="M0 1020 Q260 940 520 1010 T800 990 V1200 H0Z" fill="${sc.hills[2]}"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface BuiltinBackground {
  id: string;
  name: string;
  url: string;
}

let cache: BuiltinBackground[] | null = null;

export function builtinBackgrounds(): BuiltinBackground[] {
  if (!cache) cache = SCENES.map((sc, i) => ({ id: sc.id, name: sc.name, url: svgFor(sc, i) }));
  return cache;
}

/** Random pick that never repeats yesterday's scene. */
export function pickBuiltin(lastId: string | null): BuiltinBackground {
  const all = builtinBackgrounds();
  const pool = all.length > 1 && lastId ? all.filter((b) => b.id !== lastId) : all;
  return pool[Math.floor(Math.random() * pool.length)];
}
