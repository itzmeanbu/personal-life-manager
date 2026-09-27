# Special Days (Day Profiles)

Fully app-editable day types. **No source-code change is required to create a new special day.**

## Seeded profiles

| Profile | systemKey | Behaviour (editable) |
|---------|-----------|----------------------|
| Normal College Day | `normal` | Default weekday reference |
| Exam Day | `exam` | Replace base routines, hide workout/entertainment, checklist |
| Hackathon Day | `hackathon` | Laptop/charger checklist, late return, dev focus |
| Event Day | `event` | Travel/food plans, social focus |
| Holiday | `holiday` | No college modules, free-day block |
| Stay-Out Day | `stay_out` | Deferred home hygiene, late return |
| Sunday | `sunday` | Auto on Sundays if no assignment; reset checklist |
| Family / Relatives Function | `family_function` | Planned family event — travel buffer, adapt conflicts |

**Bunk is NOT a Day Type.** Bunk / left-early is a **College attendance status** only.

Legacy `systemKey: 'bunk'` profiles are disabled automatically and marked `(legacy)`.

## Resolution order

1. Explicit `DayAssignment` for that date  
2. Sunday → Sunday profile  
3. Otherwise normal (no profile)

College bunk / left-early does **not** select a Day Profile.

## Tables

- `dayProfiles` — templates  
- `dayAssignments` — date → profileId + checklistDone  
