import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HomeArrivalConfig, ArrivalEvent } from './types';
import { DEFAULT_HOME_CONFIG } from './types';
import { getHomeConfig, setHomeConfig } from './settings';
import {
  startHomeMonitor,
  stopHomeMonitor,
  setArrivalListener,
  triggerManualArrival,
  getMonitorInsideHome,
} from './monitor';
import { probeLocationCapability, type LocationCapability } from './platform';
import { isWorkoutStillApplicable } from './arrival';
import { getCurrentPosition } from './location';

interface HomeArrivalContextValue {
  config: HomeArrivalConfig;
  capability: LocationCapability;
  loading: boolean;
  welcomeVisible: boolean;
  dismissWelcome: () => void;
  workoutPromptVisible: boolean;
  dismissWorkoutPrompt: () => void;
  lastEvent: ArrivalEvent | null;
  lateCancelMessage: string | null;
  insideHome: boolean | null;
  monitorNote: string;
  refreshConfig: () => Promise<void>;
  saveConfig: (patch: Partial<HomeArrivalConfig>) => Promise<void>;
  imHome: () => Promise<void>;
  setHomeFromCurrentLocation: (label?: string) => Promise<void>;
  workoutStillApplicable: boolean;
}

const HomeArrivalContext = createContext<HomeArrivalContextValue | null>(null);

export function HomeArrivalProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HomeArrivalConfig>(DEFAULT_HOME_CONFIG);
  const [loading, setLoading] = useState(true);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [workoutPromptVisible, setWorkoutPromptVisible] = useState(false);
  const [workoutPromptAt, setWorkoutPromptAt] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<ArrivalEvent | null>(null);
  const [lateCancelMessage, setLateCancelMessage] = useState<string | null>(null);
  const [insideHome, setInsideHome] = useState<boolean | null>(null);
  const [monitorNote, setMonitorNote] = useState('');
  const [workoutStillApplicable, setWorkoutStillApplicable] = useState(false);
  const capability = useMemo(() => probeLocationCapability(), []);

  const refreshConfig = useCallback(async () => {
    const c = await getHomeConfig();
    setConfig(c);
  }, []);

  const restartMonitor = useCallback(async (c: HomeArrivalConfig) => {
    const result = await startHomeMonitor(c);
    setMonitorNote(result.note);
    setInsideHome(getMonitorInsideHome());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getHomeConfig();
      if (cancelled) return;
      setConfig(c);
      setLoading(false);
      await restartMonitor(c);
    })();
    return () => {
      cancelled = true;
      void stopHomeMonitor();
    };
  }, [restartMonitor]);

  useEffect(() => {
    setArrivalListener((event, meta) => {
      setLastEvent(event);
      setInsideHome(event.kind === 'enter_home' ? true : false);
      if (event.kind === 'enter_home' && meta.welcome) {
        setWelcomeVisible(true);
      }
      if (meta.lateCancelApplied) {
        setLateCancelMessage(meta.lateCancelReason);
        setWorkoutPromptAt(null);
        setWorkoutPromptVisible(false);
      } else if (meta.workoutPromptAt) {
        setWorkoutPromptAt(meta.workoutPromptAt);
      }
    });
    return () => setArrivalListener(null);
  }, []);

  // Fire workout prompt after delay
  useEffect(() => {
    if (!workoutPromptAt) return;
    const target = new Date(workoutPromptAt).getTime();
    const delay = Math.max(0, target - Date.now());
    const t = setTimeout(() => {
      void (async () => {
        const applicable = await isWorkoutStillApplicable(config);
        setWorkoutStillApplicable(applicable);
        if (applicable) setWorkoutPromptVisible(true);
      })();
    }, delay);
    return () => clearTimeout(t);
  }, [workoutPromptAt, config]);

  const saveConfig = useCallback(
    async (patch: Partial<HomeArrivalConfig>) => {
      const next = await setHomeConfig(patch);
      setConfig(next);
      await restartMonitor(next);
    },
    [restartMonitor]
  );

  const imHome = useCallback(async () => {
    await triggerManualArrival(config);
  }, [config]);

  const setHomeFromCurrentLocation = useCallback(
    async (label = 'Home') => {
      const pos = await getCurrentPosition();
      await saveConfig({
        home: {
          label,
          latitude: pos.latitude,
          longitude: pos.longitude,
          radiusMeters: config.home?.radiusMeters ?? 120,
        },
        locationEnabled: true,
      });
    },
    [config.home?.radiusMeters, saveConfig]
  );

  const value: HomeArrivalContextValue = {
    config,
    capability,
    loading,
    welcomeVisible,
    dismissWelcome: () => setWelcomeVisible(false),
    workoutPromptVisible,
    dismissWorkoutPrompt: () => setWorkoutPromptVisible(false),
    lastEvent,
    lateCancelMessage,
    insideHome,
    monitorNote,
    refreshConfig,
    saveConfig,
    imHome,
    setHomeFromCurrentLocation,
    workoutStillApplicable,
  };

  return (
    <HomeArrivalContext.Provider value={value}>{children}</HomeArrivalContext.Provider>
  );
}

export function useHomeArrival(): HomeArrivalContextValue {
  const ctx = useContext(HomeArrivalContext);
  if (!ctx) {
    throw new Error('useHomeArrival must be used within HomeArrivalProvider');
  }
  return ctx;
}
