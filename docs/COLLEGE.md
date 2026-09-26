# College module

Offline-first college tracking + bunk-day support.

## Tracking

Configurable categories (seeded once, fully editable):

- Attended college
- Bunked college
- Skill development
- Coding
- Games
- Instagram / social
- Canteen
- Talking with people
- + any custom categories the user adds

Actions:

- **Add / rename / disable / delete** category
- **Log activity** (increments count for that category on the chosen day)
- **Day status**: Attended | Bunked | none
- **Stats**: daily / monthly / yearly totals from real logs only  
  (no invented historical records)

Data tables (Dexie v3):

- `collegeCategories`
- `collegeActivities`
- `collegeDayStatuses`

Legacy `collegeRecords` (assignments / exams) remains for future academic use.

## Bunk day

Normal weekday template (routine seed) is untouched:

college → bus → home around **7:00–7:30 PM** (`college.normalHomeArrival`, default `19:15`).

When the user sets **Bunked today = YES**:

1. They pick an early home arrival from the configurable list  
   (defaults: `16:30`, `17:00`, `17:30`, `18:00`).
2. The College page surfaces afternoon / evening activity categories.
3. The **Today** screen shows a bunk-day banner linking back to College.
4. Seeded college commute / college block routines stay in the engine;  
   they are not deleted or rewritten.

Settings keys:

- `college.bunkArrivalTimes` — string[] of `HH:mm`
- `college.normalHomeArrival` — single `HH:mm`

## Files

- `src/pages/College.tsx` — UI
- `src/college/defaults.ts` — seed + settings helpers
- `src/college/stats.ts` — period totals
- `src/college/college.css` — styles
