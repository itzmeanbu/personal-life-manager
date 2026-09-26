import { db, ENTITY_TABLES } from './db';

/**
 * Backup/restore architecture.
 *
 * The entire local database (every entity table + blobs) is serialized to a
 * single JSON file the user can save wherever they like (device storage,
 * email to self, cloud drive, etc.) — no server involvement required, so
 * backup/restore works fully offline. Blobs (development photos) are
 * inlined as base64 data URIs so the backup file is self-contained.
 *
 * This is deliberately app-local and manual for now. See docs/DATABASE.md
 * ("Future sync strategy") for how this same payload shape becomes the
 * basis of an optional Render-backed sync later, without a breaking format
 * change.
 */

const BACKUP_FORMAT_VERSION = 1;

export interface BackupPayload {
  formatVersion: number;
  exportedAt: string;
  appVersion?: string;
  tables: Record<string, unknown[]>;
  blobs: Array<{ key: string; mimeType: string; dataBase64: string; createdAt: string }>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/** Builds the full backup payload in memory. */
export async function buildBackup(): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const name of ENTITY_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tables[name] = await (db as any)[name].toArray();
  }

  const blobRows = await db.blobs.toArray();
  const photoMimeByKey = new Map(
    (await db.developmentPhotos.toArray()).map((p) => [p.blobKey, p.mimeType])
  );
  const blobs = await Promise.all(
    blobRows.map(async (row) => ({
      key: row.key,
      mimeType: photoMimeByKey.get(row.key) ?? 'application/octet-stream',
      dataBase64: await blobToBase64(row.blob),
      createdAt: row.createdAt,
    }))
  );

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    blobs,
  };
}

/** Triggers a browser/WebView download of the backup as a .json file. */
export async function exportBackupToFile(fileName?: string): Promise<void> {
  const payload = await buildBackup();
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? `life-manager-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface RestoreOptions {
  /** 'replace' wipes each table before importing; 'merge' upserts by id. */
  mode: 'replace' | 'merge';
}

/** Restores a previously exported backup payload into the local database. */
export async function restoreBackup(
  payload: BackupPayload,
  options: RestoreOptions = { mode: 'merge' }
): Promise<void> {
  if (payload.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Backup was created by a newer app version (format v${payload.formatVersion}); ` +
        `please update the app before restoring.`
    );
  }

  await db.transaction(
    'rw',
    [...ENTITY_TABLES.map((name) => (db as unknown as Record<string, import('dexie').Table>)[name]), db.blobs],
    async () => {
      for (const name of ENTITY_TABLES) {
        const rows = payload.tables[name] ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = (db as any)[name] as import('dexie').Table;
        if (options.mode === 'replace') await table.clear();
        if (rows.length) await table.bulkPut(rows);
      }

      if (options.mode === 'replace') await db.blobs.clear();
      for (const b of payload.blobs) {
        await db.blobs.put({
          key: b.key,
          blob: base64ToBlob(b.dataBase64, b.mimeType),
          createdAt: b.createdAt,
        });
      }
    }
  );
}

/** Parses a File (e.g. from an <input type="file">) into a BackupPayload. */
export async function readBackupFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;
  if (typeof parsed.formatVersion !== 'number' || !parsed.tables) {
    throw new Error('This file does not look like a Life Manager backup.');
  }
  return parsed;
}


/* -------------------- Optional encrypted backup (AES-GCM) -------------------- */

const ENC_PREFIX = 'LMENC1:';

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 120_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Encrypts backup JSON string with a user passphrase. */
export async function encryptBackupJson(json: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(json)
  );
  return (
    ENC_PREFIX +
    JSON.stringify({
      salt: bufToB64(salt.buffer),
      iv: bufToB64(iv.buffer),
      data: bufToB64(cipher),
    })
  );
}

export async function decryptBackupJson(text: string, passphrase: string): Promise<string> {
  if (!text.startsWith(ENC_PREFIX)) return text;
  const payload = JSON.parse(text.slice(ENC_PREFIX.length)) as {
    salt: string;
    iv: string;
    data: string;
  };
  const key = await deriveKey(passphrase, b64ToBuf(payload.salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(payload.iv) as BufferSource },
    key,
    b64ToBuf(payload.data) as BufferSource
  );
  return new TextDecoder().decode(plain);
}

export async function exportBackupToFileOptions(opts?: {
  fileName?: string;
  passphrase?: string;
}): Promise<void> {
  const payload = await buildBackup();
  let body = JSON.stringify(payload);
  if (opts?.passphrase) {
    body = await encryptBackupJson(body, opts.passphrase);
  }
  const blob = new Blob([body], {
    type: opts?.passphrase ? 'text/plain' : 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const base = opts?.fileName ?? `life-manager-backup-${payload.exportedAt.slice(0, 10)}`;
  a.download = opts?.passphrase ? `${base}.lmenc` : `${base}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readBackupFileWithPassphrase(
  file: File,
  passphrase?: string
): Promise<BackupPayload> {
  let text = await file.text();
  if (text.startsWith(ENC_PREFIX)) {
    if (!passphrase) throw new Error('This backup is encrypted — enter the passphrase.');
    text = await decryptBackupJson(text, passphrase);
  }
  const parsed = JSON.parse(text) as BackupPayload;
  if (typeof parsed.formatVersion !== 'number' || !parsed.tables) {
    throw new Error('This file does not look like a Life Manager backup.');
  }
  return parsed;
}
