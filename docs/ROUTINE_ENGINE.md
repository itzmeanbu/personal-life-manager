# ROUTINE_ENGINE.md — Daily Routine Engine

## 1. Goal

Everything about "what a normal day looks like" must be data the user
controls from inside the app — never a hard-coded schedule in source code.
Adding a routine, changing a wake-up time, retiming guitar practice,
disabling skincare for a week, or reordering the morning — all of it is a
database write triggered from the UI. No code change is ever required.

## 2. Where it lives

```
src/data/types.ts     Routine + CompletionRecord shapes (the schema)
src/data/db.ts         Dexie table + v2 migration
src/routine/engine.ts  Pure scheduling/status logic — no React, no I/O
src/routine/seed.ts    One-time default seed (just data, fully editable)
src/routine/hooks.ts   Live Dexie queries + CRUD/reorder mutations
src/pages/Today.tsx          Renders today's agenda from the engine
src/pages/RoutineManager.tsx Add/edit/delete/reorder/enable every routine
src/components/routine/      Form, status badge, styles
```

## 3. The `Routine` entity

```ts
interface Routine extends BaseEntity {
  title: string;
  notes?: string;
  category: string;                 // free text, not a fixed enum
  kind: 'recurring' | 'one-time';
  cadence: 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';
  activeDays: number[];              // 0=Sun..6=Sat, for weekly/custom
  date?: string;                     // ISO date, for one-time routines
  time?: string;                     // "HH:mm", optional
  durationMinutes?: number;
  order: number;                     // manual sort weight
  enabled: boolean;                  // temporarily on/off, without deleting
  archived: boolean;                 // reserved for a future "archive" action
  reminder: { enabled: boolean; offsetMinutes: number };
  moduleTag?: string;                // optional link to an existing module
}
```

`category` is intentionally a free-text string, not an enum: the Routine
Manager derives its category filter chips and the form's autocomplete list
from whatever categories already exist on other routines
(`distinctCategories()` in `engine.ts`). Typing a brand-new category just
works — there is no list to edit in code first.

## 4. Scheduling logic (`engine.ts`)

- `isRoutineScheduledOnDate(routine, date)` — the single source of truth for
  "is this routine due today". One-time routines match `date` exactly;
  recurring routines check `cadence` (`daily`/`weekdays`/`weekends`) or
  `activeDays` (`weekly`/`custom`). Disabled or archived routines are never
  scheduled.
- `sortRoutines()` — orders by the explicit `order` field first (what the
  reorder buttons change), then by `time`, then alphabetically as a final
  tiebreak. Untimed routines sort after timed ones.
- `deriveStatus()` — a routine's status for a day comes from its
  `CompletionRecord` if one exists (`done`/`skipped`/`partial`); otherwise
  it's inferred as `missed` (has a `time` that has already passed) or
  `upcoming`. This is how "missed" appears without ever writing a row for
  it — it's a computed view, not stored state, until the user acts on it.
- `dueReminders()` — routines with `reminder.enabled` whose `offsetMinutes`
  window has arrived and that are still `upcoming`. Surfaced today as an
  in-app banner (`Today.tsx`); there is no OS-level push notification
  integration yet (see Limitations).

## 5. Completion tracking

Marking a routine done/skipped/partial writes (or updates) a
`CompletionRecord` keyed by `(date, refType: 'routine', refId)`. "Undo"
hard-deletes that record, returning the routine to its computed
`missed`/`upcoming` state. Nothing about completion history lives on the
`Routine` row itself, so editing a routine's schedule later never rewrites
past completion data.

## 6. Seeding (`seed.ts`)

On first run, if the `routines` table is empty, the app inserts a default
set of routines modelled on a normal college day (wake-up through sleep,
including the night-only hair-tablet reminder, kept separate from the
morning hair-serum step). This is ordinary seed data — the same shape any
user-added routine has — gated by a `routineEngineSeeded` feature flag so
it never re-inserts anything the user has since deleted. Deleting every
seeded routine leaves a fully functional, empty engine; nothing in the app
special-cases these rows by name or id.

## 7. UI

- **Today** (`/today`) — today's agenda in schedule order, with Mark
  done / Skip / Undo per item, a category + duration line, notes if
  present, and a due-reminders banner.
- **Routines** (`/routines`) — the full manager: add, edit (title,
  category, kind, cadence/date, active days, time, duration, notes,
  reminder, enabled), delete (soft-delete, with a tap-to-confirm step),
  and reorder via ↑/↓ buttons that swap `order` values. Category filter
  chips are generated from live data, not a fixed list.

## 8. Limitations / future work

- **Reminders are in-app only.** `reminder.enabled` / `offsetMinutes` are
  modeled and surfaced as a banner while the app is open, but there is no
  OS-level scheduled notification yet (no `@capacitor/local-notifications`
  or similar wired in). Adding one is additive — the data model already
  has everything a notification scheduler would need per routine.
- **Reorder is button-based, not drag-and-drop.** Deliberate choice to
  avoid adding a drag library for v1; the `order` field and `move()` helper
  in `routine/hooks.ts` are what a future drag UI would call into.
- **`moduleTag`** links a routine to an existing module (e.g. `workout`,
  `guitar`) for a future "open the matching module from here" affordance;
  it isn't yet exposed as an editable field in the form.
