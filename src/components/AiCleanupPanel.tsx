import React from 'react';
import { AtlasSettings } from '../core/types';
import { Anchor, Sparkles, Layers } from 'lucide-react';

interface AiCleanupPanelProps {
  settings: AtlasSettings;
  onChange: (settings: AtlasSettings) => void;
}

export const AiCleanupPanel: React.FC<AiCleanupPanelProps> = ({ settings, onChange }) => {
  const update = <K extends keyof AtlasSettings>(key: K, value: AtlasSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 1. Ground Snap (Baseline Lock) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.enableGroundSnap ? '1px solid #1a4d35' : '1px solid var(--border-subtle)',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: settings.enableGroundSnap ? 'var(--accent-green)' : 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableGroundSnap ?? false}
              onChange={(e) => update('enableGroundSnap', e.target.checked)}
              style={{ accentColor: 'var(--accent-green)', cursor: 'pointer' }}
            />
            <Anchor size={13} style={{ color: settings.enableGroundSnap ? 'var(--accent-green)' : 'var(--text-muted)' }} />
            Ground Snap (Baseline)
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableGroundSnap ? 'var(--accent-green)' : 'var(--text-muted)',
              background: settings.enableGroundSnap ? '#12261e' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Anti-Float
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Auto-anchors feet contact points to a unified horizon line so the character never bobs or floats vertically.
        </div>
      </div>

      {/* 2. Temporal De-Flicker (AI Contour Stabilizer) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.enableDeFlicker ? '1px solid #1e608a' : '1px solid var(--border-subtle)',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: settings.enableDeFlicker ? 'var(--accent-cyan)' : 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableDeFlicker ?? false}
              onChange={(e) => update('enableDeFlicker', e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <Sparkles size={13} style={{ color: settings.enableDeFlicker ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
            Temporal De-Flicker
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableDeFlicker ? 'var(--accent-cyan)' : 'var(--text-muted)',
              background: settings.enableDeFlicker ? '#0f2430' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            AI Stabilizer
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Reduces edge jitter and alpha boiling between consecutive AI frames.
        </div>

        {settings.enableDeFlicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>Smoothing Strength</span>
              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.deFlickerStrength ?? 40}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={settings.deFlickerStrength ?? 40}
              onChange={(e) => update('deFlickerStrength', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* 3. Onion Skinning */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.enableOnionSkin ? '1px solid #754128' : '1px solid var(--border-subtle)',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: settings.enableOnionSkin ? 'var(--accent-orange)' : 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableOnionSkin ?? false}
              onChange={(e) => update('enableOnionSkin', e.target.checked)}
              style={{ accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
            />
            <Layers size={13} style={{ color: settings.enableOnionSkin ? 'var(--accent-orange)' : 'var(--text-muted)' }} />
            Onion Skinning
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableOnionSkin ? 'var(--accent-orange)' : 'var(--text-muted)',
              background: settings.enableOnionSkin ? '#31180d' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Animator Ghost
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Displays previous (<span style={{ color: '#ff5c5c' }}>red</span>) and next (<span style={{ color: '#00f084' }}>green</span>) keyframe silhouettes.
        </div>

        {settings.enableOnionSkin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>Ghost Opacity</span>
              <span style={{ color: 'var(--accent-orange)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.onionOpacity ?? 35}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={80}
              value={settings.onionOpacity ?? 35}
              onChange={(e) => update('onionOpacity', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
