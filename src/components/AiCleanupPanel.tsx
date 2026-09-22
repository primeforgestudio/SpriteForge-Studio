import React from 'react';
import { AtlasSettings } from '../core/types';
import { Anchor, Sparkles, Layers, Crosshair } from 'lucide-react';

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
          border: '1px solid var(--border-subtle)',
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
              color: 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableGroundSnap ?? false}
              onChange={(e) => update('enableGroundSnap', e.target.checked)}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
            />
            <Anchor size={13} style={{ color: settings.enableGroundSnap ? '#FF551F' : 'var(--text-muted)' }} />
            Ground Snap (Baseline)
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableGroundSnap ? '#FF551F' : 'var(--text-muted)',
              background: settings.enableGroundSnap ? '#2B2D37' : 'transparent',
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
          border: '1px solid var(--border-subtle)',
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
              color: 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableDeFlicker ?? false}
              onChange={(e) => update('enableDeFlicker', e.target.checked)}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
            />
            <Sparkles size={13} style={{ color: settings.enableDeFlicker ? '#FF551F' : 'var(--text-muted)' }} />
            Temporal De-Flicker
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableDeFlicker ? '#FF551F' : 'var(--text-muted)',
              background: settings.enableDeFlicker ? '#2B2D37' : 'transparent',
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
              <span style={{ color: '#FF551F', fontFamily: 'monospace', fontWeight: 600 }}>
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
          border: '1px solid var(--border-subtle)',
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
              color: 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableOnionSkin ?? false}
              onChange={(e) => update('enableOnionSkin', e.target.checked)}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
            />
            <Layers size={13} style={{ color: settings.enableOnionSkin ? '#FF551F' : 'var(--text-muted)' }} />
            Onion Skinning
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableOnionSkin ? '#FF551F' : 'var(--text-muted)',
              background: settings.enableOnionSkin ? '#2B2D37' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Animator Ghost
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Displays previous (<span style={{ color: '#ff5c5c' }}>red</span>) and next (<span style={{ color: '#00d4ff' }}>cyan</span>) keyframe silhouettes.
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

      {/* 4. In-Place Centering / Root Motion Stabilizer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
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
              color: 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableInPlace ?? false}
              onChange={(e) => update('enableInPlace', e.target.checked)}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
            />
            <Crosshair size={13} style={{ color: settings.enableInPlace ? '#FF551F' : 'var(--text-muted)' }} />
            In-Place Lock
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableInPlace ? '#FF551F' : 'var(--text-muted)',
              background: settings.enableInPlace ? '#2B2D37' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Root Motion
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Tracks character center of mass and anchors each frame in-place. Displacements are saved as game Root Motion.
        </div>

        {settings.enableInPlace && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lock Axis</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => update('inPlaceLockAxis', 'x')}
                style={{
                  height: 26,
                  fontSize: 10,
                  fontWeight: (settings.inPlaceLockAxis ?? 'x') === 'x' ? 700 : 500,
                  borderRadius: 4,
                  background: (settings.inPlaceLockAxis ?? 'x') === 'x' ? '#2B2D37' : 'var(--bg-input)',
                  border: (settings.inPlaceLockAxis ?? 'x') === 'x' ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                  color: (settings.inPlaceLockAxis ?? 'x') === 'x' ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Lock X (Run/Walk)
              </button>
              <button
                onClick={() => update('inPlaceLockAxis', 'xy')}
                style={{
                  height: 26,
                  fontSize: 10,
                  fontWeight: settings.inPlaceLockAxis === 'xy' ? 700 : 500,
                  borderRadius: 4,
                  background: settings.inPlaceLockAxis === 'xy' ? '#2B2D37' : 'var(--bg-input)',
                  border: settings.inPlaceLockAxis === 'xy' ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                  color: settings.inPlaceLockAxis === 'xy' ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Lock X & Y (Hover)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. 2D Mesh & Overdraw Optimizer (Mobile & iGaming) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
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
              color: 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.meshSettings?.enabled ?? false}
              onChange={(e) => {
                const current = settings.meshSettings ?? {
                  enabled: false,
                  detail: 'balanced',
                  paddingPx: 2,
                  alphaThreshold: 15,
                  showWireframe: true,
                };
                update('meshSettings', { ...current, enabled: e.target.checked });
              }}
              style={{ accentColor: '#00e5ff', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13 }}>📐</span>
            2D Mesh Optimizer
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.meshSettings?.enabled ? '#00e5ff' : 'var(--text-muted)',
              background: settings.meshSettings?.enabled ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Overdraw Killer
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Auto-triangulates sprite silhouettes into tight 2D polygonal meshes. Cuts GPU overdraw in Godot 4, Spine & mobile by up to 75%.
        </div>

        {settings.meshSettings?.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            {/* Detail Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Mesh Detail / Vertex Budget</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {(['low', 'balanced', 'high'] as const).map((lvl) => {
                  const isActive = (settings.meshSettings?.detail ?? 'balanced') === lvl;
                  const label = lvl === 'low' ? 'Low (~18v)' : lvl === 'balanced' ? 'Balanced (~36v)' : 'High (~64v)';
                  return (
                    <button
                      key={lvl}
                      onClick={() => update('meshSettings', { ...settings.meshSettings!, detail: lvl })}
                      style={{
                        height: 24,
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: 4,
                        background: isActive ? '#2B2D37' : 'var(--bg-input)',
                        border: isActive ? '1px solid #00e5ff' : '1px solid var(--border-subtle)',
                        color: isActive ? '#00e5ff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hull Padding Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Hull Padding</span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff' }}>
                  {settings.meshSettings.paddingPx ?? 2} px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={settings.meshSettings.paddingPx ?? 2}
                onChange={(e) => update('meshSettings', { ...settings.meshSettings!, paddingPx: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#00e5ff' }}
              />
            </div>

            {/* Viewport Wireframe Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: 'var(--text-bright)' }}>
              <input
                type="checkbox"
                checked={settings.meshSettings.showWireframe !== false}
                onChange={(e) => update('meshSettings', { ...settings.meshSettings!, showWireframe: e.target.checked })}
                style={{ accentColor: '#00e5ff' }}
              />
              <span>Show Mesh Wireframe in Viewport</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
