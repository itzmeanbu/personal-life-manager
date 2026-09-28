/**
 * Bus phase music: pick a random playlist (English or Tamil), then a random song.
 * Never forced sequential — if you add/remove tracks in Music, next ride uses the new pool.
 */
import { musicPlaylistsRepo, musicTracksRepo } from '../data/repository';
import { pickRandomTrack } from './shuffle';
import type { MusicTrack, MusicPlaylist } from '../data/types';

const BUS_KEYS = ['bus_english', 'bus_tamil'] as const;

export async function listBusPlaylists(): Promise<MusicPlaylist[]> {
  const all = await musicPlaylistsRepo.list();
  return all.filter(
    (p) => !p.deleted && p.enabled && BUS_KEYS.includes(p.systemKey as (typeof BUS_KEYS)[number])
  );
}

/**
 * One random song for this bus ride.
 * @param lastTrackId avoid starting with the same track as last time when possible.
 */
export async function pickBusSong(lastTrackId?: string | null): Promise<{
  playlist: MusicPlaylist | null;
  track: MusicTrack | null;
}> {
  const playlists = await listBusPlaylists();
  if (playlists.length === 0) return { playlist: null, track: null };

  // Random playlist first (English or Tamil), then random song in that list.
  // If a playlist is empty, try the other.
  const order = [...playlists].sort(() => Math.random() - 0.5);
  const allTracks = await musicTracksRepo.list();

  for (const pl of order) {
    const tracks = allTracks.filter((t) => !t.deleted && t.playlistId === pl.id);
    const track = pickRandomTrack(tracks, lastTrackId);
    if (track) return { playlist: pl, track };
  }

  // Fallback: any bus track across both playlists
  const any = allTracks.filter(
    (t) =>
      !t.deleted &&
      playlists.some((p) => p.id === t.playlistId)
  );
  const track = pickRandomTrack(any, lastTrackId);
  return { playlist: playlists[0] ?? null, track };
}
