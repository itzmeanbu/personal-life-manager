/**
 * PIN/password hashing.
 *
 * Never store the raw PIN/password anywhere, ever. We store only:
 *   salt (random, per-secret)  +  PBKDF2-SHA256 derived hash
 * using the Web Crypto SubtleCrypto API, which is available in both the
 * Vite web build and the Capacitor Android WebView — no extra native
 * dependency needed just for hashing.
 *
 * 150,000 iterations follows OWASP's current PBKDF2-SHA256 minimum
 * recommendation for a device-local, rate-limited secret (see
 * docs/SECURITY.md for the full rationale and the brute-force cooldown
 * that backs it up).
 */

const PBKDF2_ITERATIONS = 150_000;
const HASH_BITS = 256;

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toBase64(bytes.buffer);
}

export async function hashSecret(secret: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BITS
  );
  return toBase64(derived);
}

/** Constant-time-ish comparison to avoid trivial timing side-channels on hash comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Generates a human-typeable recovery code, e.g. "7F3K-9QXT-2M4L". Shown once at setup. */
export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) {
      group += alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
    }
    groups.push(group);
  }
  return groups.join('-');
}
