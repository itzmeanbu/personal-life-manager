import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  musicPlaylistsRepo,
  musicTracksRepo,
} from '../data/repository';
import { deleteBlob } from '../data/settings';
import type { MusicPlaylist, MusicTrack } from '../data/types';
import { seedMusicPlaylistsIfNeeded } from '../music/seed';
import {
  getMusicConfig,
  setMusicConfig,
  type MusicConfig,
  DEFAULT_MUSIC_CONFIG,
} from '../music/settings';
import { buildQueue, pickRandomTrack } from '../music/shuffle';
import { musicPlayer } from '../music/player';
import { importMp3Files, openAudioFilePicker } from '../music/importFiles';
import '../music/music.css';

type Tab = 'play' | 'tracks' | 'settings';

export default function Music() {
  const [tab, setTab] = useState<Tab>('play');
  const [seeded, setSeeded] = useState(false);
  const [config, setConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [nightPrompt, setNightPrompt] = useState(false);
  const [, setPendingNightPlay] = useState(false);

  useEffect(() => {
    seedMusicPlaylistsIfNeeded().then(() => setSeeded(true));
    getMusicConfig().then((c) => {
      setConfig(c);
      musicPlayer.setVolume(c.volume);
    });
    return musicPlayer.subscribe(() => setTick((t) => t + 1));
  }, []);

  const playlists = useLiveQuery(
    () => musicPlaylistsRepo.list().then((r) => r.sort((a, b) => a.order - b.order)),
    [seeded]
  );
  const tracks = useLiveQuery(() => musicTracksRepo.list(), [seeded]);

  const enabledPlaylists = useMemo(
    () => (playlists ?? []).filter((p) => p.enabled && !p.deleted),
    [playlists]
  );

  useEffect(() => {
    if (!playlistId && enabledPlaylists[0]) {
      setPlaylistId(enabledPlaylists[0].id);
      setShuffle(enabledPlaylists[0].shuffleDefault);
    }
  }, [enabledPlaylists, playlistId]);

  const activePlaylist = enabledPlaylists.find((p) => p.id === playlistId) ?? null;

  const playlistTracks = useMemo(() => {
    if (!playlistId) return [];
    return (tracks ?? [])
      .filter((t) => t.playlistId === playlistId && !t.deleted)
      .sort((a, b) => a.order - b.order);
  }, [tracks, playlistId]);

  const startPlayback = useCallback(
    async (_pl: MusicPlaylist, trackList: MusicTrack[]) => {
      if (trackList.length === 0) {
        setMsg('No songs yet — import MP3s first (file picker only, no full-phone scan).');
        return;
      }
      const queue = buildQueue(trackList, {
        shuffle,
        config,
        lastTrackId: musicPlayer.lastTrackId,
      });
      // Never force start at #1 when shuffle: queue[0] is random
      musicPlayer.setQueue(queue, 0);
      await musicPlayer.playTrackAt(0);
      setMsg(null);
    },
    [shuffle, config]
  );

  const requestPlay = useCallback(async () => {
    if (!activePlaylist) return;
    if (activePlaylist.systemKey === 'night' && config.nightMusicAskBeforePlay) {
      setNightPrompt(true);
      setPendingNightPlay(true);
      return;
    }
    await startPlayback(activePlaylist, playlistTracks);
  }, [activePlaylist, config.nightMusicAskBeforePlay, playlistTracks, startPlayback]);

  const confirmNight = async (yes: boolean) => {
    setNightPrompt(false);
    setPendingNightPlay(false);
    await setMusicConfig({ nightMusicLastAnswer: yes ? 'yes' : 'no' });
    setConfig((c) => ({ ...c, nightMusicLastAnswer: yes ? 'yes' : 'no' }));
    if (yes && activePlaylist) {
      await startPlayback(activePlaylist, playlistTracks);
    }
  };

  const importSongs = async () => {
    if (!playlistId) return;
    setBusy(true);
    setMsg(null);
    try {
      const files = await openAudioFilePicker(true);
      if (!files || files.length === 0) {
        setMsg('No files selected.');
        return;
      }
      const n = await importMp3Files(playlistId, files);
      setMsg(`Imported ${n} track${n === 1 ? '' : 's'} (stored offline).`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const removeTrack = async (track: MusicTrack) => {
    if (!confirm(`Remove “${track.title}”?`)) return;
    await musicTracksRepo.remove(track.id, true);
    try {
      await deleteBlob(track.blobKey);
    } catch {
      /* ignore */
    }
  };

  const playRandom = async () => {
    const t = pickRandomTrack(playlistTracks, musicPlayer.lastTrackId);
    if (!t) {
      setMsg('No tracks.');
      return;
    }
    musicPlayer.setQueue([t, ...playlistTracks.filter((x) => x.id !== t.id)], 0);
    await musicPlayer.playTrackAt(0);
  };

  const saveConfig = async (patch: Partial<MusicConfig>) => {
    const next = await setMusicConfig(patch);
    setConfig(next);
    if (patch.volume != null) musicPlayer.setVolume(patch.volume);
  };

  const addPlaylist = async () => {
    const name = prompt('Playlist name?');
    if (!name?.trim()) return;
    const max = (playlists ?? []).reduce((m, p) => Math.max(m, p.order), -1);
    const row = await musicPlaylistsRepo.create({
      name: name.trim(),
      systemKey: null,
      enabled: true,
      order: max + 1,
      shuffleDefault: true,
    });
    setPlaylistId(row.id);
  };

  // silence unused tick lint by reading
  void tick;

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'play', label: 'Player' },
      { id: 'tracks', label: 'Tracks' },
      { id: 'settings', label: 'Settings' },
    ];
    return (
      <div className="mu-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mu-tab ${tab === t.id ? 'mu-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  if (!config.enabled) {
    return (
      <PageShell title="Music">
        {tabsBar()}
        <EmptyState
          icon="🎵"
          title="Music disabled"
          description="Enable under Settings."
          action={
            <Button variant="secondary" onClick={() => setTab('settings')}>
              Settings
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Music">
      {tabsBar()}

      {tab === 'play' && (
        <>
          <div className="mu-chips">
            {enabledPlaylists.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`mu-chip ${playlistId === p.id ? 'mu-chip--on' : ''}`}
                onClick={() => {
                  setPlaylistId(p.id);
                  setShuffle(p.shuffleDefault);
                }}
              >
                {p.name}
              </button>
            ))}
            <button type="button" className="mu-chip" onClick={addPlaylist}>
              + Playlist
            </button>
          </div>

          <Card className="mu-player">
            <div className="mu-player__meta">
              {activePlaylist?.name ?? 'No playlist'}
              {shuffle ? ' · shuffle' : ' · in order'}
            </div>
            <div className="mu-player__title">
              {musicPlayer.current?.title ?? 'Nothing playing'}
            </div>
            <div className="mu-player__meta">
              {playlistTracks.length} song{playlistTracks.length === 1 ? '' : 's'} offline
              {musicPlayer.queueLength > 0
                ? ` · queue ${musicPlayer.currentIndex + 1}/${musicPlayer.queueLength}`
                : ''}
            </div>
            <div className="mu-controls">
              <Button variant="ghost" onClick={() => void musicPlayer.previous()}>
                Prev
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (musicPlayer.current) musicPlayer.toggle();
                  else void requestPlay();
                }}
              >
                {musicPlayer.playing ? 'Pause' : 'Play'}
              </Button>
              <Button variant="ghost" onClick={() => void musicPlayer.next()}>
                Next
              </Button>
            </div>
            <div className="mu-controls">
              <Button variant="secondary" disabled={busy} onClick={() => void requestPlay()}>
                Start playlist
              </Button>
              <Button variant="ghost" onClick={() => void playRandom()}>
                Random track
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShuffle((s) => !s)}
              >
                Shuffle: {shuffle ? 'ON' : 'OFF'}
              </Button>
            </div>
            <div className="mu-field" style={{ marginTop: 12, textAlign: 'left' }}>
              <label>Volume</label>
              <input
                className="mu-input"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  void saveConfig({ volume: v });
                }}
              />
            </div>
            {msg && <p className="mu-muted">{msg}</p>}
            <p className="mu-note" style={{ marginTop: 8 }}>
              Import uses the system file picker only — the app does not scan your whole phone.
              Playback is offline from stored files.
            </p>
          </Card>

          {activePlaylist?.systemKey === 'workout' && (
            <Card>
              <p className="mu-note">
                Workout Music uses shuffle by default so it does <strong>not</strong> always begin
                at song #1. Anti-repeat avoids the immediate previous track when practical.
              </p>
            </Card>
          )}
        </>
      )}

      {tab === 'tracks' && (
        <>
          <SectionHeader
            title={activePlaylist ? activePlaylist.name : 'Tracks'}
            action={
              <Button variant="secondary" disabled={busy || !playlistId} onClick={importSongs}>
                + Import MP3
              </Button>
            }
          />
          {playlistTracks.length === 0 ? (
            <EmptyState
              icon="🎧"
              title="No songs imported"
              description="Tap Import MP3 and pick files explicitly. Nothing is auto-scanned."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {playlistTracks.map((t, i) => (
                <div
                  key={t.id}
                  className="mu-row"
                  style={{
                    borderBottom:
                      i < playlistTracks.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="mu-muted">
                      {t.fileName ?? t.mimeType}
                      {t.playCount ? ` · played ${t.playCount}×` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="mu-link"
                      onClick={() => {
                        musicPlayer.setQueue(playlistTracks, i);
                        void musicPlayer.playTrackAt(i);
                      }}
                    >
                      Play
                    </button>
                    <button type="button" className="mu-link" onClick={() => removeTrack(t)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <SectionHeader title="Music settings" />
          <Card>
            <label className="mu-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => saveConfig({ enabled: e.target.checked })}
              />
              Enabled
            </label>
            <label className="mu-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.nightMusicAskBeforePlay}
                onChange={(e) => saveConfig({ nightMusicAskBeforePlay: e.target.checked })}
              />
              Night music: ask YES/NO before play
            </label>
            <label className="mu-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.avoidImmediateRepeat}
                onChange={(e) => saveConfig({ avoidImmediateRepeat: e.target.checked })}
              />
              Avoid immediate song repeat
            </label>
            <label className="mu-field" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={config.preferLessPlayed}
                onChange={(e) => saveConfig({ preferLessPlayed: e.target.checked })}
              />
              Prefer less-played tracks in shuffle
            </label>
            <div className="mu-field">
              <label>Default volume</label>
              <input
                className="mu-input"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.volume}
                onChange={(e) => saveConfig({ volume: Number(e.target.value) })}
              />
            </div>
            <p className="mu-note">
              Android: the WebView file picker / Storage Access Framework is used for import.
              Broad “read all media” permission is not required for this flow.
            </p>
          </Card>
        </>
      )}

      {nightPrompt && (
        <div className="mu-modal" role="dialog" aria-label="Night music">
          <div className="mu-modal__card">
            <strong>Play Night Music?</strong>
            <p className="mu-muted">Configurable YES/NO before starting the Night playlist.</p>
            <div className="mu-controls" style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => void confirmNight(true)}>
                YES
              </Button>
              <Button variant="secondary" onClick={() => void confirmNight(false)}>
                NO
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
