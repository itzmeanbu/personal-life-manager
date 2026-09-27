/**
 * Display helpers — storage stays "HH:mm" 24h; UI shows 12-hour.
 */

/** "21:30" → "9:30 PM", "07:00" → "7:00 AM" */
export function formatHm12(hm?: string | null): string {
  if (!hm || !hm.includes(':')) return hm ?? '—';
  const [hs, ms] = hm.split(':');
  let h = Number(hs);
  const m = Number(ms);
  if (Number.isNaN(h) || Number.isNaN(m)) return hm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** ISO timestamp → local 12h clock */
export function formatIsoTime12(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}
