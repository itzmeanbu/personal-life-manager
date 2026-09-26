import { useCallback, useEffect, useState } from 'react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import {
  getAppearanceConfig,
  setAppearanceConfig,
  type AppearanceConfig,
  DEFAULT_APPEARANCE,
} from '../appearance/settings';
import {
  getMediaIndex,
  importBackgroundPhoto,
  importLogo,
  removeMedia,
  blobUrl,
  listBackgrounds,
  type MediaIndexEntry,
} from '../appearance/media';
import { AppLogo, DefaultLogoMark } from '../appearance/AppLogo';
import { toIsoDate } from '../routine/engine';
import { pickDailyBackground } from '../appearance/shuffleBg';
import '../appearance/appearance.css';

export default function Appearance() {
  const [cfg, setCfg] = useState<AppearanceConfig>(DEFAULT_APPEARANCE);
  const [index, setIndex] = useState<MediaIndexEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const c = await getAppearanceConfig();
    setCfg(c);
    const idx = await getMediaIndex();
    setIndex(idx);
    const urls: Record<string, string> = {};
    for (const e of listBackgrounds(idx)) {
      const k = e.thumbKey ?? e.key;
      const u = await blobUrl(k);
      if (u) urls[e.key] = u;
    }
    setThumbs((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (patch: Partial<AppearanceConfig>) => {
    const next = await setAppearanceConfig(patch);
    setCfg(next);
  };

  const addBg = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files?.length) return;
      setBusy(true);
      try {
        for (const f of Array.from(files)) {
          await importBackgroundPhoto(f);
        }
        setMsg(`Imported ${files.length} photo(s) into private app storage (not Gallery).`);
        await refresh();
      } finally {
        setBusy(false);
        input.remove();
      }
    };
    input.click();
  };

  const uploadLogo = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        const key = await importLogo(f);
        await save({ customLogoBlobKey: key });
        setMsg('Custom logo saved privately.');
        await refresh();
      } finally {
        setBusy(false);
        input.remove();
      }
    };
    input.click();
  };

  const shuffleNow = async () => {
    const { key, history } = pickDailyBackground(
      index,
      { ...cfg, todayBackgroundDate: null, todayBackgroundKey: null },
      toIsoDate(new Date())
    );
    await save({
      todayBackgroundKey: key,
      todayBackgroundDate: toIsoDate(new Date()),
      backgroundHistory: history,
      dailyBackgroundEnabled: true,
    });
    setMsg('Background reshuffled for today.');
    window.location.reload();
  };

  const bgs = listBackgrounds(index);

  return (
    <PageShell title="🎨 Appearance">
      <p className="ap-muted">
        Colors, logo, and daily backgrounds. Photos stay in private app storage (IndexedDB) — not
        copied to DCIM/Pictures/Gallery.
      </p>

      <SectionHeader title="🖼️ App logo" />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AppLogo size={56} />
          {!cfg.customLogoBlobKey && <DefaultLogoMark size={56} />}
        </div>
        <div className="ap-actions">
          <Button variant="primary" disabled={busy} onClick={uploadLogo}>
            🖼️ Upload custom logo
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => save({ customLogoBlobKey: null })}
          >
            🔄 Restore default logo
          </Button>
        </div>
        <p className="ap-muted" style={{ marginTop: 8 }}>
          Android launcher icon still requires rebuilding the adaptive icon in Android Studio —
          runtime logo applies in-app (header, lock screen).
        </p>
      </Card>

      <SectionHeader title="📸 Background gallery" />
      <Card>
        <div className="ap-toggle">
          <span>🌅 Daily background</span>
          <input
            type="checkbox"
            checked={cfg.dailyBackgroundEnabled}
            onChange={(e) => save({ dailyBackgroundEnabled: e.target.checked })}
          />
        </div>
        <div className="ap-toggle">
          <span>🔀 Random selection</span>
          <input
            type="checkbox"
            checked={cfg.randomBackgroundEnabled}
            onChange={(e) => save({ randomBackgroundEnabled: e.target.checked })}
          />
        </div>
        <div className="ap-toggle">
          <span>🎯 Special-day backgrounds</span>
          <input
            type="checkbox"
            checked={cfg.specialDayBackgroundEnabled}
            onChange={(e) => save({ specialDayBackgroundEnabled: e.target.checked })}
          />
        </div>
        <div className="ap-actions">
          <Button variant="primary" disabled={busy} onClick={addBg}>
            ➕ Add photo
          </Button>
          <Button variant="secondary" disabled={busy || bgs.length === 0} onClick={shuffleNow}>
            🔀 Shuffle now
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              save({
                todayBackgroundKey: null,
                todayBackgroundDate: null,
              })
            }
          >
            ⏭️ Clear today pick
          </Button>
        </div>
        {bgs.length === 0 ? (
          <p className="ap-muted" style={{ marginTop: 12 }}>
            No backgrounds yet. Add up to ~30 personal photos.
          </p>
        ) : (
          <div className="ap-grid" style={{ marginTop: 12 }}>
            {bgs.map((e) => (
              <div key={e.key} style={{ position: 'relative' }}>
                {thumbs[e.key] ? (
                  <img
                    src={thumbs[e.key]}
                    alt=""
                    className={`ap-thumb ${cfg.fixedBackgroundKey === e.key ? 'ap-thumb--on' : ''}`}
                    loading="lazy"
                    onClick={() =>
                      save({
                        fixedBackgroundKey: e.key,
                        randomBackgroundEnabled: false,
                      })
                    }
                  />
                ) : (
                  <div className="ap-thumb" />
                )}
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    border: 'none',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    fontSize: 11,
                    padding: '2px 6px',
                  }}
                  onClick={() => {
                    void removeMedia(e.key).then(refresh);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SectionHeader title="🌈 Theme" />
      <Card>
        <div className="ap-field">
          <label>Accent color (CSS, empty = default)</label>
          <input
            className="ap-input"
            value={cfg.accentColor}
            placeholder="#8B7CFF"
            onChange={(e) => save({ accentColor: e.target.value })}
          />
        </div>
        <div className="ap-field">
          <label>Mode</label>
          <select
            className="ap-input"
            value={cfg.colorMode}
            onChange={(e) => save({ colorMode: e.target.value as 'dark' | 'light' })}
          >
            <option value="dark">Dark (default)</option>
            <option value="light">Light (experimental)</option>
          </select>
        </div>
      </Card>
      {msg && <p className="ap-muted">{msg}</p>}
    </PageShell>
  );
}
