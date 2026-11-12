import React from 'react';
import { AtlasSettings, OutlineSettings } from '../core/types';
import { Anchor, Sparkles, Layers, Crosshair, RefreshCw, Gamepad2, PenTool } from 'lucide-react';

interface AiCleanupPanelProps {
  settings: AtlasSettings;
  onChange: (settings: AtlasSettings) => void;
}

const DEFAULT_OUTLINE: OutlineSettings = {
  enabled: false,
  mode: 'outer',
  thickness: 2,
  color: '#000000',
  opacity: 100,
};

export const AiCleanupPanel: React.FC<AiCleanupPanelProps> = ({ settings, onChange }) => {
  const update = <K extends keyof AtlasSettings>(key: K, value: AtlasSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const outline = settings.outlineSettings ?? DEFAULT_OUTLINE;
  const updateOutline = (patch: Partial<OutlineSettings>) => {
    update('outlineSettings', { ...outline, ...patch });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 0. Sprite Outline / Stroke */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 10px',
          background: 'var(--bg-card)',
          border: outline.enabled ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
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
              checked={outline.enabled}
              onChange={(e) => updateOutline({ enabled: e.target.checked })}
              style={{ accentColor: '#FF551F', cursor: 'pointer' }}
            />
            <PenTool size={13} style={{ color: outline.enabled ? '#FF551F' : 'var(--text-muted)' }} />
            Sprite Outline (Stroke)
          </label>
          <span
            style={{
              fontSize: 9,
              color: outline.enabled ? '#FF551F' : 'var(--text-muted)',
              background: outline.enabled ? '#2B2D37' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            FX
          </span>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Adds a crisp outer or inner contour stroke around keyed character silhouettes in Viewport & Atlas.
        </div>

        {outline.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            {/* Mode Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {(['outer', 'inner', 'both'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateOutline({ mode: m })}
                  style={{
                    height: 24,
                    fontSize: 10,
                    fontWeight: outline.mode === m ? 700 : 500,
                    borderRadius: 4,
                    background: outline.mode === m ? '#2B2D37' : 'var(--bg-input)',
                    border: outline.mode === m ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                    color: outline.mode === m ? '#FF551F' : 'var(--text-muted)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Thickness Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)' }}>Thickness</span>
                <span style={{ color: '#FF551F', fontFamily: 'monospace', fontWeight: 600 }}>
                  {outline.thickness}px
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={outline.thickness}
                onChange={(e) => updateOutline({ thickness: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            {/* Opacity Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: 'var(--text-muted)' }}>Opacity</span>
                <span style={{ color: '#FF551F', fontFamily: 'monospace', fontWeight: 600 }}>
                  {outline.opacity}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={outline.opacity}
                onChange={(e) => updateOutline({ opacity: Number(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            {/* Color Picker + Swatches */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Stroke Color</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {['#000000', '#FFFFFF', '#FF551F', '#F59E0B', '#06B6D4'].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateOutline({ color: hex })}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      background: hex,
                      border: outline.color.toUpperCase() === hex ? '2px solid #FF551F' : '1px solid #444',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title={hex}
                  />
                ))}
                <input
                  type="color"
                  value={outline.color}
                  onChange={(e) => updateOutline({ color: e.target.value })}
                  style={{ width: 22, height: 18, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  title="Custom Outline Color"
                />
              </div>
            </div>
          </div>
        )}
      </div>

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

      {/* 6. Seamless Loop Synthesizer (AI Motion Seam Blending) */}
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
              checked={settings.enableLoopBlend ?? false}
              onChange={(e) => update('enableLoopBlend', e.target.checked)}
              style={{ accentColor: '#A855F7', cursor: 'pointer' }}
            />
            <RefreshCw size={13} style={{ color: settings.enableLoopBlend ? '#A855F7' : 'var(--text-muted)' }} />
            Seamless Loop Blending
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.enableLoopBlend ? '#A855F7' : 'var(--text-muted)',
              background: settings.enableLoopBlend ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Zero-Pop
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Harmonizes and crossfades the ending frames into the start pose to eliminate seams and pops in AI cycles.
        </div>

        {settings.enableLoopBlend && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Blend Transition Frames</span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#A855F7' }}>
                {settings.loopBlendFrames ?? 3} frames
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={settings.loopBlendFrames ?? 3}
              onChange={(e) => update('loopBlendFrames', Number(e.target.value))}
              style={{ width: '100%', accentColor: '#A855F7' }}
            />
          </div>
        )}
      </div>

      {/* 7. Retro Pixel-Art Converter (Pixelize & Palettes) */}
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
              checked={settings.pixelArtSettings?.enabled ?? false}
              onChange={(e) => {
                const cur = settings.pixelArtSettings ?? {
                  enabled: false,
                  targetResolution: 64,
                  palette: 'pico8',
                  dither: true,
                  outline: true,
                };
                update('pixelArtSettings', { ...cur, enabled: e.target.checked });
              }}
              style={{ accentColor: '#10B981', cursor: 'pointer' }}
            />
            <Gamepad2 size={13} style={{ color: settings.pixelArtSettings?.enabled ? '#10B981' : 'var(--text-muted)' }} />
            Retro Pixel-Art Converter
          </label>
          <span
            style={{
              fontSize: 9,
              color: settings.pixelArtSettings?.enabled ? '#10B981' : 'var(--text-muted)',
              background: settings.pixelArtSettings?.enabled ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Retro
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
          Converts AI video frames into crisp, quantized retro pixel-art sprites with classic console palettes.
        </div>

        {settings.pixelArtSettings?.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
            {/* Resolution Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Target Pixel Resolution</span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#10B981' }}>
                  {settings.pixelArtSettings.targetResolution || 64}px
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                {[32, 48, 64, 96, 128].map((res) => {
                  const isActive = (settings.pixelArtSettings?.targetResolution ?? 64) === res;
                  return (
                    <button
                      key={res}
                      onClick={() =>
                        update('pixelArtSettings', {
                          ...settings.pixelArtSettings!,
                          targetResolution: res,
                        })
                      }
                      style={{
                        height: 24,
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: 4,
                        background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)',
                        border: isActive ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                        color: isActive ? '#10B981' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {res}px
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Retro Palette Dropdown */}
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Color Palette
              </span>
              <select
                value={settings.pixelArtSettings.palette || 'pico8'}
                onChange={(e) =>
                  update('pixelArtSettings', {
                    ...settings.pixelArtSettings!,
                    palette: e.target.value as any,
                  })
                }
                style={{
                  width: '100%',
                  height: 26,
                  fontSize: 10,
                  borderRadius: 4,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-bright)',
                  padding: '0 6px',
                  cursor: 'pointer',
                }}
              >
                <option value="none">Original Colors (Quantized)</option>
                <option value="pico8">PICO-8 (16 Colors)</option>
                <option value="gameboy">Nintendo Game Boy (4 Greens)</option>
                <option value="db32">DawnBringer 32 (DB32 Classic)</option>
                <option value="endesga32">Endesga 32 (EDG32 Vibrant)</option>
              </select>
            </div>

            {/* Dither & Outline Toggles */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10, color: 'var(--text-bright)' }}>
                <input
                  type="checkbox"
                  checked={settings.pixelArtSettings.dither !== false}
                  onChange={(e) =>
                    update('pixelArtSettings', {
                      ...settings.pixelArtSettings!,
                      dither: e.target.checked,
                    })
                  }
                  style={{ accentColor: '#10B981' }}
                />
                <span>Bayer Dithering</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 10, color: 'var(--text-bright)' }}>
                <input
                  type="checkbox"
                  checked={settings.pixelArtSettings.outline !== false}
                  onChange={(e) =>
                    update('pixelArtSettings', {
                      ...settings.pixelArtSettings!,
                      outline: e.target.checked,
                    })
                  }
                  style={{ accentColor: '#10B981' }}
                />
                <span>1px Outline</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
