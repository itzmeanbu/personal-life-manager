/**
 * Pure functions that apply a DayProfile's effects to routines / modules.
 * No side effects — the UI and agenda hooks call these.
 */

import type { DayProfile, DayProfileEffects, Routine } from '../data/types';
import type { ModuleDef } from '../app/navConfig';

export function emptyEffects(): DayProfileEffects {
  return {
    replaceBaseRoutines: false,
    disableModuleTags: [],
    disableCategories: [],
    disableRoutineTitles: [],
    timeOverrides: [],
    extraAgendaItems: [],
    hideModules: [],
    focusModules: [],
    checklist: [],
    activateSpinWheelNames: [],
  };
}

/** Whether a base routine should survive under the given profile effects. */
export function routineAllowedByProfile(routine: Routine, effects: DayProfileEffects): boolean {
  if (!routine.enabled || routine.archived) return false;

  if (effects.disableModuleTags.length && routine.moduleTag) {
    if (effects.disableModuleTags.includes(routine.moduleTag)) return false;
  }
  if (effects.disableCategories.length) {
    if (effects.disableCategories.includes(routine.category)) return false;
  }
  if (effects.disableRoutineTitles.length) {
    if (effects.disableRoutineTitles.includes(routine.title)) return false;
  }
  return true;
}

/**
 * Apply time overrides and filtering. When replaceBaseRoutines is true,
 * only routines that pass the filters remain (usually none unless keep rules
 * are loose). Extra agenda items are separate synthetic routines.
 */
export function applyProfileToRoutines(
  routines: Routine[],
  effects: DayProfileEffects
): Routine[] {
  const base = effects.replaceBaseRoutines
    ? routines.filter((r) => routineAllowedByProfile(r, effects))
    : routines.filter((r) => routineAllowedByProfile(r, effects));

  return base.map((r) => {
    const override = effects.timeOverrides.find((o) => {
      if (o.matchTitle && o.matchTitle !== r.title) return false;
      if (o.matchCategory && o.matchCategory !== r.category) return false;
      if (o.matchModuleTag && o.matchModuleTag !== r.moduleTag) return false;
      // at least one matcher must be set
      return Boolean(o.matchTitle || o.matchCategory || o.matchModuleTag);
    });
    if (!override) return r;
    return { ...r, time: override.newTime };
  });
}

/** Build ephemeral Routine-shaped objects from extraAgendaItems for the agenda. */
export function extraItemsAsRoutines(
  effects: DayProfileEffects,
  dateIso: string
): Routine[] {
  return effects.extraAgendaItems.map((item, idx) => ({
    id: `day-extra-${item.id}`,
    createdAt: dateIso,
    updatedAt: dateIso,
    deleted: false,
    syncedAt: null,
    title: item.title,
    notes: item.notes,
    category: item.category,
    kind: 'one-time' as const,
    cadence: 'custom' as const,
    activeDays: [],
    date: dateIso,
    time: item.time,
    durationMinutes: item.durationMinutes,
    order: 10_000 + idx,
    enabled: true,
    archived: false,
    reminder: { enabled: false, offsetMinutes: 0 },
    moduleTag: item.moduleTag,
  }));
}

/** Modules always visible regardless of focus/hide (safety net). */
const ALWAYS_VISIBLE = new Set(['today', 'settings', 'routines']);

/**
 * Filter the Home / drawer module list for the active profile.
 * - hideModules removes listed ids
 * - focusModules (if non-empty) keeps only those + ALWAYS_VISIBLE
 */
export function filterModulesForProfile(
  modules: ModuleDef[],
  profile: DayProfile | null | undefined
): ModuleDef[] {
  if (!profile) return modules;
  const { hideModules, focusModules } = profile.effects;
  let list = modules.filter((m) => !hideModules.includes(m.id));
  if (focusModules.length > 0) {
    const allowed = new Set([...focusModules, ...ALWAYS_VISIBLE]);
    list = list.filter((m) => allowed.has(m.id));
  }
  return list;
}
