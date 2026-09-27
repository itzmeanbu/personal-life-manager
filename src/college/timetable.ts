/**
 * Class timetable — RVS Institute of Technology, Coimbatore
 * Dept: Artificial Intelligence and Data Science
 * Class: III AIDS-A | Semester: ODD | AY 2026-27 | W.E.F 2.07.2026
 *
 * Day Order 1 = row 1, … Day Order 6 = row 6.
 * Live period is computed from clock time + today's day-order number.
 */

export interface SubjectInfo {
  code: string;
  name: string;
  short: string;
  faculty?: string;
}

export const SUBJECTS: Record<string, SubjectInfo> = {
  '24UAD501': {
    code: '24UAD501',
    name: 'Deep Learning',
    short: 'DL',
    faculty: 'Mrs. R. Sukanya',
  },
  '24UCW502': {
    code: '24UCW502',
    name: 'Data and Information Security',
    short: 'DIS',
    faculty: 'Mrs. C. Tamilarasi',
  },
  '24UCS503': {
    code: '24UCS503',
    name: 'Distributed Computing',
    short: 'DC',
    faculty: 'Mr. P. Sarun',
  },
  '24UPE118': {
    code: '24UPE118',
    name: 'Big Data Analytics (INT)',
    short: 'BDA',
    faculty: 'Mrs. K. Ramya',
  },
  '24UPE218': {
    code: '24UPE218',
    name: 'Cloud Services Management (INT)',
    short: 'CSM',
    faculty: 'Mrs. R. Vimala',
  },
  '24UPE413': {
    code: '24UPE413',
    name: 'Quantum Computing (INT)',
    short: 'QC',
    faculty: 'Mr. N. Indrajith',
  },
  '24UMX504': {
    code: '24UMX504',
    name: 'Disaster Risk Reduction and Management',
    short: 'DRRM',
    faculty: 'Ms. M. Vanitha / Mrs. C. Tamilarasi',
  },
  '24UAD521': {
    code: '24UAD521',
    name: 'Deep Learning Lab',
    short: 'DL Lab',
    faculty: 'Mrs. R. Sukanya',
  },
  LIB: { code: 'LIB', name: 'Library', short: 'Library', faculty: 'Mrs. C. Tamilarasi' },
  PT: { code: 'PT', name: 'Physical Training / Free', short: 'PT' },
  SKM: { code: 'SKM', name: 'Seminar / Skill', short: 'SKM' },
  TWM: {
    code: 'TWM',
    name: 'Tutorial / Mentoring',
    short: 'TWM',
    faculty: 'Mr. T. Kalaivanan / Mrs. C. Tamilarasi',
  },
  SEMINAR: { code: 'SEMINAR', name: 'Seminar', short: 'Seminar', faculty: 'Mr. N. Indrajith' },
  BREAK: { code: 'BREAK', name: 'Break', short: 'Break' },
  LUNCH: { code: 'LUNCH', name: 'Lunch Break', short: 'Lunch' },
};

/** Fixed clock slots (minutes from midnight). */
export interface TimeSlot {
  id: string;
  /** Display period number on the printed TT (1–7), or null for break/lunch */
  periodNo: number | null;
  label: string;
  startMin: number;
  endMin: number;
  kind: 'class' | 'break' | 'lunch';
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: 'p1', periodNo: 1, label: 'Period 1', startMin: 9 * 60, endMin: 9 * 60 + 55, kind: 'class' },
  { id: 'p2', periodNo: 2, label: 'Period 2', startMin: 9 * 60 + 55, endMin: 10 * 60 + 40, kind: 'class' },
  { id: 'brk', periodNo: null, label: 'Break', startMin: 10 * 60 + 40, endMin: 11 * 60, kind: 'break' },
  { id: 'p3', periodNo: 3, label: 'Period 3', startMin: 11 * 60, endMin: 11 * 60 + 50, kind: 'class' },
  { id: 'p4', periodNo: 4, label: 'Period 4', startMin: 11 * 60 + 50, endMin: 12 * 60 + 40, kind: 'class' },
  { id: 'lunch', periodNo: null, label: 'Lunch', startMin: 12 * 60 + 40, endMin: 13 * 60 + 40, kind: 'lunch' },
  { id: 'p5', periodNo: 5, label: 'Period 5', startMin: 13 * 60 + 40, endMin: 14 * 60 + 30, kind: 'class' },
  { id: 'p6', periodNo: 6, label: 'Period 6', startMin: 14 * 60 + 35, endMin: 15 * 60 + 20, kind: 'class' },
  { id: 'p7', periodNo: 7, label: 'Period 7', startMin: 15 * 60 + 20, endMin: 16 * 60 + 10, kind: 'class' },
];

/**
 * Cell content for one class slot.
 * `code` is subject code or special (LIB, PT, …).
 * Lab cells may span two periods — listed in both with spanNote.
 */
export interface TimetableCell {
  code: string;
  /** Extra label e.g. LAB-125 */
  room?: string;
  isLab?: boolean;
}

/** dayOrder 1..6 → slot id → cell (only class slots; break/lunch are fixed). */
export type DayOrderGrid = Record<number, Partial<Record<string, TimetableCell>>>;

/**
 * Extracted from the official CLASS TIME TABLE photo.
 * Lab blocks that span 3+4 or 5–6 are duplicated on both period keys.
 */
export const DAY_ORDER_GRID: DayOrderGrid = {
  1: {
    p1: { code: '24UPE218' }, // CSM
    p2: { code: '24UAD521', isLab: true, room: 'Lab' }, // DL Lab
    p3: { code: '24UAD521', isLab: true, room: 'Lab-125' },
    p4: { code: '24UAD521', isLab: true, room: 'Lab-125' },
    p5: { code: '24UCW502' }, // DIS
    p6: { code: '24UPE118' }, // BDA
    p7: { code: '24UPE413' }, // QC
  },
  2: {
    p1: { code: '24UCS503' }, // DC
    p2: { code: '24UAD501' }, // DL
    p3: { code: '24UPE413', isLab: true, room: 'Lab-125' }, // QC Lab
    p4: { code: '24UPE413', isLab: true, room: 'Lab-125' },
    p5: { code: 'LIB' },
    p6: { code: '24UPE218' }, // CSM
    p7: { code: 'PT' },
  },
  3: {
    p1: { code: '24UPE413' }, // QC
    p2: { code: '24UPE118' }, // BDA
    p3: { code: '24UCW502' }, // DIS
    p4: { code: '24UCS503' }, // DC
    p5: { code: '24UAD501' }, // DL
    p6: { code: '24UCW502' }, // DIS
    p7: { code: '24UCS503' }, // DC
  },
  4: {
    p1: { code: '24UCW502' }, // DIS
    p2: { code: '24UPE413' }, // QC
    p3: { code: '24UPE218' }, // CSM
    p4: { code: '24UAD501' }, // DL
    p5: { code: '24UMX504' }, // DRRM
    p6: { code: '24UMX504' }, // continues / paired
    p7: { code: 'SKM' },
  },
  5: {
    p1: { code: '24UPE118' }, // BDA
    p2: { code: '24UCW502' }, // DIS
    p3: { code: '24UPE118', isLab: true, room: 'Lab-125' }, // BDA Lab
    p4: { code: '24UPE118', isLab: true, room: 'Lab-125' },
    p5: { code: '24UPE413' }, // QC
    p6: { code: '24UCS503' }, // DC
    p7: { code: 'TWM' },
  },
  6: {
    p1: { code: '24UAD501' }, // DL
    p2: { code: '24UPE218' }, // CSM
    p3: { code: '24UCS503' }, // DC
    p4: { code: '24UAD501' }, // DL
    p5: { code: '24UPE218', isLab: true, room: 'Lab-125' }, // CSM Lab
    p6: { code: '24UPE218', isLab: true, room: 'Lab-125' },
    p7: { code: '24UPE118' }, // BDA
  },
};

export function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatMinHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function currentTimeSlot(now = new Date()): TimeSlot | null {
  const m = minutesNow(now);
  return TIME_SLOTS.find((s) => m >= s.startMin && m < s.endMin) ?? null;
}

export function resolveCell(
  dayOrder: number,
  slotId: string
): { cell: TimetableCell | null; subject: SubjectInfo | null } {
  const grid = DAY_ORDER_GRID[dayOrder];
  if (!grid) return { cell: null, subject: null };
  const cell = grid[slotId] ?? null;
  if (!cell) return { cell: null, subject: null };
  const subject = SUBJECTS[cell.code] ?? {
    code: cell.code,
    name: cell.code,
    short: cell.code,
  };
  return { cell, subject };
}

/** Human line for live banner — names only, no subject codes. */
export function liveClassLine(dayOrder: number, now = new Date()): string {
  const slot = currentTimeSlot(now);
  if (!slot) return 'Outside class hours';
  if (slot.kind === 'break') return 'Break (10:40 – 11:00)';
  if (slot.kind === 'lunch') return 'Lunch break (12:40 – 1:40)';
  const { cell, subject } = resolveCell(dayOrder, slot.id);
  if (!subject) return `${slot.label} — free / not listed`;
  const lab = cell?.isLab ? ' Lab' : '';
  const room = cell?.room && cell.room !== 'Lab' ? ` · ${cell.room}` : '';
  return `${slot.label}: ${subject.name}${lab}${room}`;
}

/** Full day schedule lines — names only, no codes. */
export function scheduleForDayOrder(dayOrder: number): {
  slot: TimeSlot;
  line: string;
}[] {
  return TIME_SLOTS.map((slot) => {
    if (slot.kind === 'break') {
      return { slot, line: 'Break' };
    }
    if (slot.kind === 'lunch') {
      return { slot, line: 'Lunch break' };
    }
    const { cell, subject } = resolveCell(dayOrder, slot.id);
    if (!subject) return { slot, line: '—' };
    const lab = cell?.isLab ? ' Lab' : '';
    const room =
      cell?.room && cell.room !== 'Lab' ? ` (${cell.room})` : '';
    return { slot, line: `${subject.name}${lab}${room}` };
  });
}
