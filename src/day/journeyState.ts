/**
 * Day journey state machine — one active phase at a time.
 *
 * MORNING_BEFORE_LEAVING → MORNING_BUS → COLLEGE → EVENING_BUS → HOME_EVENING
 *   → WHATS_TOMORROW → NIGHT
 *
 * Special / leave / weekend days skip college + bus legs.
 * Persisted per calendar date so reopen restores correctly.
 */

import { getSetting, setSetting } from '../data/settings';
import { effectiveDayStatus, statusSkipsCollege, type TomorrowDayOrder } from './spendPrompts';
import { toIsoDate } from '../routine/engine';

export type JourneyPhaseId =
  | 'MORNING_BEFORE_LEAVING'
  | 'MORNING_BUS'
  | 'COLLEGE'
  | 'EVENING_BUS'
  | 'HOME_EVENING'
  | 'WHATS_TOMORROW'
  | 'NIGHT';

export interface JourneyState {
  date: string;
  phase: JourneyPhaseId;
  /** User confirmed left home (or auto by time/location). */
  leftHome: boolean;
  /** User confirmed at college. */
  reachedCollege: boolean;
  /** User confirmed left college / day ended on campus. */
  leftCollege: boolean;
  /** User confirmed back home after evening. */
  reachedHome: boolean;
  /** "What's tomorrow?" finished → night. */
  tomorrowDone: boolean;
  /** Optional sub-status while in COLLEGE (mirrors day status). */
  collegeMode: TomorrowDayOrder | null;
  updatedAt: string;
}

const KEY = 'day.journeyState.v1';

export const JOURNEY_PHASE_META: Record<
  JourneyPhaseId,
  { label: string; icon: string; hint: string }
> = {
  MORNING_BEFORE_LEAVING: {
    label: 'Morning — before leaving',
    icon: '☀️',
    hint: 'Checks, bag, timetable, leave home',
  },
  MORNING_BUS: {
    label: 'Bus to college',
    icon: '🚌',
    hint: 'Music + travel only',
  },
  COLLEGE: {
    label: 'College',
    icon: '🎓',
    hint: 'Status, periods, free time if any',
  },
  EVENING_BUS: {
    label: 'Bus home',
    icon: '🚌',
    hint: 'Music + travel only',
  },
  HOME_EVENING: {
    label: 'Home — evening',
    icon: '🏠',
    hint: 'Workout, guitar, evening routines',
  },
  WHATS_TOMORROW: {
    label: "What's tomorrow?",
    icon: '📅',
    hint: 'Confirm tomorrow plan + day order',
  },
  NIGHT: {
    label: 'Night',
    icon: '🌙',
    hint: 'Good night, night routine, music',
  },
};

function empty(date: string): JourneyState {
  return {
    date,
    phase: 'MORNING_BEFORE_LEAVING',
    leftHome: false,
    reachedCollege: false,
    leftCollege: false,
    reachedHome: false,
    tomorrowDone: false,
    collegeMode: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getJourneyState(iso: string): Promise<JourneyState> {
  const s = await getSetting<JourneyState | null>(KEY, null);
  if (!s || s.date !== iso) return empty(iso);
  return s;
}

export async function setJourneyState(next: JourneyState): Promise<JourneyState> {
  const row = { ...next, updatedAt: new Date().toISOString() };
  await setSetting(KEY, row);
  window.dispatchEvent(new CustomEvent('journey-state-changed', { detail: row }));
  return row;
}

export async function patchJourney(
  iso: string,
  patch: Partial<Omit<JourneyState, 'date'>>
): Promise<JourneyState> {
  const cur = await getJourneyState(iso);
  return setJourneyState({ ...cur, ...patch, date: iso });
}

/** Ordered legs for a normal college weekday. */
const COLLEGE_FLOW: JourneyPhaseId[] = [
  'MORNING_BEFORE_LEAVING',
  'MORNING_BUS',
  'COLLEGE',
  'EVENING_BUS',
  'HOME_EVENING',
  'WHATS_TOMORROW',
  'NIGHT',
];

/**
 * Leave / Coimbatore stay / didn't-go:
 * Morning after wake + night routines + spend only (no bus/college).
 */
const LEAVE_FLOW: JourneyPhaseId[] = [
  'MORNING_BEFORE_LEAVING',
  'WHATS_TOMORROW',
  'NIGHT',
];

/**
 * Sat/Sun = NOT college. Morning → free time / spin → tomorrow → night.
 * Outing/event uses special day profile, still no college bus unless user forces college status.
 */
const WEEKEND_FLOW: JourneyPhaseId[] = [
  'MORNING_BEFORE_LEAVING',
  'HOME_EVENING',
  'WHATS_TOMORROW',
  'NIGHT',
];

export function flowForDay(opts: {
  isWeekend: boolean;
  dayStatus: TomorrowDayOrder | null;
}): JourneyPhaseId[] {
  // Weekend is never a normal college day (outing ≠ college)
  if (opts.isWeekend) {
    if (opts.dayStatus === 'college') {
      // Explicit override only if user forces college on weekend (rare event)
      return COLLEGE_FLOW;
    }
    return WEEKEND_FLOW;
  }
  const s = opts.dayStatus;
  if (
    s === 'leave' ||
    s === 'coimbatore_stay' ||
    s === 'didnt_go' ||
    s === 'coding'
  ) {
    return LEAVE_FLOW;
  }
  return COLLEGE_FLOW;
}

/** True when day is leave-like (incl. Coimbatore stay). */
export function isLeaveStyleDay(status: TomorrowDayOrder | null | undefined): boolean {
  return (
    status === 'leave' ||
    status === 'coimbatore_stay' ||
    status === 'didnt_go' ||
    status === 'coding'
  );
}

/**
 * Infer / advance phase from clock + flags.
 * Manual transitions (left home, reached college, …) always win.
 */
export async function resolveJourneyPhase(
  date: Date,
  nowMin: number
): Promise<JourneyState> {
  const iso = toIsoDate(date);
  let state = await getJourneyState(iso);
  const dayStatus = await effectiveDayStatus(iso);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const flow = flowForDay({ isWeekend, dayStatus });

  // Clamp phase to valid flow (e.g. after status change)
  if (!flow.includes(state.phase)) {
    state = await setJourneyState({
      ...state,
      phase: flow[0] ?? 'MORNING_BEFORE_LEAVING',
      collegeMode: dayStatus,
    });
  }

  // Sync college mode from day status when in college leg
  if (state.collegeMode !== dayStatus) {
    state = await setJourneyState({ ...state, collegeMode: dayStatus });
  }

  // Time-based auto advances (only if user hasn't already moved further)
  const idx = flow.indexOf(state.phase);

  // ~6:15+ and still at morning before leave → suggest bus if leftHome
  // User actions set leftHome; time alone doesn't force leave.

  // After 16:30 if at college and not left → still college (user marks left)
  // After 20:00 if home evening not reached → stay
  // After 21:30 prefer what's tomorrow / night if evening done
  if (
    state.phase === 'HOME_EVENING' &&
    nowMin >= 21 * 60 + 30 &&
    flow.includes('WHATS_TOMORROW')
  ) {
    // soft nudge only via UI — don't auto-skip evening tasks
  }

  if (state.tomorrowDone && state.phase !== 'NIGHT' && flow.includes('NIGHT')) {
    state = await setJourneyState({ ...state, phase: 'NIGHT' });
  }

  // Ensure phase index is consistent
  void idx;
  return state;
}

export async function advanceTo(
  iso: string,
  phase: JourneyPhaseId,
  flags?: Partial<JourneyState>
): Promise<JourneyState> {
  const cur = await getJourneyState(iso);
  return setJourneyState({
    ...cur,
    ...flags,
    phase,
    date: iso,
  });
}

/** User actions — each advances and sets flags so reopen stays correct. */
export async function actionLeftHome(iso: string): Promise<JourneyState> {
  const status = await effectiveDayStatus(iso);
  if (isLeaveStyleDay(status)) {
    // Leave / Coimbatore: no bus — jump toward evening plan / tomorrow
    return advanceTo(iso, 'WHATS_TOMORROW', { leftHome: true, reachedHome: true });
  }
  if (statusSkipsCollege(status) && status !== 'bunk') {
    return advanceTo(iso, 'HOME_EVENING', { leftHome: true });
  }
  return advanceTo(iso, 'MORNING_BUS', { leftHome: true });
}

export async function actionReachedCollege(iso: string): Promise<JourneyState> {
  return advanceTo(iso, 'COLLEGE', { leftHome: true, reachedCollege: true });
}

export async function actionLeftCollege(iso: string): Promise<JourneyState> {
  return advanceTo(iso, 'EVENING_BUS', {
    leftHome: true,
    reachedCollege: true,
    leftCollege: true,
  });
}

export async function actionReachedHome(iso: string): Promise<JourneyState> {
  return advanceTo(iso, 'HOME_EVENING', {
    leftHome: true,
    leftCollege: true,
    reachedHome: true,
  });
}

export async function actionOpenWhatsTomorrow(iso: string): Promise<JourneyState> {
  return advanceTo(iso, 'WHATS_TOMORROW', { reachedHome: true });
}

export async function actionFinishWhatsTomorrow(iso: string): Promise<JourneyState> {
  return advanceTo(iso, 'NIGHT', { tomorrowDone: true });
}

/** What UI blocks are allowed for a phase (exclusive). */
export function phaseAllows(phase: JourneyPhaseId) {
  return {
    morningChecklist: phase === 'MORNING_BEFORE_LEAVING',
    leaveAsks: phase === 'MORNING_BEFORE_LEAVING',
    mealMorning: phase === 'MORNING_BEFORE_LEAVING',
    lateWake: phase === 'MORNING_BEFORE_LEAVING',
    timetablePreview: phase === 'MORNING_BEFORE_LEAVING' || phase === 'COLLEGE',
    busMusic: phase === 'MORNING_BUS' || phase === 'EVENING_BUS',
    collegeStatus: phase === 'COLLEGE',
    periodBoard: phase === 'COLLEGE',
    freeTimeSpin: phase === 'COLLEGE' || phase === 'HOME_EVENING',
    eveningRoutines: phase === 'HOME_EVENING',
    whatsTomorrow: phase === 'WHATS_TOMORROW',
    nightRoutine: phase === 'NIGHT',
    nightMusic: phase === 'NIGHT',
    /** Spend prompts — leave/Coimbatore days + anytime active windows */
    spend: true,
  };
}
