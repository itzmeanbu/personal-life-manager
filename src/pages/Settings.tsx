import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SecuritySettingsCard } from '../components/security/SecuritySettingsCard';
import {
  exportBackupToFile,
  exportBackupToFileOptions,
  readBackupFile,
  readBackupFileWithPassphrase,
  restoreBackup,
} from '../data/backup';
import {
  getAllFeatureToggles,
  setFeatureEnabled,
} from '../data/settings';
import './settings-control.css';

/** Module control links — private config hub, not an admin CMS. */
const MODULE_LINKS: { label: string; path: string; hint: string }[] = [
  { label: 'Quick day setup', path: '/quick-day', hint: 'Wake up at 9? One tap' },
  { label: 'Weekly Schedule', path: '/weekly-schedule', hint: 'Which modules run on which days' },
  { label: 'Daily Routine', path: '/routines', hint: 'Templates, times, completions' },
  { label: 'College', path: '/college', hint: 'Categories, bunk, stats' },
  { label: 'Workout', path: '/workout', hint: 'Templates, sessions, exercises' },
  { label: 'Guitar', path: '/guitar', hint: 'Practice duration & totals' },
  { label: 'Sleep', path: '/sleep', hint: 'Bedtime target & logs' },
  { label: 'Special Days', path: '/special-days', hint: 'Profiles & overrides' },
  { label: 'Spin Wheels', path: '/spin', hint: 'Recursive wheels & options' },
  { label: 'Friends / Social', path: '/social', hint: 'People & call logs' },
  { label: 'Entertainment', path: '/entertainment', hint: 'Watchlists & binge' },
  { label: 'Learning', path: '/learning', hint: 'Full-stack sessions' },
  { label: 'Money', path: '/money', hint: 'Daily budget, lend/borrow' },
  { label: 'Vehicles', path: '/bike', hint: 'Fuel, distance, range' },
  { label: 'Music', path: '/music', hint: 'Playlists & offline MP3' },
  { label: 'Development', path: '/development', hint: 'Personal records & photos' },
  { label: 'Bucket List', path: '/bucket-list', hint: 'Goals & status' },
  { label: 'Home arrival', path: '/home-arrival', hint: 'Geofence & late rule' },
  { label: 'Gamification', path: '/progress', hint: 'XP, streaks, achievements' },
  { label: '🎨 Appearance', path: '/appearance', hint: 'Logo, backgrounds, theme' },
  { label: 'Security', path: '/settings', hint: 'PIN / biometrics (below)' },
];

/** Default feature toggles the user can flip without code changes. */
const DEFAULT_TOGGLES: { key: string; label: string }[] = [
  { key: 'module.workout', label: 'Workout' },
  { key: 'module.guitar', label: 'Guitar' },
  { key: 'module.college', label: 'College' },
  { key: 'module.bike', label: 'Bike / vehicles' },
  { key: 'module.money', label: 'Money' },
  { key: 'module.sleep', label: 'Sleep' },
  { key: 'module.entertainment.kdrama', label: 'K-drama' },
  { key: 'module.entertainment.anime', label: 'Anime' },
  { key: 'module.social', label: 'Social tracker' },
  { key: 'routine.hair', label: 'Hair routine' },
  { key: 'routine.skin', label: 'Skin routine' },
  { key: 'module.spin', label: 'Weekend wheel' },
  { key: 'module.music', label: 'Music' },
  { key: 'module.learning', label: 'Learning' },
  { key: 'module.gamification', label: 'Gamification' },
  { key: 'module.homeArrival', label: 'Home arrival automation' },
];

type Tab = 'modules' | 'toggles' | 'backup' | 'security' | 'about';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('modules');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [customKey, setCustomKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [extraToggleKeys, setExtraToggleKeys] = useState<string[]>([]);

  const loadToggles = async () => {
    const all = await getAllFeatureToggles();
    const merged: Record<string, boolean> = {};
    for (const t of DEFAULT_TOGGLES) {
      merged[t.key] = all[t.key] ?? true;
    }
    for (const [k, v] of Object.entries(all)) {
      if (!(k in merged) && !k.endsWith('Seeded') && !k.includes('Seeded')) {
        merged[k] = v;
      }
    }
    setToggles(merged);
    setExtraToggleKeys(
      Object.keys(all).filter(
        (k) => !DEFAULT_TOGGLES.some((d) => d.key === k) && !k.includes('Seeded')
      )
    );
  };

  useEffect(() => {
    void loadToggles();
  }, []);

  const flip = async (key: string, enabled: boolean) => {
    await setFeatureEnabled(key, enabled);
    setToggles((t) => ({ ...t, [key]: enabled }));
  };

  const addToggle = async () => {
    const key = customKey.trim() || `custom.${Date.now()}`;
    await setFeatureEnabled(key, true);
    setToggles((t) => ({ ...t, [key]: true }));
    setExtraToggleKeys((e) => (e.includes(key) ? e : [...e, key]));
    setCustomKey('');
    setCustomLabel('');
  };

  async function handleExport(encrypted: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      if (encrypted) {
        if (!passphrase.trim()) {
          setStatus('Enter a passphrase for encrypted export.');
          return;
        }
        await exportBackupToFileOptions({ passphrase: passphrase.trim() });
        setStatus('Encrypted backup saved (.lmenc). Keep the passphrase — it cannot be recovered.');
      } else {
        await exportBackupToFile();
        setStatus('Backup JSON saved.');
      }
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFile(file: File) {
    if (restoreMode === 'replace') {
      const ok = confirm(
        'REPLACE will overwrite existing data with the backup. This cannot be undone. Continue?'
      );
      if (!ok) return;
    } else {
      const ok = confirm(
        'MERGE will upsert records from the backup into current data. Continue?'
      );
      if (!ok) return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload = await readBackupFileWithPassphrase(
        file,
        passphrase.trim() || undefined
      ).catch(async () => readBackupFile(file));
      await restoreBackup(payload, { mode: restoreMode });
      setStatus(`Backup restored (${restoreMode}). Reload recommended.`);
      await loadToggles();
    } catch (err) {
      setStatus(`Restore failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'modules', label: 'Modules' },
      { id: 'toggles', label: 'Feature toggles' },
      { id: 'backup', label: 'Backup' },
      { id: 'security', label: 'Security' },
      { id: 'about', label: 'About' },
    ];
    return (
      <div className="sc-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sc-tab ${tab === t.id ? 'sc-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Control Center" showBack={false}>
      <p className="sc-note">
        Your private configuration hub — change app behavior here without editing source code.
      </p>
      {tabsBar()}

      {tab === 'modules' && (
        <>
          <SectionHeader title="Configure modules" />
          <Card style={{ padding: 0 }}>
            {MODULE_LINKS.map((m, i) => (
              <Link
                key={m.path + m.label}
                to={m.path}
                className="sc-row-link"
                style={{
                  borderBottom:
                    i < MODULE_LINKS.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div>
                  <div className="sc-row-link__label">{m.label}</div>
                  <div className="sc-row-link__hint">{m.hint}</div>
                </div>
                <span className="sc-row-link__chev">›</span>
              </Link>
            ))}
          </Card>
        </>
      )}

      {tab === 'toggles' && (
        <>
          <SectionHeader title="Feature ON / OFF" />
          <p className="sc-note">
            Toggles are stored on-device. Modules still appear in nav; use these flags for
            automation and future gating — editable list below.
          </p>
          <Card style={{ padding: '4px 16px' }}>
            {DEFAULT_TOGGLES.map((t) => (
              <div key={t.key} className="sc-toggle-row">
                <div>
                  <div className="sc-toggle-row__label">{t.label}</div>
                  <div className="sc-toggle-row__hint">{t.key}</div>
                </div>
                <button
                  type="button"
                  className={`sc-switch ${toggles[t.key] !== false ? 'sc-switch--on' : ''}`}
                  aria-pressed={toggles[t.key] !== false}
                  onClick={() => flip(t.key, !(toggles[t.key] !== false))}
                />
              </div>
            ))}
            {extraToggleKeys.map((k) => (
              <div key={k} className="sc-toggle-row">
                <div>
                  <div className="sc-toggle-row__label">{k}</div>
                  <div className="sc-toggle-row__hint">Custom</div>
                </div>
                <button
                  type="button"
                  className={`sc-switch ${toggles[k] ? 'sc-switch--on' : ''}`}
                  onClick={() => flip(k, !toggles[k])}
                />
              </div>
            ))}
          </Card>
          <Card style={{ marginTop: 12 }}>
            <strong>Add toggle</strong>
            <input
              className="sc-input"
              placeholder="key (e.g. module.custom)"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
            />
            <input
              className="sc-input"
              placeholder="label (optional note)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              style={{ marginTop: 8 }}
            />
            <Button variant="secondary" style={{ marginTop: 10 }} onClick={addToggle}>
              Add
            </Button>
          </Card>
        </>
      )}

      {tab === 'backup' && (
        <>
          <SectionHeader title="Backup & restore" />
          <Card>
            <p className="sc-note">
              Export includes structured data, settings, routines, records, watchlists,
              configuration, progress, and local blobs. Fully offline. Optional AES-GCM
              encryption with your passphrase.
            </p>
            <div className="sc-field">
              <label>Passphrase (optional, for encrypted export / decrypt import)</label>
              <input
                className="sc-input"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave empty for plain JSON"
              />
            </div>
            <div className="sc-actions">
              <Button disabled={busy} onClick={() => handleExport(false)}>
                EXPORT BACKUP
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => handleExport(true)}
              >
                EXPORT ENCRYPTED
              </Button>
            </div>
            <div className="sc-field" style={{ marginTop: 16 }}>
              <label>Restore mode</label>
              <select
                className="sc-input"
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value as 'merge' | 'replace')}
              >
                <option value="merge">MERGE (upsert)</option>
                <option value="replace">REPLACE (overwrite — destructive)</option>
              </select>
            </div>
            <div className="sc-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                IMPORT / RESTORE
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json,.lmenc,text/plain"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleRestoreFile(f);
                  e.target.value = '';
                }}
              />
            </div>
            {status && <p className="sc-note" style={{ marginTop: 12 }}>{status}</p>}
          </Card>
        </>
      )}

      {tab === 'security' && <SecuritySettingsCard />}

      {tab === 'about' && (
        <Card>
          <strong>Life Manager</strong>
          <p className="sc-note">
            Offline-first personal OS. v0.0.1 · data stays on this device unless you export.
          </p>
          <p className="sc-note">
            Notifications / Automation deeper hooks live under Home arrival and module
            settings. Docs in <code>docs/</code>.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
