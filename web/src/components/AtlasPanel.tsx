import React from 'react';
import { AtlasSettings, CollisionSettings } from '../core/types';
import { StatePreset } from '../core/boundingCrop';
import { Scissors, RotateCcw, Shield, Wand2 } from 'lucide-react';

interface AtlasPanelProps {
  settings: AtlasSettings;
  onChange: (settings: AtlasSettings) => void;
  onRefreshAtlas: () => void;
  statePreset: StatePreset;
  onChangeStatePreset: (preset: StatePreset) => void;
  onAutoCrop: () => Promise<void>;
  isAutoCropping: boolean;
  onResetCrop: () => void;
  onAutoFitFeet?: () => void;
}

export const AtlasPanel: React.FC<AtlasPanelProps> = ({
  settings,
  onChange,
  onRefreshAtlas,
  statePreset,
  onChangeStatePreset,
  onAutoCrop,
  isAutoCropping,
  onResetCrop,
  onAutoFitFeet,
}) => {
  const update = <K extends keyof AtlasSettings>(key: K, value: AtlasSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleColsChange = (cols: number) => {
    const validCols = Math.max(1, cols);
    const rows = Math.ceil(settings.framesCount / validCols);
    onChange({
      ...settings,
      columns: validCols,
      rows: Math.max(1, rows),
    });
  };

  const handleFramesChange = (count: number) => {
    const validFrames = Math.max(1, count);
    const rows = Math.ceil(validFrames / settings.columns);
    onChange({
      ...settings,
      framesCount: validFrames,
      rows: Math.max(1, rows),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
      {/* Section Header */}
      <div className="sidebar-section-title">
        <span>Atlas Grid Settings</span>
        <button
          onClick={onRefreshAtlas}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Frame Size */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Frame Size</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0 10px',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>W:</span>
            <input
              type="number"
              value={settings.frameWidth}
              onChange={(e) => update('frameWidth', Math.max(16, Number(e.target.value)))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-bright)',
              }}
            />
          </div>

          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>×</span>

          <div
            style={{
              flex: 1,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0 10px',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>H:</span>
            <input
              type="number"
              value={settings.frameHeight}
              onChange={(e) => update('frameHeight', Math.max(16, Number(e.target.value)))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-bright)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Presets Row (128, 256, 512, 1024) */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[128, 256, 512, 1024].map((size) => {
          const isActive = settings.frameWidth === size && settings.frameHeight === size;
          return (
            <button
              key={size}
              onClick={() => onChange({ ...settings, frameWidth: size, frameHeight: size })}
              style={{
                flex: 1,
                height: 28,
                padding: 0,
                fontSize: 11,
                borderRadius: 5,
                background: isActive ? '#112b20' : 'var(--bg-input)',
                border: isActive ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                color: isActive ? 'var(--accent-green)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {size}
            </button>
          );
        })}
      </div>

      {/* Auto-Crop & State Canvas Padding */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.cropBox ? '1px solid #1c4d36' : '1px solid var(--border-subtle)',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scissors size={12} color="var(--accent-green)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>
              Auto-Crop & Padding
            </span>
          </div>
          {settings.cropBox && (
            <button
              onClick={onResetCrop}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-orange)',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 4px',
              }}
              title="Reset crop to full frame"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}
        </div>

        {/* State Padding Presets */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            State Preset (Canvas Headroom)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {(
              [
                { id: 'standard', label: 'Std', desc: 'Standard 10% safety margin' },
                { id: 'attack', label: 'Attack', desc: 'Front reach (+28% forward padding)' },
                { id: 'jump', label: 'Jump', desc: 'Jump headroom (+34% top padding)' },
                { id: 'idle', label: 'Idle', desc: 'Tightest bounds (5% padding)' },
              ] as const
            ).map((p) => {
              const isSelected = statePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onChangeStatePreset(p.id)}
                  title={p.desc}
                  style={{
                    height: 26,
                    padding: 0,
                    fontSize: 10,
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 4,
                    background: isSelected ? '#112b20' : 'var(--bg-input)',
                    border: isSelected ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                    color: isSelected ? 'var(--accent-green)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto-Crop Button */}
        <button
          onClick={onAutoCrop}
          disabled={isAutoCropping}
          style={{
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: settings.cropBox ? '#0d2b1e' : 'var(--bg-input)',
            border: settings.cropBox ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
            borderRadius: 5,
            color: settings.cropBox ? 'var(--accent-green)' : 'var(--text-main)',
            fontSize: 11,
            fontWeight: 600,
            cursor: isAutoCropping ? 'wait' : 'pointer',
            opacity: isAutoCropping ? 0.7 : 1,
            transition: 'all 0.15s ease',
          }}
          title="Compute union bounding box of keyframe silhouettes and crop empty margins"
        >
          {isAutoCropping ? (
            'Analyzing Bounds...'
          ) : settings.cropBox ? (
            `✓ Cropped (${settings.cropBox.width}×${settings.cropBox.height})`
          ) : (
            '✂ Tight Auto-Crop Bounds'
          )}
        </button>
      </div>

      {/* Contact Drop-Shadow */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.enableShadow ? '1px solid #1c4d36' : '1px solid var(--border-subtle)',
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
              color: settings.enableShadow ? 'var(--accent-green)' : 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.enableShadow ?? false}
              onChange={(e) => update('enableShadow', e.target.checked)}
              style={{ accentColor: 'var(--accent-green)', cursor: 'pointer' }}
            />
            Contact Drop-Shadow
          </label>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Under feet</span>
        </div>

        {settings.enableShadow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>Shadow Opacity</span>
              <span style={{ color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                {settings.shadowOpacity ?? 45}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={settings.shadowOpacity ?? 45}
              onChange={(e) => update('shadowOpacity', Number(e.target.value))}
              style={{ width: '100%' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2 }}>
              <span style={{ color: 'var(--text-muted)' }}>Shadow Width</span>
              <span style={{ color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                {settings.shadowScale ?? 60}%
              </span>
            </div>
            <input
              type="range"
              min={25}
              max={100}
              value={settings.shadowScale ?? 60}
              onChange={(e) => update('shadowScale', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* Godot 4 Scene (.tscn) & Colliders */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: settings.collisionSettings?.generateTscn
            ? '1px solid #1a4d66'
            : '1px solid var(--border-subtle)',
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
              color: settings.collisionSettings?.generateTscn
                ? 'var(--accent-cyan)'
                : 'var(--text-bright)',
            }}
          >
            <input
              type="checkbox"
              checked={settings.collisionSettings?.generateTscn ?? true}
              onChange={(e) => {
                const cur = settings.collisionSettings || {
                  enabled: true,
                  generateTscn: true,
                  feet: {
                    enabled: true,
                    shape: 'capsule',
                    width: 28,
                    height: 12,
                    offsetX: 0,
                    offsetY: -6,
                  },
                  hurtbox: { enabled: true, width: 36, height: 64, offsetX: 0, offsetY: -36 },
                  hitbox: { enabled: false, width: 32, height: 32, offsetX: 28, offsetY: -32 },
                };
                update('collisionSettings', { ...cur, generateTscn: e.target.checked });
              }}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <span>Export Godot 4 Scene (.tscn)</span>
          </label>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>CharacterBody2D</span>
        </div>

        {settings.collisionSettings?.generateTscn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {/* Feet physics collider */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.collisionSettings.feet.enabled}
                  onChange={(e) => {
                    const cur = settings.collisionSettings!;
                    update('collisionSettings', {
                      ...cur,
                      feet: { ...cur.feet, enabled: e.target.checked },
                    });
                  }}
                  style={{ accentColor: '#00f084' }}
                />
                <span style={{ color: '#00f084', fontWeight: 600 }}>Feet Collider</span>
              </label>

              {onAutoFitFeet && (
                <button
                  onClick={onAutoFitFeet}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 22,
                    padding: '0 6px',
                    fontSize: 9,
                    fontWeight: 600,
                    borderRadius: 4,
                    background: '#0d2b1e',
                    border: '1px solid var(--accent-green)',
                    color: 'var(--accent-green)',
                    cursor: 'pointer',
                  }}
                  title="Auto-detect feet width and center from ground contact pixels"
                >
                  <Wand2 size={10} />
                  Auto Feet
                </button>
              )}
            </div>

            {/* Hurtbox & Hitbox toggles */}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.collisionSettings.hurtbox.enabled}
                  onChange={(e) => {
                    const cur = settings.collisionSettings!;
                    update('collisionSettings', {
                      ...cur,
                      hurtbox: { ...cur.hurtbox, enabled: e.target.checked },
                    });
                  }}
                  style={{ accentColor: '#00b0ff' }}
                />
                <span style={{ color: '#00b0ff', fontWeight: 600 }}>Hurtbox (Body)</span>
              </label>

              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.collisionSettings.hitbox.enabled}
                  onChange={(e) => {
                    const cur = settings.collisionSettings!;
                    update('collisionSettings', {
                      ...cur,
                      hitbox: { ...cur.hitbox, enabled: e.target.checked },
                    });
                  }}
                  style={{ accentColor: '#ff3366' }}
                />
                <span style={{ color: '#ff3366', fontWeight: 600 }}>Hitbox (Attack)</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Grid (Cols x Rows) */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Grid (Cols × Rows)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0 10px',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Cols:</span>
            <input
              type="number"
              min={1}
              max={64}
              value={settings.columns}
              onChange={(e) => handleColsChange(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-bright)',
              }}
            />
          </div>

          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>×</span>

          <div
            style={{
              flex: 1,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '0 10px',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>Rows:</span>
            <input
              type="number"
              min={1}
              max={64}
              value={settings.rows}
              onChange={(e) => update('rows', Math.max(1, Number(e.target.value)))}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-bright)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Frames Count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Frames Count:</span>
        <input
          type="number"
          min={1}
          max={512}
          value={settings.framesCount}
          onChange={(e) => handleFramesChange(Number(e.target.value))}
          style={{
            width: 60,
            height: 30,
            textAlign: 'center',
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
};
