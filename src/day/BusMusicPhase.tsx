/**
 * Morning / evening bus phase — music only + travel actions.
 * No home checklist, no college controls, no night stuff.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { pickBusSong } from '../music/busRandom';
import type { MusicTrack, MusicPlaylist } from '../data/types';

export function BusMusicPhase({
  direction,
  onArrived,
}: {
  direction: 'morning' | 'evening';
  onArrived: () => void;
}) {
  const [playlist, setPlaylist] = useState<MusicPlaylist | null>(null);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const { playlist: pl, track: tr } = await pickBusSong(track?.id);
      setPlaylist(pl);
      setTrack(tr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  return (
    <div>
      <Card style={{ marginBottom: 12, textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🚌</div>
        <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 6px' }}>
          {direction === 'morning' ? 'Bus to college' : 'Bus home'}
        </p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
          Music phase only — home checklist and college controls are hidden until you arrive.
        </p>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Random track</div>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Picking from Bus English / Bus Tamil…
          </p>
        ) : track ? (
          <>
            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-base)' }}>{track.title}</p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {playlist?.name ?? 'Bus playlist'}
            </p>
          </>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            No songs yet. Import MP3s into <strong>Bus English</strong> or <strong>Bus Tamil</strong> in
            Music.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => void reload()}>
            Another random song
          </Button>
          <Link to="/music">
            <Button variant="ghost">Open Music</Button>
          </Link>
        </div>
      </Card>

      <Card style={{ textAlign: 'center', padding: '16px' }}>
        <Button variant="primary" onClick={onArrived}>
          {direction === 'morning' ? "I've reached college →" : "I'm home →"}
        </Button>
      </Card>
    </div>
  );
}
