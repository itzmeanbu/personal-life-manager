/**
 * Private media: import into IndexedDB blobs under media/* keys.
 * Does NOT write to DCIM/Pictures/Downloads or trigger the public Gallery scanner.
 * On Android WebView this stays inside the app origin's private storage.
 */

import { saveBlob, getBlob, deleteBlob } from '../data/settings';
import { generateId } from '../data/repository';
import { getSetting, setSetting } from '../data/settings';
import { MEDIA_KEYS } from './settings';

export interface MediaIndexEntry {
  key: string;
  kind: 'background' | 'logo' | 'other';
  title: string;
  mimeType: string;
  createdAt: string;
  thumbKey?: string;
}

const INDEX_KEY = 'media.index';

export async function getMediaIndex(): Promise<MediaIndexEntry[]> {
  return (await getSetting<MediaIndexEntry[]>(INDEX_KEY, [])) ?? [];
}

async function setMediaIndex(entries: MediaIndexEntry[]): Promise<void> {
  await setSetting(INDEX_KEY, entries);
}

/** Downscale for dashboard performance — max edge 1600px, JPEG ~0.82 */
export async function compressImage(
  file: Blob,
  maxEdge = 1600,
  quality = 0.82
): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, mimeType: file.type || 'image/jpeg' };
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', quality)
    );
    return { blob: blob ?? file, mimeType: blob ? 'image/jpeg' : file.type || 'image/jpeg' };
  } catch {
    return { blob: file, mimeType: file.type || 'image/jpeg' };
  }
}

async function makeThumb(file: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 240;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.7));
  } catch {
    return null;
  }
}

export async function importBackgroundPhoto(file: File): Promise<MediaIndexEntry> {
  const id = generateId();
  const key = MEDIA_KEYS.background(id);
  const { blob, mimeType } = await compressImage(file);
  await saveBlob(key, blob);
  let thumbKey: string | undefined;
  const thumb = await makeThumb(blob);
  if (thumb) {
    thumbKey = MEDIA_KEYS.thumb(key);
    await saveBlob(thumbKey, thumb);
  }
  const entry: MediaIndexEntry = {
    key,
    kind: 'background',
    title: file.name.replace(/\.[^.]+$/, '') || 'Background',
    mimeType,
    createdAt: new Date().toISOString(),
    thumbKey,
  };
  const index = await getMediaIndex();
  index.push(entry);
  await setMediaIndex(index);
  return entry;
}

export async function importLogo(file: File): Promise<string> {
  const id = generateId();
  const key = MEDIA_KEYS.logo(id);
  const { blob } = await compressImage(file, 512, 0.9);
  await saveBlob(key, blob);
  const index = await getMediaIndex();
  index.push({
    key,
    kind: 'logo',
    title: file.name,
    mimeType: blob.type || 'image/jpeg',
    createdAt: new Date().toISOString(),
  });
  await setMediaIndex(index);
  return key;
}

export async function removeMedia(key: string): Promise<void> {
  const index = await getMediaIndex();
  const entry = index.find((e) => e.key === key);
  await deleteBlob(key);
  if (entry?.thumbKey) await deleteBlob(entry.thumbKey).catch(() => undefined);
  await setMediaIndex(index.filter((e) => e.key !== key));
}

export async function blobUrl(key: string): Promise<string | null> {
  const b = await getBlob(key);
  if (!b) return null;
  return URL.createObjectURL(b);
}

export function listBackgrounds(index: MediaIndexEntry[]): MediaIndexEntry[] {
  return index.filter((e) => e.kind === 'background');
}
