import { db } from './db';

/**
 * Settings and feature toggles are stored as single-row-per-key tables
 * (id === key) rather than through the generic Repository, since callers
 * want a plain get/set(key, value) API, not a list of records.
 */

function nowIso(): string {
  return new Date().toISOString();
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await db.appSettings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const existing = await db.appSettings.get(key);
  await db.appSettings.put({
    id: key,
    key,
    value,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    deleted: false,
    syncedAt: null,
  });
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.appSettings.toArray();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function isFeatureEnabled(feature: string, defaultEnabled = true): Promise<boolean> {
  const row = await db.featureToggles.get(feature);
  return row ? row.enabled : defaultEnabled;
}

export async function setFeatureEnabled(feature: string, enabled: boolean): Promise<void> {
  const existing = await db.featureToggles.get(feature);
  await db.featureToggles.put({
    id: feature,
    feature,
    enabled,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    deleted: false,
    syncedAt: null,
  });
}

export async function getAllFeatureToggles(): Promise<Record<string, boolean>> {
  const rows = await db.featureToggles.toArray();
  return Object.fromEntries(rows.map((r) => [r.feature, r.enabled]));
}

/* ------------------------------ Blob storage ------------------------------ */
// Used by developmentPhotos and any future module that stores images locally.

export async function saveBlob(key: string, blob: Blob): Promise<void> {
  await db.blobs.put({ key, blob, createdAt: nowIso() });
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const row = await db.blobs.get(key);
  return row?.blob;
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key);
}
