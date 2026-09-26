import { getSetting, setSetting } from '../data/settings';

export interface MusicConfig {
  /** Master enable. */
  enabled: boolean;
  /** Default volume 0–1 where supported by HTMLAudioElement. */
  volume: number;
  /**
   * Night music: when true, app may prompt YES/NO before starting Night playlist.
   * Configurable — not forced.
   */
  nightMusicAskBeforePlay: boolean;
  /** Remember last answer for the session/day if user prefers not to ask every time. */
  nightMusicLastAnswer: 'yes' | 'no' | null;
  /** Soft anti-repeat: avoid replaying the same track as the immediate previous. */
  avoidImmediateRepeat: boolean;
  /** Prefer less-played tracks slightly when building shuffle order. */
  preferLessPlayed: boolean;
}

export const MUSIC_CONFIG_KEY = 'music.config';

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  enabled: true,
  volume: 0.8,
  nightMusicAskBeforePlay: true,
  nightMusicLastAnswer: null,
  avoidImmediateRepeat: true,
  preferLessPlayed: true,
};

export async function getMusicConfig(): Promise<MusicConfig> {
  const stored = await getSetting<Partial<MusicConfig> | null>(MUSIC_CONFIG_KEY, null);
  if (!stored) return { ...DEFAULT_MUSIC_CONFIG };
  return { ...DEFAULT_MUSIC_CONFIG, ...stored };
}

export async function setMusicConfig(patch: Partial<MusicConfig>): Promise<MusicConfig> {
  const current = await getMusicConfig();
  const next = { ...current, ...patch };
  await setSetting(MUSIC_CONFIG_KEY, next);
  return next;
}
