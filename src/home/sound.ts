/**
 * Optional "I'm home" sound. Uses Web Audio beep as a portable default;
 * on Android a native asset can replace homeSoundId later.
 */

let lastPlayed = 0;

export async function playHomeSound(soundId: string): Promise<void> {
  // Debounce accidental double fires
  const now = Date.now();
  if (now - lastPlayed < 3000) return;
  lastPlayed = now;

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Slightly different pitch per id so user can tell configs apart later
    osc.frequency.value = soundId === 'im_home' ? 523.25 : 440;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.stop(ctx.currentTime + 0.65);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio blocked until user gesture — ignore
  }
}
