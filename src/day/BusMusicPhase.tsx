/**
 * Bus phase = notification-style asks, not a Music app clone.
 * "Did you enter the bus?" → Yes → random song from Bus English / Bus Tamil plays.
 */
import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { pickBusSong } from '../music/busRandom';
import { musicPlayer } from '../music/player';
import { musicTracksRepo } from '../data/repository';
import { fireOsNotification } from '../notify/engine';
import { buildQueue } from '../music/shuffle';
import { getMusicConfig } from '../music/settings';
import type { MusicTrack } from '../data/types';

export function BusMusicPhase({
  direction,
  onArrived,
}: {
  direction: 'morning' | 'evening';
  onArrived: () => void;
}) {
  const [asked, setAsked] = useState(false);
  const [onBus, setOnBus] = useState(false);
  const [track, setTrack] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    return musicPlayer.subscribe(() => setPlaying(musicPlayer.playing));
  }, []);

  // Nudge once when this phase opens
  useEffect(() => {
    void fireOsNotification(
      direction === 'morning' ? 'Bus to college' : 'Bus home',
      'Did you enter the bus? Open the app and tap Yes for music.'
    );
  }, [direction]);

  const startMusic = async () => {
    setErr(null);
    setOnBus(true);
    setAsked(true);
    try {
      const { track: tr, playlist } = await pickBusSong(musicPlayer.lastTrackId);
      if (!tr) {
        setErr('No songs in Bus English / Bus Tamil yet — import MP3s in Music once, then come back.');
        void fireOsNotification('Bus music', 'Add songs to Bus English or Bus Tamil first.');
        return;
      }
      setTrack(tr);
      // Build a shuffled queue from the same playlist (or both bus lists)
      const all = await musicTracksRepo.list();
      const pool = all.filter(
        (t) =>
          !t.deleted &&
          (playlist ? t.playlistId === playlist.id : true)
      );
      const cfg = await getMusicConfig();
      const queue = buildQueue(pool.length ? pool : [tr], {
        shuffle: true,
        config: cfg,
        lastTrackId: musicPlayer.lastTrackId,
      });
      const startIdx = Math.max(0, queue.findIndex((x) => x.id === tr.id));
      musicPlayer.setQueue(queue.length ? queue : [tr], startIdx >= 0 ? startIdx : 0);
      await musicPlayer.playTrackAt(startIdx >= 0 ? startIdx : 0);
      void fireOsNotification('Now playing', tr.title);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not play');
    }
  };

  const skipSong = async () => {
    const { track: tr } = await pickBusSong(track?.id ?? musicPlayer.lastTrackId);
    if (!tr) return;
    setTrack(tr);
    const all = await musicTracksRepo.list();
    const pool = all.filter((t) => !t.deleted);
    const cfg = await getMusicConfig();
    const queue = buildQueue(pool, { shuffle: true, config: cfg, lastTrackId: track?.id });
    const idx = queue.findIndex((x) => x.id === tr.id);
    musicPlayer.setQueue(queue, idx >= 0 ? idx : 0);
    await musicPlayer.playTrackAt(idx >= 0 ? idx : 0);
    void fireOsNotification('Next song', tr.title);
  };

  return (
    <div>
      {!onBus ? (
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚌</div>
          <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: '0 0 8px' }}>
            Bus
          </p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', margin: '0 0 16px' }}>
            {direction === 'morning' ? 'Morning ride to college' : 'Evening ride home'}. Yes → random
            song from your Bus English / Bus Tamil folders.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => void startMusic()}>
              Start music
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAsked(true);
                setOnBus(true);
              }}
            >
              No music
            </Button>
          </div>
          {asked && !onBus && (
            <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              OK — come back when you&apos;re on the bus.
            </p>
          )}
        </Card>
      ) : (
        <Card style={{ marginBottom: 12, textAlign: 'center', padding: '20px 16px' }}>
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>On the bus</p>
          {track ? (
            <p style={{ margin: '0 0 8px' }}>
              {playing ? '▶' : '❚❚'} {track.title}
            </p>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Music optional
            </p>
          )}
          {err && (
            <p style={{ color: '#ef4444', fontSize: 'var(--text-sm)' }}>{err}</p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => void startMusic()}>
              Play random
            </Button>
            <Button variant="ghost" onClick={() => void skipSong()}>
              Next random
            </Button>
            {playing ? (
              <Button variant="ghost" onClick={() => musicPlayer.pause()}>
                Pause
              </Button>
            ) : track ? (
              <Button variant="ghost" onClick={() => void musicPlayer.play()}>
                Resume
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      <Card style={{ textAlign: 'center', padding: '16px' }}>
        <Button variant="primary" onClick={onArrived}>
          {direction === 'morning' ? "I've reached college →" : "I'm home →"}
        </Button>
      </Card>
    </div>
  );
}
