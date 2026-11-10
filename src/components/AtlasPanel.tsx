import React, { useState } from 'react';
import { AtlasSettings, CollisionSettings } from '../core/types';
import { StatePreset } from '../core/boundingCrop';
import { Scissors, RotateCcw, Shield, Wand2, Copy, FileArchive, Compass } from 'lucide-react';

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
  onSliceEightDirections?: () => Promise<void>;
  isSlicing8Dir?: boolean;
}

const AtlasPanelComponent: React.FC<AtlasPanelProps> = ({
  settings,
  onChange,
  onRefreshAtlas,
  statePreset,
  onChangeStatePreset,
  onAutoCrop,
  isAutoCropping,
  onResetCrop,
  onAutoFitFeet,
  onSliceEightDirections,
  isSlicing8Dir = false,
}) => {
  const [showPackTooltip, setShowPackTooltip] = useState(false);

  const update = <K extends keyof AtlasSettings>(key: K, value: AtlasSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleWidthChange = (val: number) => {
    const fw = Math.max(16, val);
    if (settings.cropBox) {
      onChange({
        ...settings,
        frameWidth: fw,
        cropBox: { ...settings.cropBox, width: fw },
      });
    } else {
      update('frameWidth', fw);
    }
  };

  const handleHeightChange = (val: number) => {
    const fh = Math.max(16, val);
    if (settings.cropBox) {
      onChange({
        ...settings,
        frameHeight: fh,
        cropBox: { ...settings.cropBox, height: fh },
      });
    } else {
      update('frameHeight', fh);
    }
  };

  const handleSizePreset = (s: number) => {
    if (settings.cropBox) {
      onChange({
        ...settings,
        frameWidth: s,
        frameHeight: s,
        cropBox: { ...settings.cropBox, width: s, height: s },
      });
    } else {
      onChange({ ...settings, frameWidth: s, frameHeight: s });
    }
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
        <span>Atlas Settings</span>
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

      {/* Layout Mode Switcher (Regular Grid vs Advanced Pack) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Layout Mode
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            {settings.layoutMode === 'advanced' ? 'iGaming / Spine' : 'Uniform Grid'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* Regular Grid Button */}
          <button
            type="button"
            onClick={() => {
              update('layoutMode', 'grid');
              setTimeout(onRefreshAtlas, 10);
            }}
            style={{
              flex: 1,
              height: 30,
              padding: '0 8px',
              fontSize: 11,
              fontWeight: settings.layoutMode !== 'advanced' ? 700 : 500,
              borderRadius: 5,
              background: settings.layoutMode !== 'advanced' ? '#2B2D37' : 'var(--bg-input)',
              border: settings.layoutMode !== 'advanced' ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
              color: settings.layoutMode !== 'advanced' ? '#ffffff' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <span>⊞ Regular Grid</span>
          </button>

          {/* Advanced Pack Button with Hover Tooltip */}
          <div style={{ flex: 1, position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                update('layoutMode', 'advanced');
                setTimeout(onRefreshAtlas, 10);
              }}
              onMouseEnter={() => setShowPackTooltip(true)}
              onMouseLeave={() => setShowPackTooltip(false)}
              style={{
                width: '100%',
                height: 30,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: settings.layoutMode === 'advanced' ? 700 : 500,
                borderRadius: 5,
                background: settings.layoutMode === 'advanced' ? '#2B2D37' : 'var(--bg-input)',
                border: settings.layoutMode === 'advanced' ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                color: settings.layoutMode === 'advanced' ? '#FF551F' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>⚡ Advanced Pack</span>
            </button>

            {/* Hover Explanation Popover */}
            {showPackTooltip && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 270,
                  background: '#121316',
                  border: '1px solid #FF551F',
                  borderRadius: 8,
                  padding: 12,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                  zIndex: 999,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FF551F', fontSize: 11, fontWeight: 700 }}>
                  <span>⚡ Advanced Pack (iGaming / Spine)</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  Профессиональный упаковщик атласов стандарта <b>Spine 2D & libGDX</b>:
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.35, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>• <b>Trim Whitespace:</b> срезает 100% пустых прозрачных пикселей вокруг персонажа.</div>
                  <div>• <b>Tight Bin-Packing:</b> плотно спрессовывает кадры в минимальный квадрат, экономя <b>до 60–70% VRAM</b>.</div>
                  <div>• <b>Spine & Pixi.js:</b> автоматически создаёт файлы <code>.atlas</code> и <code>.json</code> с сохранением точных координат привязки.</div>
                </div>
              </div>
            )}
          </div>
        </div>
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
              onChange={(e) => handleWidthChange(Number(e.target.value))}
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
              onChange={(e) => handleHeightChange(Number(e.target.value))}
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
              onClick={() => handleSizePreset(size)}
              style={{
                flex: 1,
                height: 28,
                padding: 0,
                fontSize: 11,
                borderRadius: 5,
                background: isActive ? '#2B2D37' : 'var(--bg-input)',
                border: isActive ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                color: isActive ? '#FF551F' : 'var(--text-muted)',
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
          border: '1px solid #2D2E37',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scissors size={12} color="#FF551F" />
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
                    background: isSelected ? '#2B2D37' : 'var(--bg-input)',
                    border: isSelected ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                    color: isSelected ? '#FF551F' : 'var(--text-muted)',
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
            background: settings.cropBox ? '#2B2D37' : 'var(--bg-input)',
            border: settings.cropBox ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
            borderRadius: 5,
            color: settings.cropBox ? '#FF551F' : 'var(--text-main)',
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

        {/* 8-Direction Auto-Slice Button */}
        {onSliceEightDirections && (
          <button
            onClick={onSliceEightDirections}
            disabled={isSlicing8Dir}
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, rgba(255, 85, 31, 0.18) 0%, rgba(255, 140, 0, 0.12) 100%)',
              border: '1px solid #FF551F',
              borderRadius: 5,
              color: '#FF551F',
              fontSize: 11,
              fontWeight: 700,
              cursor: isSlicing8Dir ? 'wait' : 'pointer',
              opacity: isSlicing8Dir ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
            title="Auto-detect 8 angles in 3x3 circle layout and split into 8 direction tracks (Front, Left, Back, Right, Diagonals)"
          >
            <Compass size={13} color="#FF551F" />
            {isSlicing8Dir ? 'Detecting & Slicing 8 Angles...' : '🧭 Slice 8-Directions (3×3 Grid)'}
          </button>
        )}
      </div>

      {/* Contact Drop-Shadow */}
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
              checked={settings.enableShadow ?? false}
              onChange={(e) => update('enableShadow', e.target.checked)}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
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
          border: '1px solid #2D2E37',
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
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
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
                  style={{ accentColor: '#FF551F' }}
                />
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>Feet Collider</span>
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
                    background: '#2B2D37',
                    border: '1px solid #2D2E37',
                    color: '#FF551F',
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

      {/* Atlas Optimization (Duplicates & PNG-8) */}
      <div
        style={{
          background: '#121316',
          border: '1px solid #2D2E37',
          borderRadius: 8,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Copy size={13} color="#FF551F" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>
              Atlas Optimization
            </span>
          </div>
          <span
            style={{
              fontSize: 9,
              background: '#2B2D37',
              color: '#00f084',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            VRAM & Disk
          </span>
        </div>

        {/* 1. Eliminate Duplicate Frames */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 5,
            background: settings.eliminateDuplicates ? '#22232A' : 'transparent',
            border: settings.eliminateDuplicates ? '1px solid #2D2E37' : '1px solid transparent',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: settings.eliminateDuplicates ? 'var(--text-bright)' : 'var(--text-muted)' }}>
              ✂️ Eliminate Duplicate Frames
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
              Packs unique frames only (saves up to 40% area)
            </span>
          </div>
          <input
            type="checkbox"
            checked={!!settings.eliminateDuplicates}
            onChange={(e) => {
              update('eliminateDuplicates', e.target.checked);
              setTimeout(onRefreshAtlas, 10);
            }}
            style={{ accentColor: '#FF551F' }}
          />
        </label>

        {/* 2. PNG-8 NeuQuant Compression */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 5,
            background: settings.enablePng8 ? '#22232A' : 'transparent',
            border: settings.enablePng8 ? '1px solid #2D2E37' : '1px solid transparent',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: settings.enablePng8 ? '#00e5ff' : 'var(--text-muted)' }}>
              🗜️ PNG-8 NeuQuant (256 Colors)
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
              60%–80% smaller PNG with alpha transparency
            </span>
          </div>
          <input
            type="checkbox"
            checked={!!settings.enablePng8}
            onChange={(e) => {
              update('enablePng8', e.target.checked);
              setTimeout(onRefreshAtlas, 10);
            }}
            style={{ accentColor: '#00e5ff' }}
          />
        </label>
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

export const AtlasPanel = React.memo(AtlasPanelComponent);
