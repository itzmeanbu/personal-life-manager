/**
 * Entity type definitions for the offline-first local data layer.
 * Every table in db.ts stores rows shaped by one of these interfaces.
 *
 * Conventions:
 * - `id`        : string UUID, generated on the client (works fully offline).
 * - `createdAt` / `updatedAt` : ISO-8601 timestamps (string), set locally.
 * - `deleted`   : soft-delete flag used by the backup/restore + future sync layer.
 * - `syncedAt`  : ISO timestamp of the last successful sync with the backend, or
 *                 null if the row has never been synced (offline-only for now).
 */

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  syncedAt: string | null;
}

/* ---------------------------- Routines & Tasks --------------------------- */

/**
 * The Daily Routine Engine's core entity. Nothing about a person's actual
 * routine is hard-coded anywhere in the app — every field below is set,
 * changed, reordered, enabled/disabled, or removed entirely through the
 * Routines screen (`src/pages/RoutineManager.tsx`). See
 * `docs/ROUTINE_ENGINE.md` for the full design.
 */
export interface Routine extends BaseEntity {
  title: string;
  notes?: string;
  /** Free-text, user-defined grouping (e.g. "Hygiene", "Fitness", "Study").
   *  Not a fixed enum — the app derives the list of known categories from
   *  whatever categories already exist on other routines. */
  category: string;
  /** 'recurring' repeats per `cadence`; 'one-time' fires once on `date`. */
  kind: 'recurring' | 'one-time';
  cadence: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';
  /** 0=Sun..6=Sat. Used when cadence is 'weekly' or 'custom' — the days
   *  this routine repeats on. Ignored for 'daily' / 'weekdays' / 'weekends'. */
  activeDays: number[];
  /** ISO date (yyyy-mm-dd). Only used when kind === 'one-time'. */
  date?: string;
  /** "HH:mm" 24h scheduled time. Optional — untimed routines sort last. */
  time?: string;
  durationMinutes?: number;
  /** Manual sort weight (lower = earlier). Reassigned by the reorder UI;
   *  never assumed to be contiguous or gapless. */
  order: number;
  /** Temporarily turn a routine off without deleting its history/config.
   *  Disabled routines are skipped by the engine but stay fully editable. */
  enabled: boolean;
  /** Soft-hide from every normal view (distinct from `deleted`, which is
   *  the backup/sync soft-delete flag) — reserved for a future "archive
   *  instead of delete" UI action; the current UI deletes (soft-deletes). */
  archived: boolean;
  reminder: {
    enabled: boolean;
    /** Minutes before `time` the in-app reminder should surface. 0 = at time. */
    offsetMinutes: number;
  };
  moduleTag?: string; // optional link to a module, e.g. 'workout', 'guitar', 'college'
}

export interface Task extends BaseEntity {
  title: string;
  notes?: string;
  dueDate?: string; // ISO date
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'done' | 'cancelled';
  routineId?: string; // if generated from a Routine
  moduleTag?: string;
}

export interface CompletionRecord extends BaseEntity {
  date: string; // ISO date (yyyy-mm-dd), the day this completion applies to
  refType: 'routine' | 'task';
  refId: string;
  status: 'done' | 'skipped' | 'missed' | 'partial';
  note?: string;
}

/* --------------------------------- Fitness / Workout Engine ---------------- */

/**
 * How an exercise is prescribed. Not everything is a timer.
 * - sets_reps: classic 3 × 8–15
 * - total_reps: e.g. 50 total, ~10 at a time, rest between
 * - duration: hold / plank for N seconds
 * - custom: free-text instructions only
 */
export type ExerciseModality = 'sets_reps' | 'total_reps' | 'duration' | 'custom';

/** Reusable exercise in the library — fully editable. */
export interface ExerciseDef extends BaseEntity {
  name: string;
  /** Short cue shown on the session card. */
  instructions?: string;
  /** Longer how-to / form notes. */
  tutorial?: string;
  /** Optional external or local video URL. */
  videoUrl?: string;
  /** Hint for future animation / gif key. */
  animationKey?: string;
  notes?: string;
  defaultModality: ExerciseModality;
  defaultSets?: number;
  defaultRepsMin?: number;
  defaultRepsMax?: number;
  /** For total_reps modality. */
  defaultTotalReps?: number;
  /** Suggested chunk size when doing total reps (e.g. 10 at a time). */
  defaultChunkReps?: number;
  defaultDurationSeconds?: number;
  defaultRestSeconds?: number;
  /** Configured training benefits tags, e.g. 'chest', 'core'. */
  benefits: string[];
  enabled: boolean;
  order: number;
}

/** One exercise slot inside a day template. */
export interface WorkoutTemplateItem {
  id: string;
  /** Link to ExerciseDef when available; name is always stored for offline display. */
  exerciseId?: string;
  name: string;
  modality: ExerciseModality;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  totalReps?: number;
  chunkReps?: number;
  durationSeconds?: number;
  restSeconds?: number;
  /** Overrides library instructions for this program slot. */
  customInstructions?: string;
  order: number;
}

/**
 * A day in the training program (Mon Upper, Tue Legs, Wed Rest, …).
 * dayIndex: 0=Sun … 6=Sat. null = unscheduled / floating template.
 */
export interface WorkoutTemplate extends BaseEntity {
  name: string;
  dayIndex: number | null;
  isRest: boolean;
  /** e.g. 'Upper Body', 'Legs', 'Full Body'. */
  focus: string;
  benefits: string[];
  items: WorkoutTemplateItem[];
  enabled: boolean;
  order: number;
  notes?: string;
}

/** Logged performance for one exercise within a session. */
export interface WorkoutExerciseLog {
  itemId: string;
  exerciseId?: string;
  name: string;
  modality: ExerciseModality;
  /** Per-set results; length may be less than prescribed if stopped early. */
  setsDone: Array<{
    reps?: number;
    durationSeconds?: number;
    skipped?: boolean;
  }>;
  /** For total_reps: how many reps completed overall. */
  totalRepsDone?: number;
  status: 'pending' | 'done' | 'skipped' | 'partial';
  notes?: string;
}

/**
 * One completed / in-progress / skipped workout occasion.
 * History is built only from real sessions — nothing is invented.
 */
export interface WorkoutSession extends BaseEntity {
  date: string; // yyyy-mm-dd
  templateId?: string;
  /** Snapshot of template name/focus so history survives template edits. */
  title: string;
  focus: string;
  benefits: string[];
  status: 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  exercises: WorkoutExerciseLog[];
  notes?: string;
}

/** @deprecated shape kept only for migration awareness — use WorkoutExerciseLog. */
export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
}

/**
 * Guitar practice log. Duration is whatever the user records — default
 * target (e.g. 60 min) lives in settings, not hard-coded into rows.
 */
export interface GuitarSession extends BaseEntity {
  date: string; // yyyy-mm-dd
  /** Actual practice length in minutes. */
  durationMinutes: number;
  status: 'completed' | 'skipped' | 'partial';
  focus?: string;
  songOrPiece?: string;
  notes?: string;
  /** Target minutes at the time of logging (snapshot; settings may change later). */
  targetMinutes?: number;
}

/**
 * Sleep log for one night. `date` is the calendar date of the bedtime
 * evening (or wake morning — we use bedtime local date for consistency).
 * No late-night % is hard-coded; adherence uses configurable target + tolerance.
 */
export interface SleepRecord extends BaseEntity {
  /** Local date associated with this night (yyyy-mm-dd), typically the evening date. */
  date: string;
  /** Bedtime as "HH:mm" local (preferred for stats). */
  bedtimeHm?: string;
  /** Optional full ISO if known. */
  sleepTime?: string;
  wakeTime?: string;
  /** Wake time "HH:mm" local. */
  wakeHm?: string;
  durationMinutes?: number;
  quality?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  /**
   * Snapshot vs target at log time:
   * on_time = within tolerance of target; late = after target+tolerance; early = before.
   */
  adherence?: 'on_time' | 'late' | 'early' | 'unknown';
}

/* --------------------------------- College -------------------------------- */

/**
 * Configurable activity categories for the College tracker
 * (attended, bunked, canteen, coding, games, etc.).
 * Users can add / rename / disable / delete categories freely.
 */
export interface CollegeCategory extends BaseEntity {
  name: string;
  /** Optional emoji / monogram shown in the UI. */
  icon?: string;
  /** Lower = higher in lists. */
  order: number;
  /** Disabled categories stay in history but cannot be logged against. */
  enabled: boolean;
  /**
   * System keys for built-in categories the UI treats specially
   * (e.g. 'attended', 'bunked'). Custom categories have null.
   */
  systemKey?: 'attended' | 'bunked' | null;
}

/** One logged activity against a category on a given date. */
export interface CollegeActivity extends BaseEntity {
  date: string; // yyyy-mm-dd local
  categoryId: string;
  /** How many times this activity occurred that day (default 1). */
  count: number;
  notes?: string;
}

/**
 * Day-level college status. Separate from activity logs so the user can
 * mark attended/bunked without necessarily logging every sub-activity.
 * When status === 'bunked', homeArrivalTime is the chosen early-home time.
 */
export interface CollegeDayStatus extends BaseEntity {
  date: string; // yyyy-mm-dd local, unique per day
  status: 'attended' | 'bunked' | 'none';
  /** "HH:mm" — only meaningful when status === 'bunked'. */
  homeArrivalTime?: string;
  notes?: string;
}

/** Legacy / optional academic records (assignments, exams, grades). */
export interface CollegeRecord extends BaseEntity {
  type: 'assignment' | 'exam' | 'class' | 'grade' | 'note';
  title: string;
  subject?: string;
  dueDate?: string;
  score?: number;
  maxScore?: number;
  notes?: string;
}

/* ---------------------------------- Money --------------------------------- */

/**
 * Who covered an expense. Never assumed — user picks each time.
 * - self: I paid
 * - friend: friend paid (not my cash out)
 * - split: shared; amount = my share (or full with splitNote)
 */
export type MoneyPaidBy = 'self' | 'friend' | 'split';

export interface MoneyTransaction extends BaseEntity {
  date: string; // yyyy-mm-dd
  type: 'income' | 'expense' | 'starting';
  amount: number;
  /** bus, canteen, snacks, food, transport, custom, etc. */
  category?: string;
  note?: string;
  paidBy?: MoneyPaidBy;
  /** Friend name when paidBy is friend/split. */
  personName?: string;
  /** My share when paidBy is split (defaults to amount if unset). */
  myShare?: number;
}

export interface LendingRecord extends BaseEntity {
  date: string;
  personName: string;
  amount: number;
  /** Sum of partial repayments received. */
  amountRepaid: number;
  reason?: string;
  dueDate?: string;
  status: 'outstanding' | 'partial' | 'settled';
  settledDate?: string;
  notes?: string;
}

export interface BorrowingRecord extends BaseEntity {
  date: string;
  personName: string;
  amount: number;
  /** Sum of partial amounts I have paid back. */
  amountRepaid: number;
  reason?: string;
  dueDate?: string;
  status: 'outstanding' | 'partial' | 'settled';
  settledDate?: string;
  notes?: string;
}

/* --------------------------------- Vehicles -------------------------------- */

/**
 * Mileage (km/L) is ALWAYS user-configured — never permanently assumed as 55.
 * Default is only a seed suggestion the user can change.
 */
export interface Vehicle extends BaseEntity {
  name: string;
  type: 'bike' | 'car' | 'other';
  regNumber?: string;
  odometerAtCreation?: number;
  /** Expected km per litre — editable, not hard-coded forever. */
  expectedMileageKmPerL: number;
  /** Default fuel price ₹/L for money→litres conversion. */
  fuelPricePerLitre: number;
  /** Warn when remaining range (km) falls at or below this. */
  lowRangeWarnKm: number;
  enabled: boolean;
  /** Sold: keep history, stop active tracking. */
  sold: boolean;
  soldDate?: string;
  notes?: string;
  /**
   * Tracking period start (ISO date). Distance/fuel before this can still
   * exist in history; range calc uses records from this date forward unless reset.
   */
  trackingStartedAt?: string;
}

export interface FuelRecord extends BaseEntity {
  vehicleId: string;
  date: string;
  litres: number;
  /** Money spent (optional if litres entered directly). */
  cost?: number;
  /** How entry was made. */
  entryMode: 'litres' | 'money';
  /** Price used for conversion when entryMode is money. */
  pricePerLitreUsed?: number;
  odometer?: number;
  fullTank?: boolean;
  notes?: string;
}

export interface DistanceRecord extends BaseEntity {
  vehicleId: string;
  date: string;
  km: number;
  purpose?: string;
  notes?: string;
}

export type MaintenanceKind = 'oil_change' | 'service' | 'tyre' | 'other' | 'reset_tracking';

export interface MaintenanceRecord extends BaseEntity {
  vehicleId: string;
  date: string;
  kind: MaintenanceKind;
  cost?: number;
  odometer?: number;
  notes?: string;
}

/* ------------------------------- Misc modules ------------------------------ */

/**
 * One slice on a spin wheel. Can be a leaf activity or a gateway to a
 * nested child wheel (unlimited depth via childWheelId).
 */
export interface SpinWheelOption {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  /** When set, selecting this option drills into that wheel. */
  childWheelId?: string | null;
  /** Suggested duration for leaf activities (minutes). */
  durationMinutes?: number;
  /**
   * Local "HH:mm" — option is only eligible at/after this time.
   * Example: evening-only social after 18:00. null/undefined = always.
   */
  availableAfterHm?: string | null;
  availableBeforeHm?: string | null;
  /** If set, only these weekdays (0=Sun … 6=Sat). Empty/undefined = any day. */
  availableDays?: number[];
  notes?: string;
  /** Free tags (e.g. "naveen_anna") — data only, not hard-coded behaviour. */
  tags?: string[];
  weight?: number; // relative spin weight, default 1
}

/**
 * Configurable recursive spin wheel. Categories are never hard-coded in UI
 * logic — seed data is just initial rows the user can rewrite entirely.
 */
export interface SpinWheel extends BaseEntity {
  name: string;
  /** null/undefined = top-level (entry) wheel. */
  parentWheelId?: string | null;
  /** Entry wheels surface on Weekend / Spin hub. */
  isRoot: boolean;
  enabled: boolean;
  order: number;
  options: SpinWheelOption[];
  notes?: string;
  lastResult?: string;
  lastResultOptionId?: string;
  lastSpunAt?: string;
}

/** Optional log of spins for history (not invented — real timestamps). */
export interface SpinHistory extends BaseEntity {
  date: string; // yyyy-mm-dd
  wheelId: string;
  wheelName: string;
  optionId: string;
  optionLabel: string;
  /** Breadcrumb of wheel names from root to leaf. */
  path: string[];
  /** Planned minutes at accept (may be capped by time-until-cutoff). */
  durationMinutes?: number;
  /** Original option duration before budget cap. */
  plannedMinutes?: number;
  /** Wall-clock start (ISO). Set when user starts / accepts. */
  startedAt?: string;
  /** Wall-clock end (ISO). Set when timer finishes or user marks done. */
  endedAt?: string;
  /** Actual elapsed minutes (from startedAt→endedAt), not a fake receipt. */
  actualMinutes?: number;
  completed: boolean;
}

/**
 * User-defined entertainment category (K-drama, Anime, TV, Movies, custom…).
 * Seed rows are data only — not hard-coded content lists.
 */
export interface EntertainmentCategory extends BaseEntity {
  name: string;
  icon?: string;
  order: number;
  enabled: boolean;
  /**
   * System keys for optional defaults (e.g. binge settings for k-drama).
   * Custom categories use null.
   */
  systemKey?: 'kdrama' | 'anime' | 'tv' | 'movies' | null;
  /**
   * Default session / binge length in minutes when spinning or starting
   * from this category (e.g. K-drama default 4h = 240). Fully editable.
   */
  defaultBingeMinutes?: number;
  notes?: string;
}

/** One title on a category watchlist — never pre-filled with specific shows. */
export interface WatchlistItem extends BaseEntity {
  title: string;
  categoryId: string;
  /** Legacy/simple type tag; prefer categoryId. */
  mediaType?: 'movie' | 'series' | 'anime' | 'book' | 'other' | 'kdrama' | 'tv';
  /** watched = done; unwatched covers planned + in progress unless status set. */
  watched: boolean;
  status?: 'planned' | 'watching' | 'completed' | 'dropped';
  /**
   * Last episode you finished (1-based).
   * Continue from episode + 1. Example: episode=2 → "continue from ep 3".
   */
  episode?: number;
  totalEpisodes?: number;
  /** ISO timestamp of last time you logged progress — real, not invented. */
  lastWatchedAt?: string;
  /** Short note like "paused mid-ep" — optional. */
  leftOffNote?: string;
  rating?: number;
  notes?: string;
  /** Optional override binge/session minutes for this title. */
  bingeMinutes?: number;
  order: number;
}


/* ---------------------------------- Music --------------------------------- */

/** Playlist metadata. Tracks live in MusicTrack rows. */
export interface MusicPlaylist extends BaseEntity {
  name: string;
  /** systemKey for seeded playlists; null for user-created. */
  systemKey?: 'workout' | 'night' | 'commute' | null;
  enabled: boolean;
  order: number;
  shuffleDefault: boolean;
  notes?: string;
}

/** One imported local audio file (MP3 etc). Bytes in blobs table via blobKey. */
export interface MusicTrack extends BaseEntity {
  playlistId: string;
  title: string;
  /** Original filename if known. */
  fileName?: string;
  mimeType: string;
  /** Key into blobs table — offline local storage. */
  blobKey: string;
  durationSeconds?: number;
  order: number;
  /** How many times played (for soft anti-repeat weighting). */
  playCount: number;
  lastPlayedAt?: string;
}

/**
 * Personal development is a RECORD system only.
 * No invented achievements, missions, levels, or personality labels.
 * The user writes what happened.
 */
export interface DevelopmentRecord extends BaseEntity {
  date: string; // yyyy-mm-dd
  /** User category, e.g. stage_fear, new_person, english, custom */
  category: string;
  title: string;
  notes?: string;
  /** Optional linked local photo id */
  photoId?: string;
}

export interface DevelopmentPhoto extends BaseEntity {
  developmentRecordId?: string;
  date: string;
  caption?: string;
  /** old = past reference; current = newer/current look — local only */
  kind: 'old' | 'current' | 'other';
  /** Local blob storage key inside the `blobs` table — never auto-uploaded. */
  blobKey: string;
  mimeType: string;
}

/** People the user tracks for calls / hangouts. Fully user-managed. */
export interface Friend extends BaseEntity {
  name: string;
  notes?: string;
  enabled: boolean;
  /**
   * Special flag for Naveen Anna — separate from generic friends.
   * Activity “Spend time with Naveen Anna” is configurable elsewhere (spin etc.).
   */
  isNaveenAnna?: boolean;
  order: number;
}

/** Call / meet / message log — user-entered only. */
export interface SocialRecord extends BaseEntity {
  date: string;
  kind: 'call' | 'meet' | 'message' | 'other';
  friendId?: string;
  personName: string;
  notes?: string;
  durationMinutes?: number;
}

/**
 * Full-stack (and other) learning session log.
 * Categories are configurable data — not locked to a fixed curriculum.
 */
export interface LearningSession extends BaseEntity {
  date: string;
  /** e.g. Frontend, Backend, Database, … */
  category: string;
  topic: string;
  durationMinutes: number;
  status: 'completed' | 'skipped' | 'partial';
  notes?: string;
  /** Main goal tag — default full-stack; editable. */
  goal?: string;
}

export interface BucketListItem extends BaseEntity {
  title: string;
  description?: string;
  category?: string;
  status: 'planned' | 'in_progress' | 'done';
  /** Created date snapshot (yyyy-mm-dd); also have createdAt from BaseEntity. */
  createdDate?: string;
  targetDate?: string;
  completedDate?: string;
  notes?: string;
  /** Optional local photo blob key — never auto-uploaded. */
  photoBlobKey?: string;
  order: number;
}

export interface Milestone extends BaseEntity {
  title: string;
  date: string;
  category?: string;
  notes?: string;
}

/**
 * Calendar markers (birthdays, anniversaries, etc.) — separate from Day Profiles.
 */
export interface SpecialDay extends BaseEntity {
  title: string;
  date: string; // ISO date; if recurring, month/day are reused yearly
  recurring: boolean;
  reminderDaysBefore?: number;
  category?: string; // 'birthday' | 'anniversary' | custom
}

/* ---------------------------- Day Profiles (Special Days) ------------------ */

/**
 * One checklist item defined on a DayProfile template.
 * Instance completion is stored on DayAssignment.checklistDone.
 */
export interface DayChecklistItem {
  id: string;
  title: string;
}

/** Time rewrite rule applied when this profile is active. */
export interface DayTimeOverride {
  /** Match routine by exact title (optional). */
  matchTitle?: string;
  /** Match routine by category (optional). */
  matchCategory?: string;
  /** Match routine by moduleTag (optional). */
  matchModuleTag?: string;
  /** New "HH:mm" scheduled time. */
  newTime: string;
}

/** Extra agenda line injected for the day (not a permanent Routine row). */
export interface DayExtraAgendaItem {
  id: string;
  title: string;
  time?: string;
  category: string;
  durationMinutes?: number;
  notes?: string;
  moduleTag?: string;
}

/**
 * All behavioural effects a Day Profile can apply.
 * Everything is data — new profiles need zero code changes.
 */
export interface DayProfileEffects {
  /**
   * If true, normal weekday/weekend routines are suppressed except those
   * that pass the keep rules; only extraAgendaItems + kept routines show.
   * If false, base routines stay and filters/overrides layer on top.
   */
  replaceBaseRoutines: boolean;
  /** Skip routines whose moduleTag is in this list (e.g. 'workout'). */
  disableModuleTags: string[];
  /** Skip routines in these categories. */
  disableCategories: string[];
  /** Skip routines with these exact titles. */
  disableRoutineTitles: string[];
  timeOverrides: DayTimeOverride[];
  extraAgendaItems: DayExtraAgendaItem[];
  /**
   * Module ids to hide from Home / drawer when this profile is active.
   * Example: hide 'workout', 'bike' on Exam Day.
   */
  hideModules: string[];
  /**
   * If non-empty, ONLY these module ids (+ always-visible ones like today/settings)
   * appear on Home. Empty = show everything not in hideModules.
   */
  focusModules: string[];
  checklist: DayChecklistItem[];
  foodPlan?: string;
  travelPlan?: string;
  bannerMessage?: string;
  /** Spin wheel names to surface on the day page (matched at runtime). */
  activateSpinWheelNames: string[];
}

/**
 * Editable template for a kind of day: Exam Day, Hackathon, Holiday, etc.
 * Creating a new custom day type is just inserting a DayProfile row.
 */
export interface DayProfile extends BaseEntity {
  name: string;
  icon?: string;
  description?: string;
  order: number;
  enabled: boolean;
  /**
   * Built-in keys the app may auto-link (e.g. bunk → 'bunk').
   * Custom profiles use null.
   */
  systemKey?:
    | 'normal'
    | 'bunk'
    | 'exam'
    | 'hackathon'
    | 'event'
    | 'holiday'
    | 'rest'
    | 'stay_out'
    | 'coimbatore_stay'
    | 'coding'
    | 'sunday'
    | null;
  effects: DayProfileEffects;
}

/**
 * Assigns a DayProfile to a concrete calendar date.
 * One active assignment per date (latest non-deleted wins if duplicates).
 */
export interface DayAssignment extends BaseEntity {
  date: string; // yyyy-mm-dd
  profileId: string;
  notes?: string;
  /** Checklist item ids the user has checked off for this instance. */
  checklistDone: string[];
}

/* ------------------------------ Day Journey (phases) ------------------------------ */

/**
 * One step of the guided "walk through today" flow (e.g. "Morning To-Do",
 * "College", "Workout", "Evening", "Sleep"). A phase is just a label plus a
 * way to say which items belong to it — it doesn't contain the items
 * itself, it points at existing Routines by `moduleTags` (matches
 * `Routine.moduleTag`) and/or `categories` (matches `Routine.category`,
 * for routines that have no moduleTag, like morning hygiene items).
 *
 * The logic that resolves "which routines count as this phase, today" and
 * decides when a phase is complete lives in `src/day/phaseEngine.ts`
 * (added separately) — this type only defines the shape and is fully
 * user-editable data, not a hard-coded list of steps.
 */
export interface Phase extends BaseEntity {
  name: string;
  icon?: string;
  /** Position in the day's sequence. Lower runs first. */
  order: number;
  enabled: boolean;
  /** Matches Routine.moduleTag (e.g. 'college', 'workout', 'guitar'). */
  moduleTags: string[];
  /** Matches Routine.category, for routines with no moduleTag. */
  categories: string[];
  /** 0=Sun..6=Sat. Empty = this phase is considered every day (subject to
   *  each module's own weekly schedule, added in a later prompt). */
  activeDays: number[];
}

/**
 * One row per calendar date, tracking progress through that day's phases.
 * `phaseIdsToday` is the ordered list of phases that applied to this date
 * (already resolved once, at the start of the day, so editing a Phase
 * later doesn't retroactively change a day already in progress).
 */
export interface DayProgress extends BaseEntity {
  date: string; // yyyy-mm-dd
  phaseIdsToday: string[];
  /** Null once every phase for the day is complete. */
  currentPhaseId: string | null;
  completedPhaseIds: string[];
}


/* ------------------------------ Settings / config --------------------------- */

export interface AppSetting extends BaseEntity {
  /** Single-row-per-key table; `id` === `key`. */
  key: string;
  value: unknown;
}

export interface FeatureToggle extends BaseEntity {
  /** Single-row-per-feature table; `id` === `feature` key. */
  feature: string;
  enabled: boolean;
}

export interface AutomationSetting extends BaseEntity {
  name: string;
  trigger: string; // e.g. 'daily_reset', 'weekend_mode', 'streak_check'
  config: Record<string, unknown>;
  enabled: boolean;
}

/** Raw binary storage for photos etc., kept separate from metadata rows. */
export interface BlobRecord {
  key: string; // matches DevelopmentPhoto.blobKey
  blob: Blob;
  createdAt: string;
}


/* ----------------------------- Gamification ----------------------------- */

/** Configurable achievement definition — not hard-coded unlock logic only in UI. */
export interface AchievementDef extends BaseEntity {
  key: string;
  title: string;
  description: string;
  /** Metric key the engine evaluates, e.g. workout_sessions, guitar_minutes */
  metric: string;
  threshold: number;
  xpReward: number;
  enabled: boolean;
  order: number;
  icon?: string;
}

export interface AchievementUnlock extends BaseEntity {
  achievementKey: string;
  unlockedAt: string;
  notified?: boolean;
}

export type EntityName =
  | 'routines'
  | 'tasks'
  | 'completionRecords'
  | 'workoutSessions'
  | 'exerciseDefs'
  | 'workoutTemplates'
  | 'guitarSessions'
  | 'sleepRecords'
  | 'collegeRecords'
  | 'collegeCategories'
  | 'collegeActivities'
  | 'collegeDayStatuses'
  | 'moneyTransactions'
  | 'lendingRecords'
  | 'borrowingRecords'
  | 'vehicles'
  | 'fuelRecords'
  | 'distanceRecords'
  | 'maintenanceRecords'
  | 'spinWheels'
  | 'spinHistories'
  | 'entertainmentCategories'
  | 'watchlistItems'
  | 'musicPlaylists'
  | 'musicTracks'
  | 'developmentRecords'
  | 'developmentPhotos'
  | 'socialRecords'
  | 'friends'
  | 'learningSessions'
  | 'bucketListItems'
  | 'milestones'
  | 'achievementDefs'
  | 'achievementUnlocks'
  | 'specialDays'
  | 'dayProfiles'
  | 'dayAssignments'
  | 'appSettings'
  | 'featureToggles'
  | 'automationSettings'
  | 'phases'
  | 'dayProgress';
