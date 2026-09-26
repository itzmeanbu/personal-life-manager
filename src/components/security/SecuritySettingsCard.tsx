import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  getSecurityConfig,
  setupLock,
  updateSecurityConfig,
  disableLock,
  verifySecret,
} from '../../security/lockManager';
import { checkBiometricAvailability } from '../../security/biometric';
import type { SecurityConfig } from '../../security/types';

const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
];

export function SecuritySettingsCard() {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupSecretConfirm, setSetupSecretConfirm] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [disableSecret, setDisableSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    void getSecurityConfig().then(setConfig);
    void checkBiometricAvailability().then((r) => setBiometricAvailable(r.available));
  }, []);

  async function refresh() {
    setConfig(await getSecurityConfig());
  }

  async function handleSetup() {
    setError(null);
    if (setupSecret.length < 4) {
      setError(`${config?.lockMethod === 'password' ? 'Password' : 'PIN'} must be at least 4 characters.`);
      return;
    }
    if (setupSecret !== setupSecretConfirm) {
      setError('Entries do not match.');
      return;
    }
    const { recoveryCode: code } = await setupLock(setupSecret, config?.lockMethod ?? 'pin');
    setRecoveryCode(code);
    setSetupSecret('');
    setSetupSecretConfirm('');
    setShowSetup(false);
    await refresh();
  }

  async function handleDisable() {
    setError(null);
    const result = await verifySecret(disableSecret);
    if (!result.success) {
      setError('Incorrect PIN/password — app lock was not disabled.');
      return;
    }
    await disableLock();
    setShowDisableConfirm(false);
    setDisableSecret('');
    await refresh();
  }

  if (!config) return null;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      <strong>App lock &amp; privacy</strong>

      {!config.isSetUp && !showSetup && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            App lock is off. Anyone with the device can open the app. Notifications remain
            enabled either way.
          </p>
          <Button onClick={() => setShowSetup(true)}>Set up app lock</Button>
        </>
      )}

      {!config.isSetUp && showSetup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={config.lockMethod === 'pin' ? 'primary' : 'secondary'}
              onClick={() => setConfig({ ...config, lockMethod: 'pin' })}
            >
              PIN
            </Button>
            <Button
              variant={config.lockMethod === 'password' ? 'primary' : 'secondary'}
              onClick={() => setConfig({ ...config, lockMethod: 'password' })}
            >
              Password
            </Button>
          </div>
          <input
            className="lock-screen__input"
            type={config.lockMethod === 'pin' ? 'tel' : 'password'}
            placeholder={config.lockMethod === 'pin' ? 'New PIN' : 'New password'}
            value={setupSecret}
            onChange={(e) => setSetupSecret(e.target.value)}
          />
          <input
            className="lock-screen__input"
            type={config.lockMethod === 'pin' ? 'tel' : 'password'}
            placeholder="Confirm"
            value={setupSecretConfirm}
            onChange={(e) => setSetupSecretConfirm(e.target.value)}
          />
          {error && <span style={{ color: 'var(--color-danger, #e5484d)' }}>{error}</span>}
          <Button onClick={handleSetup}>Save</Button>
        </div>
      )}

      {recoveryCode && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <strong>Your recovery code — save it now</strong>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Shown once. Use it to reset your {config.lockMethod} if you forget it.
          </p>
          <p style={{ fontSize: 'var(--text-lg)', letterSpacing: 2, textAlign: 'center' }}>
            {recoveryCode}
          </p>
          <Button onClick={() => setRecoveryCode(null)}>Done</Button>
        </div>
      )}

      {config.isSetUp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleRow
            label="App lock"
            checked={config.appLockEnabled}
            onChange={(v) => updateSecurityConfig({ appLockEnabled: v }).then(refresh)}
          />

          {biometricAvailable && (
            <ToggleRow
              label="Fingerprint / face unlock"
              checked={config.biometricEnabled}
              onChange={(v) => updateSecurityConfig({ biometricEnabled: v }).then(refresh)}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Auto-lock after</span>
            <select
              value={config.autoLockMinutes}
              onChange={(e) =>
                updateSecurityConfig({ autoLockMinutes: Number(e.target.value) }).then(refresh)
              }
            >
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ToggleRow
            label="Lock immediately when leaving the app"
            checked={config.lockOnBackground}
            onChange={(v) => updateSecurityConfig({ lockOnBackground: v }).then(refresh)}
          />

          <ToggleRow
            label="Block screenshots & screen recording"
            checked={config.screenshotProtectionEnabled}
            onChange={(v) => updateSecurityConfig({ screenshotProtectionEnabled: v }).then(refresh)}
          />
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>
            Android only — hides app content from screenshots, screen recordings, and the
            recent-apps preview.
          </p>

          {!showDisableConfirm ? (
            <Button variant="ghost" onClick={() => setShowDisableConfirm(true)}>
              Turn off app lock
            </Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="lock-screen__input"
                type={config.lockMethod === 'pin' ? 'tel' : 'password'}
                placeholder={`Confirm ${config.lockMethod}`}
                value={disableSecret}
                onChange={(e) => setDisableSecret(e.target.value)}
              />
              {error && <span style={{ color: 'var(--color-danger, #e5484d)' }}>{error}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" onClick={handleDisable}>
                  Confirm turn off
                </Button>
                <Button variant="secondary" onClick={() => setShowDisableConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
