# Day Brief: day types, wake coach, travel, notifications

## Day types (display names)
| Name | systemKey | Notes |
|------|-----------|-------|
| Campus Day | `normal` | default college day, wake coach + bus + spend prompts |
| Early Exit Day | `bunk` | Campus Day but home early, spin opens |
| Campus Event Day | `event` | travel + spends, no workout/guitar |
| Recharge Day | `rest` | spin wheel until evening |
| Deep Work Day | `deep_work` | coding, date range, overrides everything |
| Coimbatore Stay | `coimbatore_stay` | date range, planned or sudden |

`src/day/dayTypes.ts` owns names, ranges and `assignDayType(date, key, days)`.
`ensureDayTypeProfiles()` runs on app start: renames untouched legacy names and
adds the two new profiles. Names and behaviour stay editable in Special Days.

## Resolution order (`resolveProfileForDate`)
1. Deep Work range
2. Explicit assignment for the date
3. Coimbatore Stay range
4. College status `bunked`
5. Sunday profile, only if "Treat every Sunday as special" is ON (default OFF)

Weekend spin phase does not show on a day you attend college.

## Night picker
`TomorrowOrderCard` offers all six types. Deep Work and Coimbatore Stay ask for
the number of days. Picking a type writes a `DayAssignment` (and range) and
reschedules notifications.

## Wake coach (`src/day/wakeCoach.ts`, `WakeCard.tsx`)
- "I'm awake" logs the real wake time. No forced alarm.
- Campus and Early Exit days: Plan A (wake 05:10, bus 06:15), Plan B (wake 05:45,
  bus 06:50), rush plan, missed after 07:00. All times, steps and messages are
  editable in Settings > Day Brief settings.
- Water and eating reminders start from the wake time on every day type.
- Random good-morning greeting in English letters (`greeting.ts`).

## Travel (`travel.ts`, `TravelCard.tsx`, `music/travelMusic.ts`)
Boarded bus, reached college, boarded bus home, reached home. Fares go to Money
(category `bus`). Music: English + Tamil playlists mixed by ratio, seeded shuffle
per trip, no repeat until the whole library has played. Starts on boarding, stops
on arrival.

## Notifications (`src/notifications/scheduler.ts`)
Uses `@capacitor/local-notifications` on Android (run `npm install` then
`npx cap sync`). Browser fallback only fires while the app is open. Every type has
its own toggle/time; optional wake alarm per day type. Rescheduled on wake, travel
and day-type changes and every 30 minutes.

## Backgrounds
15 built-in generated scenes (`appearance/builtinBackgrounds.ts`), used when no
photos are imported (or forced). Accent and card tint adapt to the background
(`appearance/adaptiveColor.ts`). A custom accent colour always wins.

## Settings
`/day-brief-settings` (linked from Settings > Configure modules).
