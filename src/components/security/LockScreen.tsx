import { useEffect, useState, type ReactNode } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSecurity } from '../../security/SecurityProvider';
import { verifySecret, verifyRecoveryCode, resetSecretAfterRecovery } from '../../security/lockManager';
import { checkBiometricAvailability, verifyBiometric } from '../../security/biometric';
import { AppLogo } from '../../appearance/AppLogo';

type Mode = 'unlock' | 'recover' | 'reset';

export function LockScreen() {
  const { config, unlock } = useSecurity();
  const [mode, setMode] = useState<Mode>('unlock');
  const [secret, setSecret] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    if (!config.biometricEnabled) return;
    void checkBiometricAvailability().then((r) => setBiometricAvailable(r.available));
  }, [config.biometricEnabled]);

  // Offer biometric immediately when the lock screen appears, if enabled & available.
  useEffect(() => {
    if (mode !== 'unlock' || !config.biometricEnabled) return;
    let cancelled = false;
    void checkBiometricAvailability().then(async (r) => {
      if (cancelled || !r.available) return;
      const ok = await verifyBiometric('Unlock the app');
      if (!cancelled && ok) unlock();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnlock() {
    setError(null);
    const result = await verifySecret(secret);
    if (result.success) {
      unlock();
      return;
    }
    if (result.locked) {
      setCooldownUntil(result.lockedUntil);
      setError('Too many attempts. Try again later.');
    } else {
      setError(`Incorrect ${config.lockMethod}. ${result.attemptsRemaining} attempt(s) left.`);
    }
    setSecret('');
  }

  async function handleBiometric() {
    const ok = await verifyBiometric('Unlock the app');
    if (ok) unlock();
  }

  async function handleVerifyRecovery() {
    setError(null);
    const valid = await verifyRecoveryCode(recoveryCode);
    if (!valid) {
      setError('That recovery code is not valid.');
      return;
    }
    setMode('reset');
  }

  async function handleReset() {
    setError(null);
    if (newSecret.length < 4) {
      setError(`${config.lockMethod === 'pin' ? 'PIN' : 'Password'} is too short.`);
      return;
    }
    const { recoveryCode: fresh } = await resetSecretAfterRecovery(newSecret);
    setNewRecoveryCode(fresh);
  }

  if (newRecoveryCode) {
    return (
      <LockScreenLayout>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><AppLogo size={64} /></div>
      <Card>
          <strong>Save your new recovery code</strong>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            This is shown only once. Store it somewhere safe — it's the only way back in if you
            forget your {config.lockMethod}.
          </p>
          <p style={{ fontSize: 'var(--text-xl)', letterSpacing: 2, textAlign: 'center' }}>
            {newRecoveryCode}
          </p>
          <Button
            onClick={() => {
              setNewRecoveryCode(null);
              setMode('unlock');
              unlock();
            }}
          >
            I've saved it — continue
          </Button>
        </Card>
      </LockScreenLayout>
    );
  }

  if (mode === 'recover') {
    return (
      <LockScreenLayout>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong>Enter recovery code</strong>
          <input
            className="lock-screen__input"
            placeholder="XXXX-XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
          />
          {error && <span style={{ color: 'var(--color-danger, #e5484d)' }}>{error}</span>}
          <Button onClick={handleVerifyRecovery}>Verify</Button>
          <Button variant="ghost" onClick={() => setMode('unlock')}>
            Back
          </Button>
        </Card>
      </LockScreenLayout>
    );
  }

  if (mode === 'reset') {
    return (
      <LockScreenLayout>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong>Set a new {config.lockMethod === 'pin' ? 'PIN' : 'password'}</strong>
          <input
            className="lock-screen__input"
            type={config.lockMethod === 'pin' ? 'tel' : 'password'}
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
          />
          {error && <span style={{ color: 'var(--color-danger, #e5484d)' }}>{error}</span>}
          <Button onClick={handleReset}>Save</Button>
        </Card>
      </LockScreenLayout>
    );
  }

  const inCooldown = cooldownUntil && new Date(cooldownUntil) > new Date();

  return (
    <LockScreenLayout>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong>Enter your {config.lockMethod === 'pin' ? 'PIN' : 'password'}</strong>
        <input
          className="lock-screen__input"
          type={config.lockMethod === 'pin' ? 'tel' : 'password'}
          inputMode={config.lockMethod === 'pin' ? 'numeric' : 'text'}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={Boolean(inCooldown)}
          autoFocus
        />
        {error && <span style={{ color: 'var(--color-danger, #e5484d)' }}>{error}</span>}
        <Button onClick={handleUnlock} disabled={Boolean(inCooldown)}>
          Unlock
        </Button>
        {biometricAvailable && (
          <Button variant="secondary" onClick={handleBiometric} disabled={Boolean(inCooldown)}>
            Use biometrics
          </Button>
        )}
        <Button variant="ghost" onClick={() => setMode('recover')}>
          Forgot {config.lockMethod === 'pin' ? 'PIN' : 'password'}?
        </Button>
      </Card>
    </LockScreenLayout>
  );
}

function LockScreenLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg, #0b0b0f)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>{children}</div>
    </div>
  );
}
