import { lazy } from 'react';
import type { ComponentType } from 'react';

export interface ModuleDef {
  id: string;
  label: string;
  path: string;
  monogram: string;
  /** Visual emoji for tiles / hierarchy */
  emoji: string;
  colorVar: string;
  /** Day indices (0=Sun..6=Sat) this module's tile should visually emphasize on. */
  emphasizeOnDays?: number[];
  Component: ComponentType;
}

const Home = lazy(() => import('../pages/Home'));
const Today = lazy(() => import('../pages/Today'));
const RoutineManager = lazy(() => import('../pages/RoutineManager'));
const College = lazy(() => import('../pages/College'));
const Workout = lazy(() => import('../pages/Workout'));
const Guitar = lazy(() => import('../pages/Guitar'));
const Sleep = lazy(() => import('../pages/Sleep'));
const Weekend = lazy(() => import('../pages/Weekend'));
const Money = lazy(() => import('../pages/Money'));
const Bike = lazy(() => import('../pages/Bike'));
const ProgressPage = lazy(() => import('../pages/Progress'));
const Social = lazy(() => import('../pages/Social'));
const Entertainment = lazy(() => import('../pages/Entertainment'));
const Spin = lazy(() => import('../pages/Spin'));
const Music = lazy(() => import('../pages/Music'));
const Learning = lazy(() => import('../pages/Learning'));
const Development = lazy(() => import('../pages/Development'));
const BucketList = lazy(() => import('../pages/BucketList'));
const Settings = lazy(() => import('../pages/Settings'));
const WeeklySchedule = lazy(() => import('../pages/settings/WeeklySchedule'));
const QuickDay = lazy(() => import('../pages/settings/QuickDay'));
const LifestyleWizard = lazy(() => import('../pages/settings/LifestyleWizard'));
const Appearance = lazy(() => import('../pages/Appearance'));
const HomeAutomation = lazy(() => import('../pages/HomeAutomation'));
const SpecialDays = lazy(() => import('../pages/SpecialDays'));

/**
 * Single source of truth for navigation: the Home grid, the Module Drawer,
 * and the router all read from this array, so adding a module is one entry
 * here instead of three separate places to keep in sync.
 */
export const MODULES: ModuleDef[] = [
  { id: 'today', label: 'Day Brief', path: '/today', emoji: '📅', monogram: 'TD', colorVar: '--mod-today', Component: Today },
  { id: 'routines', label: 'Routines', path: '/routines', emoji: '📋', monogram: 'RT', colorVar: '--mod-routines', Component: RoutineManager },
  { id: 'college', label: 'College', path: '/college', emoji: '🎓', monogram: 'CG', colorVar: '--mod-college', emphasizeOnDays: [1, 2, 3, 4, 5], Component: College },
  { id: 'workout', label: 'Workout', path: '/workout', emoji: '🏋️', monogram: 'WK', colorVar: '--mod-workout', Component: Workout },
  { id: 'guitar', label: 'Guitar', path: '/guitar', emoji: '🎸', monogram: 'GT', colorVar: '--mod-guitar', Component: Guitar },
  { id: 'sleep', label: 'Sleep', path: '/sleep', emoji: '😴', monogram: 'SL', colorVar: '--mod-progress', Component: Sleep },
  { id: 'weekend', label: 'Weekend', path: '/weekend', emoji: '🌴', monogram: 'WE', colorVar: '--mod-weekend', emphasizeOnDays: [0, 6], Component: Weekend },
  { id: 'money', label: 'Money', path: '/money', emoji: '💰', monogram: 'MN', colorVar: '--mod-money', Component: Money },
  { id: 'bike', label: 'Bike', path: '/bike', emoji: '🏍️', monogram: 'BK', colorVar: '--mod-bike', Component: Bike },
  { id: 'progress', label: 'Progress', path: '/progress', emoji: '📊', monogram: 'PR', colorVar: '--mod-progress', Component: ProgressPage },
  { id: 'social', label: 'Social', path: '/social', emoji: '🗣️', monogram: 'SC', colorVar: '--mod-social', Component: Social },
  { id: 'entertainment', label: 'Entertainment', path: '/entertainment', emoji: '🎬', monogram: 'EN', colorVar: '--mod-entertainment', Component: Entertainment },
  { id: 'spin', label: 'Spin Wheel', path: '/spin', emoji: '🎡', monogram: 'SW', colorVar: '--mod-entertainment', emphasizeOnDays: [0, 6], Component: Spin },
  { id: 'music', label: 'Music', path: '/music', emoji: '🎵', monogram: 'MU', colorVar: '--mod-entertainment', Component: Music },
  { id: 'learning', label: 'Learning', path: '/learning', emoji: '💻', monogram: 'LR', colorVar: '--mod-learning', Component: Learning },
  { id: 'development', label: 'Development', path: '/development', emoji: '📸', monogram: 'DV', colorVar: '--mod-development', Component: Development },
  { id: 'bucket-list', label: 'Bucket List', path: '/bucket-list', emoji: '🌎', monogram: 'BL', colorVar: '--mod-bucketlist', Component: BucketList },
  { id: 'special-days', label: 'Special Days', path: '/special-days', emoji: '⭐', monogram: 'SD', colorVar: '--mod-weekend', Component: SpecialDays },
  { id: 'home-arrival', label: 'Home arrival', path: '/home-arrival', emoji: '📍', monogram: 'HA', colorVar: '--mod-home', Component: HomeAutomation },
  { id: 'appearance', label: 'Appearance', path: '/appearance', emoji: '🎨', monogram: 'AP', colorVar: '--mod-settings', Component: Appearance },
  { id: 'weekly-schedule', label: 'Weekly Schedule', path: '/weekly-schedule', emoji: '📅', monogram: 'WS', colorVar: '--mod-settings', Component: WeeklySchedule },
  { id: 'quick-day', label: 'Quick day setup', path: '/quick-day', emoji: '⏰', monogram: 'QD', colorVar: '--mod-settings', Component: QuickDay },
  { id: 'easy-setup', label: 'Easy setup', path: '/easy-setup', emoji: '✨', monogram: 'ES', colorVar: '--mod-settings', Component: LifestyleWizard },
  { id: 'settings', label: 'Settings', path: '/settings', emoji: '⚙️', monogram: '⚙', colorVar: '--mod-settings', Component: Settings },
];

export const HOME_MODULE: ModuleDef = {
  emoji: '🏠',
  id: 'home',
  label: 'Home',
  path: '/',
  monogram: 'HM',
  colorVar: '--mod-home',
  Component: Home,
};
