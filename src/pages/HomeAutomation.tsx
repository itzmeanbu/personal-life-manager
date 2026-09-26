import { useState } from 'react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useHomeArrival } from '../home/HomeArrivalProvider';
import '../home/home.css';

function Toggle({
  on,
  onToggle,
  label,
  hint,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="ha-toggle-row">
      <div>
        <div className="ha-toggle-row__label">{label}</div>
        {hint && <div className="ha-toggle-row__hint">{hint}</div>}
      </div>
      <button
        type="button"
        className={`ha-switch ${on ? 'ha-switch--on' : ''}`}
        aria-pressed={on}
        onClick={onToggle}
      />
    </div>
  );
}

export default function HomeAutomation() {
  const {
    config,
    capability,
    saveConfig,
    imHome,
    setHomeFromCurrentLocation,
    insideHome,
    monitorNote,
    loading,
  } = useHomeArrival();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [timeInputs, setTimeInputs] = useState<string[]>(() => {
    const t = [...config.workoutTimes];
    while (t.length < 3) t.push('');
    return t.slice(0, 3);
  });

  const saveTimes = async () => {
    const cleaned = timeInputs
      .map((t) => t.trim())
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
      .map((t) => {
        const [h, m] = t.split(':').map(Number);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      })
      .slice(0, 3);
    await saveConfig({ workoutTimes: cleaned });
    setMsg('Workout times saved');
  };

  const pinHome = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await setHomeFromCurrentLocation('Home');
      setMsg('Home location saved from current position');
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Home arrival">
        <p className="ha-note">Loading…</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Home arrival">
      <Card>
        <p className={capability.canBackgroundGeofence ? 'ha-note' : 'ha-note ha-note--warn'}>
          {capability.note}
        </p>
        {monitorNote && (
          <p className="ha-note" style={{ marginTop: 8 }}>
            Monitor: {monitorNote}
          </p>
        )}
        <p className="ha-note" style={{ marginTop: 8 }}>
          Inside home: {insideHome === null ? 'unknown' : insideHome ? 'yes' : 'no'}
        </p>
      </Card>

      <SectionHeader title="Toggles" />
      <Card style={{ padding: '4px 16px' }}>
        <Toggle
          label="Location"
          hint="Master switch for home detection"
          on={config.locationEnabled}
          onToggle={() => saveConfig({ locationEnabled: !config.locationEnabled })}
        />
        <Toggle
          label="Geofence"
          hint="Android native geofence when supported"
          on={config.geofenceEnabled}
          onToggle={() => saveConfig({ geofenceEnabled: !config.geofenceEnabled })}
        />
        <Toggle
          label="Home sound"
          hint={`Play “I'm home” tone (${config.homeSoundId})`}
          on={config.homeSoundEnabled}
          onToggle={() => saveConfig({ homeSoundEnabled: !config.homeSoundEnabled })}
        />
        <Toggle
          label="Workout automation"
          hint="Post-arrival reminder + late-arrival rules"
          on={config.workoutAutomationEnabled}
          onToggle={() =>
            saveConfig({ workoutAutomationEnabled: !config.workoutAutomationEnabled })
          }
        />
        <Toggle
          label="Post-arrival delay"
          hint={`${config.postArrivalDelayMinutes} min before workout prompt`}
          on={config.postArrivalDelayMinutes > 0}
          onToggle={() =>
            saveConfig({
              postArrivalDelayMinutes: config.postArrivalDelayMinutes > 0 ? 0 : 15,
            })
          }
        />
        <Toggle
          label="Late-arrival rule"
          hint={`After ${config.lateArrivalCutoff} → cancel workout (not completed)`}
          on={config.lateArrivalRuleEnabled}
          onToggle={() =>
            saveConfig({ lateArrivalRuleEnabled: !config.lateArrivalRuleEnabled })
          }
        />
        <Toggle
          label="Manual override after late cancel"
          hint="Allow START from Workout even if auto-cancelled"
          on={config.allowManualOverrideAfterLateCancel}
          onToggle={() =>
            saveConfig({
              allowManualOverrideAfterLateCancel: !config.allowManualOverrideAfterLateCancel,
            })
          }
        />
      </Card>

      <SectionHeader title="Home location" />
      <Card>
        {config.home ? (
          <p className="ha-note">
            {config.home.label}: {config.home.latitude.toFixed(5)},{' '}
            {config.home.longitude.toFixed(5)} · radius {config.home.radiusMeters}m
          </p>
        ) : (
          <p className="ha-note ha-note--warn">Not set — pin current location on device.</p>
        )}
        <div className="ha-field">
          <label>Radius (meters)</label>
          <input
            className="ha-input"
            type="number"
            min={30}
            max={500}
            value={config.home?.radiusMeters ?? 120}
            onChange={(e) => {
              const radiusMeters = Number(e.target.value);
              if (config.home) {
                void saveConfig({ home: { ...config.home, radiusMeters } });
              }
            }}
          />
        </div>
        <Button variant="secondary" disabled={busy} onClick={pinHome}>
          Use current location as Home
        </Button>
      </Card>

      <SectionHeader title="Arrival windows" />
      <Card>
        <div className="ha-field">
          <label>Normal arrival start (HH:mm)</label>
          <input
            className="ha-input"
            value={config.normalArrivalWindow.start}
            onChange={(e) =>
              saveConfig({
                normalArrivalWindow: {
                  ...config.normalArrivalWindow,
                  start: e.target.value,
                },
              })
            }
          />
        </div>
        <div className="ha-field">
          <label>Normal arrival end (HH:mm)</label>
          <input
            className="ha-input"
            value={config.normalArrivalWindow.end}
            onChange={(e) =>
              saveConfig({
                normalArrivalWindow: {
                  ...config.normalArrivalWindow,
                  end: e.target.value,
                },
              })
            }
          />
        </div>
        <div className="ha-field">
          <label>Bunk-day arrival start</label>
          <input
            className="ha-input"
            value={config.bunkArrivalWindow.start}
            onChange={(e) =>
              saveConfig({
                bunkArrivalWindow: { ...config.bunkArrivalWindow, start: e.target.value },
              })
            }
          />
        </div>
        <div className="ha-field">
          <label>Bunk-day arrival end</label>
          <input
            className="ha-input"
            value={config.bunkArrivalWindow.end}
            onChange={(e) =>
              saveConfig({
                bunkArrivalWindow: { ...config.bunkArrivalWindow, end: e.target.value },
              })
            }
          />
        </div>
        <div className="ha-field">
          <label>Late-arrival cutoff (auto-cancel after)</label>
          <input
            className="ha-input"
            value={config.lateArrivalCutoff}
            onChange={(e) => saveConfig({ lateArrivalCutoff: e.target.value })}
          />
        </div>
        <div className="ha-field">
          <label>Post-arrival delay (minutes)</label>
          <input
            className="ha-input"
            type="number"
            min={0}
            max={120}
            value={config.postArrivalDelayMinutes}
            onChange={(e) =>
              saveConfig({ postArrivalDelayMinutes: Number(e.target.value) })
            }
          />
        </div>
      </Card>

      <SectionHeader title="Workout times (up to 3)" />
      <Card>
        {[0, 1, 2].map((i) => (
          <div className="ha-field" key={i}>
            <label>Slot {i + 1}</label>
            <input
              className="ha-input"
              placeholder="HH:mm"
              value={timeInputs[i] ?? ''}
              onChange={(e) => {
                const next = [...timeInputs];
                next[i] = e.target.value;
                setTimeInputs(next);
              }}
            />
          </div>
        ))}
        <Button variant="secondary" onClick={saveTimes}>
          Save times
        </Button>
      </Card>

      <SectionHeader title="Actions" />
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="primary"
            onClick={async () => {
              await imHome();
              setMsg('Manual “I’m home” fired');
            }}
          >
            I&apos;m home (manual)
          </Button>
        </div>
        <p className="ha-note" style={{ marginTop: 10 }}>
          START / SKIP / CANCEL / MANUAL START for the workout itself live on the Workout
          page. This screen only configures arrival automation.
        </p>
        {msg && (
          <p className="ha-note" style={{ marginTop: 8 }}>
            {msg}
          </p>
        )}
      </Card>
    </PageShell>
  );
}
