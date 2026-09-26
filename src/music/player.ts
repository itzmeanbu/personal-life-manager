/**
 * Offline HTMLAudioElement player.
 * Plays object URLs from IndexedDB blobs — works with no network.
 * Does not scan the device library; only user-imported files.
 */

import { getBlob } from '../data/settings';
import type { MusicTrack } from '../data/types';
import { musicTracksRepo } from '../data/repository';

type Listener = () => void;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private queue: MusicTrack[] = [];
  private index = 0;
  private listeners = new Set<Listener>();
  private _playing = false;
  private _volume = 0.8;
  lastTrackId: string | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get playing() {
    return this._playing;
  }

  get current(): MusicTrack | null {
    return this.queue[this.index] ?? null;
  }

  get queueLength() {
    return this.queue.length;
  }

  get currentIndex() {
    return this.index;
  }

  setQueue(tracks: MusicTrack[], startIndex = 0) {
    this.queue = tracks;
    this.index = Math.min(Math.max(0, startIndex), Math.max(0, tracks.length - 1));
    this.emit();
  }

  setVolume(v: number) {
    this._volume = Math.min(1, Math.max(0, v));
    if (this.audio) this.audio.volume = this._volume;
    this.emit();
  }

  get volume() {
    return this._volume;
  }

  async playTrackAt(i: number): Promise<void> {
    if (i < 0 || i >= this.queue.length) return;
    this.index = i;
    const track = this.queue[i];
    await this.loadAndPlay(track);
  }

  async play(): Promise<void> {
    if (!this.audio) {
      if (this.queue.length === 0) return;
      await this.playTrackAt(this.index);
      return;
    }
    await this.audio.play();
    this._playing = true;
    this.emit();
  }

  pause() {
    this.audio?.pause();
    this._playing = false;
    this.emit();
  }

  toggle() {
    if (this._playing) this.pause();
    else void this.play();
  }

  async next() {
    if (this.queue.length === 0) return;
    const next = (this.index + 1) % this.queue.length;
    await this.playTrackAt(next);
  }

  async previous() {
    if (this.queue.length === 0) return;
    if (this.audio && this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    const prev = (this.index - 1 + this.queue.length) % this.queue.length;
    await this.playTrackAt(prev);
  }

  private async loadAndPlay(track: MusicTrack): Promise<void> {
    const blob = await getBlob(track.blobKey);
    if (!blob) throw new Error('Audio file missing offline — re-import the track');

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(blob);

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.addEventListener('ended', () => {
        void this.next();
      });
      this.audio.addEventListener('pause', () => {
        this._playing = false;
        this.emit();
      });
      this.audio.addEventListener('play', () => {
        this._playing = true;
        this.emit();
      });
    }

    this.audio.src = this.objectUrl;
    this.audio.volume = this._volume;
    this.lastTrackId = track.id;
    await this.audio.play();
    this._playing = true;

    // stats
    void musicTracksRepo.update(track.id, {
      playCount: (track.playCount ?? 0) + 1,
      lastPlayedAt: new Date().toISOString(),
    });

    this.emit();
  }

  stop() {
    this.pause();
    if (this.audio) {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.emit();
  }
}

/** Singleton player for the app. */
export const musicPlayer = new MusicPlayer();
