/**
 * Sequential day phase engine — ONE active phase at a time.
 * Config = times/rules. Engine = what shows now. Copy = contextual, not fixed slogans.
 */

import { getSetting, setSetting } from '../data/settings';
import { toIsoDate } from '../routine/engine';
import { effectiveDayStatus, type TomorrowDayOrder } from './spendPrompts';
import { TIME_SLOTS, liveClassLine, currentTimeSlot } from '../college/timetable';
import { getDayOrderForDate } from '../college/dayOrder';
import { fireOsNotification } from '../notify/engine';

export type SeqPhaseId =
  | 'GOOD_MORNING'
  | 'MORNING_ROUTINE'
  | 'LEAVE_HOME'
  | 'MORNING_BUS'
  | 'COLLEGE_ARRIVAL'
  | 'PERIOD'
  | 'CANTEEN'
  | 'COLLEGE_DEPARTURE'
  | 'EVENING_BUS'
  | 'HOME'
  | 'WORKOUT'
  | 'GUITAR'
  | 'NIGHT'
  | 'SLEEP'
  | 'WEEKEND_SPIN'
  | 'WHATS_TOMORROW';

export interface SeqPhase {
  id: SeqPhaseId;
  /** For PERIOD phases */
  periodSlotId?: string;
  periodNo?: number | null;
  label: string;
  icon: string;
  hint: string;
  /** Contextual line — adapted to wake/time */
  message: string;
  music?: 'bus' | 'night' | null;
  spend?: boolean;
}

export interface PhaseSeqState {
  date: string;
  /** Ordered list of phase keys completed today (e.g. "GOOD_MORNING", "PERIOD:p1") */
  completed: string[];
  /** Skipped keys */
  skipped: string[];
  /** Explicit jump (user advanced) */
  forceKey?: string | null;
  updatedAt: string;
}

const KEY = 'day.phaseSequence.v1';

function empty(date: string): PhaseSeqState {
  return {
    date,
    completed: [],
    skipped: [],
    forceKey: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getPhaseSeqState(iso: string): Promise<PhaseSeqState> {
  const s = await getSetting<PhaseSeqState | null>(KEY, null);
  if (!s || s.date !== iso) return empty(iso);
  return s;
}

export async function setPhaseSeqState(next: PhaseSeqState): Promise<PhaseSeqState> {
  const row = { ...next, updatedAt: new Date().toISOString() };
  await setSetting(KEY, row);
  window.dispatchEvent(new CustomEvent('phase-seq-changed', { detail: row }));
  return row;
}

function phaseKey(p: SeqPhase): string {
  if (p.id === 'PERIOD' && p.periodSlotId) return `PERIOD:${p.periodSlotId}`;
  return p.id;
}

/** Bus times (minutes). Configurable later via settings. */
export const BUS_FIRST_MIN = 6 * 60 + 15; // 6:15
export const BUS_SECOND_MIN = 6 * 60 + 50; // 6:50
export const COLLEGE_ARRIVAL_MIN = 9 * 60 + 10; // 9:10
export const COLLEGE_DEPART_MIN = 16 * 60 + 10; // ~after last period
export const WEEKEND_SPIN_END_MIN = 22 * 60; // 10:00 PM

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function morningBusAdvice(wakeMin: number | null, nowMin: number): {
  targetBusMin: number;
  message: string;
  late: boolean;
} {
  const ref = wakeMin ?? nowMin;
  // Still can make 6:15 if awake before ~5:35 and not past bus
  if (ref <= 5 * 60 + 30 && nowMin < BUS_FIRST_MIN - 5) {
    return {
      targetBusMin: BUS_FIRST_MIN,
      late: false,
      message: pick([
        `You've got time for the 6:15 bus — get ready, don't burn it on the phone.`,
        `6:15 bus is still on the table. Move through the morning list and head out.`,
        `Early enough for 6:15. Brush, face, bag — then go.`,
      ]),
    };
  }
  if (nowMin < BUS_SECOND_MIN - 5) {
    return {
      targetBusMin: BUS_SECOND_MIN,
      late: true,
      message: pick([
        `Running late for 6:15 — don't force it. Aim for the 6:50 bus and get ready properly.`,
        `Skip the panic. 6:50 is your bus; first period might slip and that's okay.`,
        `Too tight for 6:15. Target 6:50, finish the essentials, leave calm.`,
      ]),
    };
  }
  return {
    targetBusMin: BUS_SECOND_MIN,
    late: true,
    message: pick([
      `Buses are gone or nearly gone — if you're still going, leave now and join after first period.`,
      `Late start. Focus on getting out the door; catch whatever bus you can.`,
    ]),
  };
}

function periodMessage(periodNo: number | null, subject: string, startMin: number, nowMin: number): string {
  const minsTo = startMin - nowMin;
  if (minsTo > 5 && minsTo <= 15) {
    return pick([
      `Period ${periodNo ?? '?'} in about ${minsTo} min — ${subject}. Get moving.`,
      `Heads up: ${subject} starts soon (P${periodNo ?? '?'}).`,
    ]);
  }
  if (minsTo <= 5 && minsTo >= -5) {
    return pick([
      `Period ${periodNo ?? '?'} now — ${subject}.`,
      `You're in ${subject} (P${periodNo ?? '?'}). Stay with it.`,
    ]);
  }
  return pick([
    `Period ${periodNo ?? '?'} — ${subject}.`,
    `${subject} block. One period at a time.`,
  ]);
}

/**
 * Build ordered phase list for today based on day type + weekend.
 */
export async function buildPhaseList(
  date: Date,
  opts: {
    wakeMin: number | null;
    nowMin: number;
    dayStatus: TomorrowDayOrder | null;
  }
): Promise<SeqPhase[]> {
  const iso = toIsoDate(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const status = opts.dayStatus;
  const leaveLike =
    status === 'leave' ||
    status === 'coimbatore_stay' ||
    status === 'didnt_go' ||
    status === 'coding';
  const collegeDay =
    !isWeekend &&
    !leaveLike &&
    (status === 'college' || status === 'bunk' || status == null);

  const list: SeqPhase[] = [];
  const bus = morningBusAdvice(opts.wakeMin, opts.nowMin);

  // --- Morning always ---
  list.push({
    id: 'GOOD_MORNING',
    label: 'Good morning',
    icon: '☀️',
    hint: 'Start the day',
    message: pick([
      'Good morning. One step at a time.',
      'Hey — day starts here.',
      'Morning. Let’s see what’s next.',
    ]),
  });

  list.push({
    id: 'MORNING_ROUTINE',
    label: 'Morning routine',
    icon: '🧴',
    hint: 'Brush, wash, bag — each once',
    message: collegeDay
      ? bus.message
      : pick([
          'Weekend morning — do the basics, then free time.',
          'No college rush today. Finish morning checks at your pace.',
        ]),
  });

  if (isWeekend || leaveLike) {
    if (isWeekend) {
      list.push({
        id: 'WEEKEND_SPIN',
        label: 'Spin & free time',
        icon: '🎡',
        hint: 'Available until 10:00 PM',
        message: pick([
          'Weekend free time is yours until 10 PM — spin when you want.',
          'Rest day mode. Spin is open; no bus, no day order.',
        ]),
      });
    }
    list.push({
      id: 'WHATS_TOMORROW',
      label: "What's tomorrow?",
      icon: '📅',
      hint: 'Set next day type',
      message: pick([
        'Lock tomorrow’s type (college / leave / function) before you wind down.',
        'What’s tomorrow? One choice, then night mode.',
      ]),
    });
    list.push({
      id: 'NIGHT',
      label: 'Night',
      icon: '🌙',
      hint: 'Night checklist + music',
      message: pick(['Good night soon. Finish the night list.', 'Wind down — bath, serum, charge.']),
      music: 'night',
    });
    list.push({
      id: 'SLEEP',
      label: 'Sleep',
      icon: '😴',
      hint: 'Day ends here',
      message: pick(['Sleep. New day after midnight.', 'Rest well — journey resets tomorrow.']),
    });
    return list;
  }

  // --- College weekday ---
  list.push({
    id: 'LEAVE_HOME',
    label: 'Leave home',
    icon: '🚪',
    hint: `Target bus ~${String(Math.floor(bus.targetBusMin / 60)).padStart(2, '0')}:${String(bus.targetBusMin % 60).padStart(2, '0')}`,
    message: bus.message,
  });

  list.push({
    id: 'MORNING_BUS',
    label: 'Morning bus',
    icon: '🚌',
    hint: 'Random song + commute',
    message: pick([
      'On the bus — random track from your bus playlists.',
      'Commute mode. Music on; college next.',
    ]),
    music: 'bus',
    spend: true,
  });

  list.push({
    id: 'COLLEGE_ARRIVAL',
    label: 'At college',
    icon: '🏫',
    hint: 'Arrival ~9:10',
    message: pick([
      "You're at college. First class is coming up.",
      'Campus. Settle in — periods start one at a time.',
    ]),
  });

  // One phase per class/break/lunch slot (not a giant static list as the only UI)
  const dayOrder = await getDayOrderForDate(iso);
  for (const slot of TIME_SLOTS) {
    let subject = slot.label;
    if (dayOrder && slot.kind === 'class') {
      subject = liveClassLine(dayOrder, new Date(date));
      // liveClassLine uses "now" — for building list use slot label + resolve later in UI
      subject = slot.label;
    }
    const msg =
      slot.kind === 'lunch'
        ? pick(['Lunch window. Log canteen spend if you buy anything.', 'Break for food — canteen log is optional.'])
        : slot.kind === 'break'
          ? pick(['Short break. Stretch or canteen if you need.', 'Break — next period after this.'])
          : periodMessage(slot.periodNo, subject, slot.startMin, opts.nowMin);

    list.push({
      id: 'PERIOD',
      periodSlotId: slot.id,
      periodNo: slot.periodNo,
      label: slot.kind === 'class' ? `Period ${slot.periodNo}` : slot.label,
      icon: slot.kind === 'lunch' ? '🍜' : slot.kind === 'break' ? '☕' : '📚',
      hint: `${formatHm(slot.startMin)}–${formatHm(slot.endMin)}`,
      message: msg,
      spend: slot.kind === 'lunch' || slot.kind === 'break',
    });
  }

  list.push({
    id: 'COLLEGE_DEPARTURE',
    label: 'Leaving college',
    icon: '🚶',
    hint: 'Head to bus',
    message: pick(['College done for today. Evening bus next.', 'Time to leave campus.']),
  });

  list.push({
    id: 'EVENING_BUS',
    label: 'Evening bus',
    icon: '🚌',
    hint: 'Random song + ride home',
    message: pick(['Evening ride — another random track.', 'Bus home. Music on.']),
    music: 'bus',
    spend: true,
  });

  list.push({
    id: 'HOME',
    label: 'Home',
    icon: '🏠',
    hint: 'Back home',
    message: pick(["You're home. Extracurriculars next, one at a time.", 'Home base. Workout or rest — your list.']),
  });

  list.push({
    id: 'WORKOUT',
    label: 'Workout',
    icon: '🏋️',
    hint: 'Then guitar',
    message: pick(['Workout time. Get it done.', 'Training block — finish, then guitar.']),
  });

  list.push({
    id: 'GUITAR',
    label: 'Guitar',
    icon: '🎸',
    hint: 'Practice',
    message: pick(['Guitar practice. One focused block.', 'Strings time — then night routine.']),
  });

  list.push({
    id: 'WHATS_TOMORROW',
    label: "What's tomorrow?",
    icon: '📅',
    hint: 'Day type + day order if college',
    message: pick([
      "What's tomorrow? College keeps day order; leave does not freeze the week sequence.",
      'Set tomorrow, then good night.',
    ]),
  });

  list.push({
    id: 'NIGHT',
    label: 'Night',
    icon: '🌙',
    hint: 'Bath, serum, checklist',
    message: pick(['Good night soon 🌙 — night list, then sleep.', 'Wind down. Random night track if you want.']),
    music: 'night',
  });

  list.push({
    id: 'SLEEP',
    label: 'Sleep',
    icon: '😴',
    hint: 'End of day',
    message: pick(['Sleep. See you tomorrow.', 'Day locked. Rest.']),
  });

  return list;
}

function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function getCurrentSeqPhase(
  date: Date,
  wakeMin: number | null,
  nowMin: number
): Promise<{ phase: SeqPhase; list: SeqPhase[]; state: PhaseSeqState; index: number }> {
  const iso = toIsoDate(date);
  const dayStatus = await effectiveDayStatus(iso);
  const list = await buildPhaseList(date, { wakeMin, nowMin, dayStatus });
  const state = await getPhaseSeqState(iso);

  const done = new Set([...state.completed, ...state.skipped]);

  let index = 0;
  if (state.forceKey) {
    const fi = list.findIndex((p) => phaseKey(p) === state.forceKey);
    if (fi >= 0 && !done.has(state.forceKey)) index = fi;
  } else {
    index = list.findIndex((p) => !done.has(phaseKey(p)));
    if (index < 0) index = list.length - 1;
  }

  // Time-aware: if already past arrival, surface the live period
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const canBeOnCampus =
    !isWeekend &&
    (dayStatus === 'college' || dayStatus === 'bunk' || dayStatus == null);
  if (canBeOnCampus) {
    const probe = new Date(date);
    probe.setHours(Math.floor(nowMin / 60), nowMin % 60, 0, 0);
    const slot = currentTimeSlot(probe);
    if (slot && nowMin >= COLLEGE_ARRIVAL_MIN - 30) {
      const pk = `PERIOD:${slot.id}`;
      const pi = list.findIndex((p) => phaseKey(p) === pk);
      const curKey = phaseKey(list[index]!);
      if (
        pi > index &&
        !done.has(pk) &&
        (done.has('COLLEGE_ARRIVAL') || done.has('MORNING_BUS')) &&
        !curKey.startsWith('PERIOD')
      ) {
        index = pi;
      }
    }
  }

  const phase = list[index]!;
  return { phase, list, state, index };
}

export async function completeCurrentPhase(date: Date, key: string): Promise<PhaseSeqState> {
  const iso = toIsoDate(date);
  const state = await getPhaseSeqState(iso);
  const completed = state.completed.includes(key) ? state.completed : [...state.completed, key];
  return setPhaseSeqState({
    ...state,
    date: iso,
    completed,
    forceKey: null,
  });
}

export async function skipCurrentPhase(date: Date, key: string): Promise<PhaseSeqState> {
  const iso = toIsoDate(date);
  const state = await getPhaseSeqState(iso);
  const skipped = state.skipped.includes(key) ? state.skipped : [...state.skipped, key];
  return setPhaseSeqState({
    ...state,
    date: iso,
    skipped,
    forceKey: null,
  });
}

export async function notifyPhaseIfNeeded(phase: SeqPhase, iso: string): Promise<void> {
  const flagKey = `day.phaseNotified.${iso}.${phase.id}${phase.periodSlotId ? '.' + phase.periodSlotId : ''}`;
  const already = await getSetting<boolean>(flagKey, false);
  if (already) return;
  await fireOsNotification(phase.label, phase.message);
  await setSetting(flagKey, true);
}

export { phaseKey };
