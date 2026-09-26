import { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { MODULES, HOME_MODULE } from './app/navConfig';
import { LoadingSkeleton } from './components/ui/States';
import { SecurityProvider, useSecurity } from './security/SecurityProvider';
import { LockScreen } from './components/security/LockScreen';
import { ensureDefaultRoutinesSeeded } from './routine/seed';
import { seedCollegeCategoriesIfNeeded } from './college/defaults';
import { seedDayProfilesIfNeeded } from './day/seed';
import { seedWorkoutEngineIfNeeded } from './workout/seed';
import { seedSpinWheelsIfNeeded } from './spin/seed';
import { seedEntertainmentCategoriesIfNeeded } from './entertainment/seed';
import { seedMusicPlaylistsIfNeeded } from './music/seed';
import { seedBucketListIfNeeded } from './bucket/seed';
import { seedAchievementsIfNeeded } from './gamification/seed';
import { seedDefaultPhasesIfNeeded, ensureSpinPhaseExists } from './day/phaseSeed';
import { cleanupDuplicateSeedData } from './data/dedupeSeeds';
import { getAppearanceConfig } from './appearance/settings';
import { HomeArrivalProvider } from './home/HomeArrivalProvider';

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}><LoadingSkeleton lines={4} /></div>}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={HOME_MODULE.path} element={<HOME_MODULE.Component />} />
          {MODULES.map((mod) => (
            <Route key={mod.id} path={mod.path} element={<mod.Component />} />
          ))}
        </Route>
      </Routes>
    </Suspense>
  );
}

function Gate() {
  const { locked } = useSecurity();
  // The lock screen is layered on top; routes stay mounted underneath so
  // navigation state isn't lost across a lock/unlock cycle.
  return (
    <>
      <AppRoutes />
      {locked && <LockScreen />}
    </>
  );
}

function App() {
  // Runs once per install: inserts the default routine set only if the
  // routines table is empty and it has never run before. Fully a no-op
  // (and safe to leave in) once the user has any routines, edited or not.
  useEffect(() => {
    // Runs once, after seeding: removes any rows left doubled-up by the
    // old seeding race condition (fixed via seedGuard). Safe no-op once
    // a device's data is already clean.
    void Promise.all([
      ensureDefaultRoutinesSeeded(),
      seedCollegeCategoriesIfNeeded(),
      seedDayProfilesIfNeeded(),
      seedWorkoutEngineIfNeeded(),
      seedSpinWheelsIfNeeded(),
      seedEntertainmentCategoriesIfNeeded(),
      seedMusicPlaylistsIfNeeded(),
      seedBucketListIfNeeded(),
      seedAchievementsIfNeeded(),
      seedDefaultPhasesIfNeeded().then(() => ensureSpinPhaseExists()),
    ]).then(() => cleanupDuplicateSeedData());
    void getAppearanceConfig().then((c) => {
      if (c.accentColor) document.documentElement.style.setProperty('--color-accent', c.accentColor);
    });
  }, []);

  return (
    <SecurityProvider>
      <HomeArrivalProvider>
        <Gate />
      </HomeArrivalProvider>
    </SecurityProvider>
  );
}

export default App;
