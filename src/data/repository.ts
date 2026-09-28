import { db, ENTITY_TABLES } from './db';
import type { BaseEntity, EntityName } from './types';

/** Generates a client-side UUID; works fully offline (no server round-trip). */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older WebViews without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Generic offline-first repository for a single entity table.
 * Every write happens against IndexedDB only — there is no network call
 * anywhere in this file, which is what makes the app fully usable with
 * Wi-Fi, mobile data and Render all unavailable.
 */
export class Repository<T extends BaseEntity> {
  constructor(private tableName: EntityName) {}

  private get table() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (db as any)[this.tableName] as import('dexie').Table<T, string>;
  }

  async create(data: Omit<T, keyof BaseEntity>): Promise<T> {
    const record = {
      ...data,
      id: generateId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deleted: false,
      syncedAt: null,
    } as unknown as T;
    await this.table.add(record);
    return record;
  }

  async update(id: string, patch: Partial<Omit<T, keyof BaseEntity>>): Promise<T | undefined> {
    const existing = await this.table.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, updatedAt: nowIso() } as T;
    await this.table.put(updated);
    return updated;
  }

  /** Soft delete (default) — keeps history for backup/undo/future sync. */
  async remove(id: string, hard = false): Promise<void> {
    if (hard) {
      await this.table.delete(id);
      return;
    }
    const existing = await this.table.get(id);
    if (!existing) return;
    await this.table.put({ ...existing, deleted: true, updatedAt: nowIso() });
  }

  async get(id: string): Promise<T | undefined> {
    return this.table.get(id);
  }

  /** All non-deleted rows, newest updated first. */
  async list(includeDeleted = false): Promise<T[]> {
    const rows = await this.table.toArray();
    const filtered = includeDeleted ? rows : rows.filter((r) => !r.deleted);
    return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async count(): Promise<number> {
    return this.table.filter((r) => !r.deleted).count();
  }
}

// ------------------------------------------------------------------------
// Typed repository instances — one per entity. Import the one you need,
// e.g. `import { tasksRepo } from '../data/repository'`.
// ------------------------------------------------------------------------
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
  Phase,
  DayProgress,
} from './types';

export const routinesRepo = new Repository<Routine>('routines');
export const tasksRepo = new Repository<Task>('tasks');
export const completionRecordsRepo = new Repository<CompletionRecord>('completionRecords');
export const workoutSessionsRepo = new Repository<WorkoutSession>('workoutSessions');
export const exerciseDefsRepo = new Repository<ExerciseDef>('exerciseDefs');
export const workoutTemplatesRepo = new Repository<WorkoutTemplate>('workoutTemplates');
export const guitarSessionsRepo = new Repository<GuitarSession>('guitarSessions');
export const sleepRecordsRepo = new Repository<SleepRecord>('sleepRecords');
export const collegeRecordsRepo = new Repository<CollegeRecord>('collegeRecords');
export const collegeCategoriesRepo = new Repository<CollegeCategory>('collegeCategories');
export const collegeActivitiesRepo = new Repository<CollegeActivity>('collegeActivities');
export const collegeDayStatusesRepo = new Repository<CollegeDayStatus>('collegeDayStatuses');
export const moneyTransactionsRepo = new Repository<MoneyTransaction>('moneyTransactions');
export const lendingRecordsRepo = new Repository<LendingRecord>('lendingRecords');
export const borrowingRecordsRepo = new Repository<BorrowingRecord>('borrowingRecords');
export const vehiclesRepo = new Repository<Vehicle>('vehicles');
export const fuelRecordsRepo = new Repository<FuelRecord>('fuelRecords');
export const distanceRecordsRepo = new Repository<DistanceRecord>('distanceRecords');
export const maintenanceRecordsRepo = new Repository<MaintenanceRecord>('maintenanceRecords');
export const spinWheelsRepo = new Repository<SpinWheel>('spinWheels');
export const spinHistoriesRepo = new Repository<SpinHistory>('spinHistories');
export const entertainmentCategoriesRepo = new Repository<EntertainmentCategory>('entertainmentCategories');
export const watchlistItemsRepo = new Repository<WatchlistItem>('watchlistItems');
export const musicPlaylistsRepo = new Repository<MusicPlaylist>('musicPlaylists');
export const musicTracksRepo = new Repository<MusicTrack>('musicTracks');
export const developmentRecordsRepo = new Repository<DevelopmentRecord>('developmentRecords');
export const developmentPhotosRepo = new Repository<DevelopmentPhoto>('developmentPhotos');
export const friendsRepo = new Repository<Friend>('friends');
export const socialRecordsRepo = new Repository<SocialRecord>('socialRecords');
export const learningSessionsRepo = new Repository<LearningSession>('learningSessions');
export const bucketListItemsRepo = new Repository<BucketListItem>('bucketListItems');
export const milestonesRepo = new Repository<Milestone>('milestones');
export const achievementDefsRepo = new Repository<AchievementDef>('achievementDefs');
export const achievementUnlocksRepo = new Repository<AchievementUnlock>('achievementUnlocks');
export const specialDaysRepo = new Repository<SpecialDay>('specialDays');
export const dayProfilesRepo = new Repository<DayProfile>('dayProfiles');
export const dayAssignmentsRepo = new Repository<DayAssignment>('dayAssignments');
export const appSettingsRepo = new Repository<AppSetting>('appSettings');
export const phasesRepo = new Repository<Phase>('phases');
export const dayProgressRepo = new Repository<DayProgress>('dayProgress');
export const featureTogglesRepo = new Repository<FeatureToggle>('featureToggles');
export const automationSettingsRepo = new Repository<AutomationSetting>('automationSettings');

export { ENTITY_TABLES };
