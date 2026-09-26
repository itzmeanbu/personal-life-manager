/**
 * Explicit user file import only — never scans the whole device library.
 * Uses the browser/WebView file picker (on Android this is the system document picker).
 */

import { saveBlob } from '../data/settings';
import { musicTracksRepo, generateId } from '../data/repository';

export async function importMp3Files(
  playlistId: string,
  fileList: FileList | File[]
): Promise<number> {
  const files = Array.from(fileList).filter(
    (f) =>
      f.type.startsWith('audio/') ||
      /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)
  );
  if (files.length === 0) return 0;

  const existing = (await musicTracksRepo.list()).filter(
    (t) => t.playlistId === playlistId && !t.deleted
  );
  let order = existing.reduce((m, t) => Math.max(m, t.order), -1);

  for (const file of files) {
    order += 1;
    const blobKey = `music:${generateId()}`;
    await saveBlob(blobKey, file);
    const title = file.name.replace(/\.[^.]+$/, '') || file.name;
    await musicTracksRepo.create({
      playlistId,
      title,
      fileName: file.name,
      mimeType: file.type || 'audio/mpeg',
      blobKey,
      order,
      playCount: 0,
    });
  }
  return files.length;
}

/**
 * Open the system/file picker for audio. Does not request broad storage
 * permission to scan all music — only the files the user selects.
 */
export function openAudioFilePicker(multiple = true): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg';
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(input.files);
      input.remove();
    };
    input.oncancel = () => {
      resolve(null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}
