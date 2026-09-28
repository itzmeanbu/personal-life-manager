/**
 * Night phase — good night, night asks, night music. Nothing else.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DayAsksCard } from './DayAsksCard';
import { musicPlaylistsRepo, musicTracksRepo } from '../data/repository';
import { pickRandomTrack } from '../music/shuffle';
import type { MusicTrack } from '../data/types';

export function NightPhasePanel({ date = new Date() }: { date?: Date }) {
  const [track, setTrack] = useState<MusicTrack | null>(null);

  const pick = async () => {
    const playlists = (await musicPlaylistsRepo.list()).filter(
      (p) => !p.deleted && p.enabled && (p.systemKey === 'night' || /night/i.test(p.name))
    );
    const all = await musicTracksRepo.list();
    const pool =
      playlists.length > 0
        ? all.filter((t) => !t.deleted && playlists.some((p) => p.id === t.playlistId))
        : all.filter((t) => !t.deleted);
    setTrack(pickRandomTrack(pool, track?.id));
  };

  useEffect(() => {
    void pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card style={{ marginBottom: 12, textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌙</div>
        <p style={{ fontSize: 'var(--text-xl)', fontWeight: 600, margin: '0 0 6px' }}>
          Good night
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Night phase only — morning, college, and bus controls are gone.
        </p>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Night music (random)</div>
        {track ? (
          <p style={{ margin: 0 }}>{track.title}</p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Import tracks into Night Music playlist.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => void pick()}>
            Another song
          </Button>
          <Link to="/music">
            <Button variant="ghost">Music</Button>
          </Link>
        </div>
      </Card>

      <DayAsksCard date={date} />
    </div>
  );
}
