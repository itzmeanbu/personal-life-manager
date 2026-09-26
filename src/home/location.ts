/**
 * Location reads — Capacitor Geolocation when native, browser geolocation otherwise.
 * Does not invent continuous background tracking on web.
 */

import { Capacitor } from '@capacitor/core';
import type { HomeLocation } from './types';

export interface LatLng {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/** Haversine distance in meters. */
export function distanceMeters(a: LatLng, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isInsideHome(pos: LatLng, home: HomeLocation): boolean {
  return distanceMeters(pos, home) <= home.radiusMeters;
}

/**
 * One-shot current position.
 * Native: dynamic-imports @capacitor/geolocation if present.
 * Web: navigator.geolocation (foreground only).
 */
export async function getCurrentPosition(): Promise<LatLng> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Optional dependency — present after `npm i @capacitor/geolocation`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('@capacitor/geolocation');
      const Geolocation = mod.Geolocation ?? mod.default;
      const perm = await Geolocation.requestPermissions();
      const loc = perm.location === 'denied' || perm.coarseLocation === 'denied';
      if (loc) throw new Error('Location permission denied');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (err) {
      // Fall through to browser API inside WebView if plugin missing
      console.warn('[home/location] Capacitor geolocation unavailable:', err);
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not available on this platform'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || 'Location error')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}
