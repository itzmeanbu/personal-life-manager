/**
 * Travel music: English + Tamil playlists mixed, random every day,
 * no song repeats until the whole library has been played.
 * Starts when the bus is boarded, stops on arrival.
 */
import { musicPlaylistsRepo, musicTracksRepo } from '../data/repository';
import { getSetting, setSetting } from '../data/settings';
import type { MusicTrack } from '../data/types';
import { musicPlayer } from './player';
import { getMusicConfig } from './settings';

const CFG_KEY = 'music.travel.config.v1';
const PLAYED_KEY = 'music.travel.played.v1';

export interface TravelMusicConfig {
  enabled: boolean;
  /** 0-100: share of English songs in the mix (rest is Tamil). */
  englishShare: number;
}

export const DEFAULT_TRAVEL_MUSIC: TravelMusicConfig = { enabled: true, englishShare: 50 };

export async function getTravelMusicConfig(): Promise<TravelMusicConfig> {
  const s = await getSetting<Partial<TravelMusicConfig> | null>(CFG_KEY, null);
  return { ...DEFAULT_TRAVEL_MUSIC, ...(s ?? {}) };
}
export async function setTravelMusicConfig(patch: Partial<TravelMusicConfig>): Promise<void> {
  const cur = await getTravelMusicConfig();
  await setSetting(CFG_KEY, { ...cur, ...patch });
}

/* small seeded RNG so the order is different each day but stable within a trip */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadGroups(): Promise<{ english: MusicTrack[]; tamil: MusicTrack[] }> {
  const lists = (await musicPlaylistsRepo.list()).filter((p) => !p.deleted && p.enabled);
  const en = lists.filter((p) => p.systemKey === 'english' || /english/i.test(p.name));
  const ta = lists.filter((p) => p.systemKey === 'tamil' || /tamil/i.test(p.name));
  const tracks = (await musicTracksRepo.list()).filter((t) => !t.deleted);
  return {
    english: tracks.filter((t) => en.some((p) => p.id === t.playlistId)),
    tamil: tracks.filter((t) => ta.some((p) => p.id === t.playlistId)),
  };
}

export interface PlayedState {
  ids: string[];
}

export async function buildTravelQueue(seedSalt: string): Promise<MusicTrack[]> {
  const cfg = await getTravelMusicConfig();
  const { english, tamil } = await loadGroups();
  const all = [...english, ...tamil];
  if (all.length === 0) return [];

  let played = (await getSetting<PlayedState | null>(PLAYED_KEY, null)) ?? { ids: [] };
  let remE = english.filter((t) => !played.ids.includes(t.id));
  let remT = tamil.filter((t) => !played.ids.includes(t.id));
  if (remE.length + remT.length === 0) {
    // Whole library played once: start a fresh cycle.
    played = { ids: [] };
    await setSetting(PLAYED_KEY, played);
    remE = english;
    remT = tamil;
  }

  const rnd = mulberry32(hashStr(seedSalt));
  remE = shuffled(remE, rnd);
  remT = shuffled(remT, rnd);

  // Interleave by the chosen ratio.
  const share = Math.min(100, Math.max(0, cfg.englishShare)) / 100;
  const queue: MusicTrack[] = [];
  let e = 0;
  let t = 0;
  while (e < remE.length || t < remT.length) {
    const wantEnglish = rnd() < share;
    if ((wantEnglish && e < remE.length) || t >= remT.length) queue.push(remE[e++]);
    else queue.push(remT[t++]);
  }
  return queue;
}

let unsub: (() => void) | null = null;

async function rememberPlayed(id: string): Promise<void> {
  const cur = (await getSetting<PlayedState | null>(PLAYED_KEY, null)) ?? { ids: [] };
  if (cur.ids.includes(id)) return;
  await setSetting(PLAYED_KEY, { ids: [...cur.ids, id] });
}

/** Start a trip's music. `tripKey` example: "2026-09-29:morning". */
export async function startTravelMusic(tripKey: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await getTravelMusicConfig();
  if (!cfg.enabled) return { ok: false, message: 'Travel music is off in Settings.' };
  const queue = await buildTravelQueue(tripKey);
  if (queue.length === 0) {
    return { ok: false, message: 'No songs yet. Import English and Tamil songs in Music.' };
  }
  const mc = await getMusicConfig();
  musicPlayer.setVolume(mc.volume);
  musicPlayer.setQueue(queue, 0);
  unsub?.();
  let lastSeen: string | null = null;
  unsub = musicPlayer.subscribe(() => {
    const c = musicPlayer.current;
    if (c && c.id !== lastSeen && musicPlayer.playing) {
      lastSeen = c.id;
      void rememberPlayed(c.id);
    }
  });
  try {
    await musicPlayer.playTrackAt(0);
    return { ok: true, message: 'Music on.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not start music.' };
  }
}

export function stopTravelMusic(): void {
  musicPlayer.stop();
  unsub?.();
  unsub = null;
}
