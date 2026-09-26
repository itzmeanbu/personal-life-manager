# Home-arrival automation (Android-first)

## Behaviour

1. User configures **Home** location (+ radius).
2. On **enter home** (geofence / foreground poll / manual “I’m home”):
   - Show **Welcome Home**
   - Optionally play **I’m home** sound
   - Wait **post-arrival delay** (default 15 min)
   - If workout still applicable → workout reminder (START / SKIP)
3. **Late-arrival rule** (default cutoff **19:30**):
   - Auto **cancel** today’s workout (status `cancelled`, never `completed`)
   - Manual START still allowed if `allowManualOverrideAfterLateCancel` is on

## Windows (editable)

- Normal arrival: 19:00–19:30  
- Bunk-day arrival: 16:30–18:00  
- Up to **3** workout times (e.g. 19:30, 20:00, 21:00)

## Platform honesty

| Runtime | What works |
|---------|------------|
| **Android Capacitor** | Fine location, foreground poll, optional geofence plugin, background subject to OEM battery limits |
| **Browser / pure WebView** | Foreground location only while app is open — **no** unrestricted background geofencing |

Toggles (all editable): location, geofence, home sound, workout automation, delay, late-arrival rule, manual override.

## Key files

- `src/home/*` — engine, monitor, provider, overlay
- `src/pages/HomeAutomation.tsx` — settings UI
- `WorkoutSession.status` includes `cancelled`
