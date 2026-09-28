# Special Days (Day Profiles)

Fully app-editable day types. **No source-code change is required to create a new special day.**

## Seeded profiles

| Profile | systemKey | Behaviour (editable) |
|---------|-----------|----------------------|
| Normal College Day | `normal` | Default weekday reference |
| Bunk Day | `bunk` | Auto when College marks bunked; focused modules |
| Exam Day | `exam` | Replace base routines, hide workout/entertainment, checklist, stay-at-college agenda |
| Hackathon Day | `hackathon` | Laptop/charger checklist, late return, dev focus |
| Event Day | `event` | Travel/food plans, social focus |
| Holiday | `holiday` | No college modules, free-day block |
| Stay-Out Day | `stay_out` | Deferred home hygiene, late return |
| Sunday | `sunday` | Auto on Sundays if no assignment; reset checklist |

Custom profiles: create under **Special Days → Day types → + New**.

## What a profile can do

- Replace or filter base routines (`replaceBaseRoutines`, disable by moduleTag / category / title)
- Change times (`timeOverrides`)
- Add ephemeral agenda items (`extraAgendaItems`)
- Disable workout (via `disableModuleTags: ['workout']`)
- Checklists, food plan, travel plan
- Hide / focus Home modules so only relevant pages show
- Activate spin wheels by name (hook ready)

## Resolution order (active profile for a date)

1. Explicit `DayAssignment` for that date  
2. College `bunked` status → Bunk profile  
3. Sunday → Sunday profile  
4. Otherwise normal (no profile)

## Tables

- `dayProfiles` — templates  
- `dayAssignments` — date → profileId + checklistDone  

## UI

- `/special-days` — Active / Assign / Day types editor  
- Home filters modules via `filterModulesForProfile`  
- Today agenda runs through `applyProfileToRoutines` + extras  

## Updated resolution order (Day Brief)

1. Deep Work range  
2. Explicit `DayAssignment`  
3. Coimbatore Stay range  
4. College `bunked` status  
5. Sunday profile only if the "Sunday default" setting is ON (default OFF)

Two new profiles: `deep_work` (Deep Work Day) and `coimbatore_stay` (Coimbatore Stay).
