import Dexie, { type Table } from 'dexie';
import type {
  Routine,
  Task,
  CompletionRecord,
  WorkoutSession,
  ExerciseDef,
  WorkoutTemplate,
  GuitarSession,
  SleepRecord,
  CollegeRecord,
  CollegeCategory,
  CollegeActivity,
  CollegeDayStatus,
  MoneyTransaction,
  LendingRecord,
  BorrowingRecord,
  Vehicle,
  FuelRecord,
  DistanceRecord,
  MaintenanceRecord,
  SpinWheel,
  SpinHistory,
  EntertainmentCategory,
  WatchlistItem,
  MusicPlaylist,
  MusicTrack,
  DevelopmentRecord,
  DevelopmentPhoto,
  Friend,
  SocialRecord,
  LearningSession,
  BucketListItem,
  Milestone,
  AchievementDef,
  AchievementUnlock,
  SpecialDay,
  DayProfile,
  DayAssignment,
  AppSetting,
  FeatureToggle,
  AutomationSetting,
  BlobRecord,
  Phase,
  DayProgress,
} from './types';

/**
 * LifeManagerDB — single offline-first IndexedDB database (via Dexie).
 *
 * Why IndexedDB/Dexie instead of a native SQLite plugin:
 * - The app ships as a Capacitor WebView on Android. IndexedDB is fully
 *   supported inside that WebView (Chromium-based on modern Android), is
 *   transactional, persists across app close/restart, and needs zero native
 *   plugin/build config — satisfying "robust local database" without adding
 *   a native dependency surface.
 * - It is the SAME engine on web preview and on Android, so there is one
 *   code path to maintain and test instead of two storage backends.
 * - If a future need arises for heavier relational querying or SQL-based
 *   reporting, `@capacitor-community/sqlite` can be swapped in behind the
 *   `Repository` interface (see repository.ts) without touching page code.
 *   See docs/DATABASE.md ("Future sync / storage evolution").
 *
 * Every table's primary key is `id` (client-generated UUID) so records can be
 * created fully offline with no server round-trip. `updatedAt` + `deleted`
 * indexes support incremental backup and a future delta-sync strategy.
 */
export class LifeManagerDB extends Dexie {
  routines!: Table<Routine, string>;
  tasks!: Table<Task, string>;
  completionRecords!: Table<CompletionRecord, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  exerciseDefs!: Table<ExerciseDef, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  guitarSessions!: Table<GuitarSession, string>;
  sleepRecords!: Table<SleepRecord, string>;
  collegeRecords!: Table<CollegeRecord, string>;
  collegeCategories!: Table<CollegeCategory, string>;
  collegeActivities!: Table<CollegeActivity, string>;
  collegeDayStatuses!: Table<CollegeDayStatus, string>;
  moneyTransactions!: Table<MoneyTransaction, string>;
  lendingRecords!: Table<LendingRecord, string>;
  borrowingRecords!: Table<BorrowingRecord, string>;
  vehicles!: Table<Vehicle, string>;
  fuelRecords!: Table<FuelRecord, string>;
  distanceRecords!: Table<DistanceRecord, string>;
  maintenanceRecords!: Table<MaintenanceRecord, string>;
  spinWheels!: Table<SpinWheel, string>;
  spinHistories!: Table<SpinHistory, string>;
  entertainmentCategories!: Table<EntertainmentCategory, string>;
  watchlistItems!: Table<WatchlistItem, string>;
  musicPlaylists!: Table<MusicPlaylist, string>;
  musicTracks!: Table<MusicTrack, string>;
  developmentRecords!: Table<DevelopmentRecord, string>;
  developmentPhotos!: Table<DevelopmentPhoto, string>;
  friends!: Table<Friend, string>;
  socialRecords!: Table<SocialRecord, string>;
  learningSessions!: Table<LearningSession, string>;
  bucketListItems!: Table<BucketListItem, string>;
  milestones!: Table<Milestone, string>;
  achievementDefs!: Table<AchievementDef, string>;
  achievementUnlocks!: Table<AchievementUnlock, string>;
  specialDays!: Table<SpecialDay, string>;
  dayProfiles!: Table<DayProfile, string>;
  dayAssignments!: Table<DayAssignment, string>;
  appSettings!: Table<AppSetting, string>;
  featureToggles!: Table<FeatureToggle, string>;
  automationSettings!: Table<AutomationSetting, string>;
  blobs!: Table<BlobRecord, string>;
  phases!: Table<Phase, string>;
  dayProgress!: Table<DayProgress, string>;

  constructor() {
    super('LifeManagerDB');

    // Version 1 schema. Indexes list only fields we actually query by;
    // Dexie always indexes the primary key regardless.
    this.version(1).stores({
      routines: 'id, moduleTag, archived, updatedAt, deleted',
      tasks: 'id, status, dueDate, routineId, moduleTag, updatedAt, deleted',
      completionRecords: 'id, date, refType, refId, updatedAt, deleted',
      workoutSessions: 'id, date, updatedAt, deleted',
      guitarSessions: 'id, date, updatedAt, deleted',
      sleepRecords: 'id, date, updatedAt, deleted',
      collegeRecords: 'id, type, dueDate, updatedAt, deleted',
      moneyTransactions: 'id, date, type, category, updatedAt, deleted',
      lendingRecords: 'id, personName, status, dueDate, updatedAt, deleted',
      borrowingRecords: 'id, personName, status, dueDate, updatedAt, deleted',
      vehicles: 'id, type, updatedAt, deleted',
      fuelRecords: 'id, vehicleId, date, updatedAt, deleted',
      distanceRecords: 'id, vehicleId, date, updatedAt, deleted',
      spinWheels: 'id, name, updatedAt, deleted',
      watchlistItems: 'id, mediaType, status, updatedAt, deleted',
      developmentRecords: 'id, area, date, updatedAt, deleted',
      developmentPhotos: 'id, developmentRecordId, date, updatedAt, deleted',
      bucketListItems: 'id, status, updatedAt, deleted',
      milestones: 'id, date, updatedAt, deleted',
      specialDays: 'id, date, recurring, updatedAt, deleted',
      appSettings: 'id, key, updatedAt',
      featureToggles: 'id, feature, updatedAt',
      automationSettings: 'id, trigger, enabled, updatedAt, deleted',
      blobs: 'key, createdAt',
    });

    // Version 2 — Daily Routine Engine. `routines` gained: category, kind,
    // date (one-time), time, order, enabled, reminder{}; dropped the old
    // free-text `description`/`reminderTime` fields in favour of `notes`/
    // `time`+`reminder`. `completionRecords` gained a 'missed' status (not
    // an indexed field, so completionRecords' index list is unchanged and
    // doesn't need to be repeated here — Dexie carries over any table
    // whose `.stores()` entry is omitted in a later version).
    this.version(2)
      .stores({
        routines: 'id, category, kind, moduleTag, enabled, archived, order, updatedAt, deleted',
      })
      .upgrade(async (tx) => {
        let nextOrder = 0;
        await tx
          .table('routines')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .toCollection()
          .modify((row: any) => {
            row.category = row.category ?? row.moduleTag ?? 'General';
            row.kind = row.kind ?? 'recurring';
            row.notes = row.notes ?? row.description;
            delete row.description;
            row.time = row.time ?? row.reminderTime;
            row.reminder = row.reminder ?? {
              enabled: Boolean(row.reminderTime),
              offsetMinutes: 0,
            };
            delete row.reminderTime;
            row.enabled = row.enabled ?? true;
            row.order = typeof row.order === 'number' ? row.order : nextOrder++;
          });
      });

    // Version 3 — College tracking: categories, activity logs, day status.
    this.version(3).stores({
      collegeCategories: 'id, systemKey, enabled, order, updatedAt, deleted',
      collegeActivities: 'id, date, categoryId, updatedAt, deleted',
      collegeDayStatuses: 'id, date, status, updatedAt, deleted',
    });

    // Version 4 — Day Profiles (special day system).
    this.version(4).stores({
      dayProfiles: 'id, systemKey, enabled, order, updatedAt, deleted',
      dayAssignments: 'id, date, profileId, updatedAt, deleted',
    });

    // Version 5 — Workout Engine (exercise library + day templates).
    this.version(5).stores({
      exerciseDefs: 'id, name, enabled, order, updatedAt, deleted',
      workoutTemplates: 'id, dayIndex, enabled, order, updatedAt, deleted',
    });

    // Version 6 — recursive spin wheels + history
    this.version(6).stores({
      spinWheels: 'id, parentWheelId, isRoot, enabled, order, updatedAt, deleted',
      spinHistories: 'id, date, wheelId, updatedAt, deleted',
    });

    // Version 7 — entertainment categories + richer watchlist
    this.version(7).stores({
      entertainmentCategories: 'id, systemKey, enabled, order, updatedAt, deleted',
      watchlistItems: 'id, categoryId, watched, status, updatedAt, deleted',
    });

    // Version 8 — offline music playlists + tracks
    this.version(8).stores({
      musicPlaylists: 'id, systemKey, enabled, order, updatedAt, deleted',
      musicTracks: 'id, playlistId, order, updatedAt, deleted',
    });

    // Version 9 — vehicle maintenance + richer vehicle indexes
    this.version(9).stores({
      vehicles: 'id, type, enabled, sold, updatedAt, deleted',
      fuelRecords: 'id, vehicleId, date, updatedAt, deleted',
      distanceRecords: 'id, vehicleId, date, updatedAt, deleted',
      maintenanceRecords: 'id, vehicleId, date, kind, updatedAt, deleted',
    });

    // Version 10 — friends + social records; development category index
    this.version(10).stores({
      developmentRecords: 'id, date, category, updatedAt, deleted',
      developmentPhotos: 'id, kind, date, updatedAt, deleted',
      friends: 'id, enabled, isNaveenAnna, order, updatedAt, deleted',
      socialRecords: 'id, date, friendId, kind, updatedAt, deleted',
    });

    // Version 11 — learning sessions
    this.version(11).stores({
      learningSessions: 'id, date, category, status, updatedAt, deleted',
      bucketListItems: 'id, status, category, order, updatedAt, deleted',
    });

    this.version(12).stores({
      achievementDefs: 'id, key, enabled, order, updatedAt, deleted',
      achievementUnlocks: 'id, achievementKey, unlockedAt, updatedAt, deleted',
    });

    // Version 13 — Day Journey: ordered phases + per-date progress through them.
    this.version(13).stores({
      phases: 'id, order, enabled, updatedAt, deleted',
      dayProgress: 'id, date, currentPhaseId, updatedAt, deleted',
    });
  }
}

/** Singleton instance — import this everywhere instead of constructing a new DB. */
export const db = new LifeManagerDB();

/** All table names, used by the generic repository and by backup/restore. */
export const ENTITY_TABLES = [
  'routines',
  'tasks',
  'completionRecords',
  'workoutSessions',
  'exerciseDefs',
  'workoutTemplates',
  'guitarSessions',
  'sleepRecords',
  'collegeRecords',
  'collegeCategories',
  'collegeActivities',
  'collegeDayStatuses',
  'moneyTransactions',
  'lendingRecords',
  'borrowingRecords',
  'vehicles',
  'fuelRecords',
  'distanceRecords',
  'maintenanceRecords',
  'spinWheels',
  'spinHistories',
  'entertainmentCategories',
  'watchlistItems',
  'musicPlaylists',
  'musicTracks',
  'developmentRecords',
  'developmentPhotos',
  'friends',
  'socialRecords',
  'learningSessions',
  'bucketListItems',
  'milestones',
  'achievementDefs',
  'achievementUnlocks',
  'specialDays',
  'dayProfiles',
  'dayAssignments',
  'appSettings',
  'featureToggles',
  'automationSettings',
  'phases',
  'dayProgress',
] as const;
