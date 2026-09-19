import React from 'react';
import { ChromaKeySettings } from '../core/types';
import { Pipette, Wand2, Sparkles } from 'lucide-react';

interface ChromaKeyPanelProps {
  settings: ChromaKeySettings;
  onChange: (settings: ChromaKeySettings) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  onAutoDetectKey?: () => void;
}

export const ChromaKeyPanel: React.FC<ChromaKeyPanelProps> = ({
  settings,
  onChange,
  isEyedropperActive,
  setIsEyedropperActive,
  onAutoDetectKey,
}) => {
  const update = <K extends keyof ChromaKeySettings>(key: K, value: ChromaKeySettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section Header */}
      <div className="sidebar-section-title">Chroma Key</div>

      {/* Key Color & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--bg-card)',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Color swatch with hidden color picker input */}
          <label
            style={{
              position: 'relative',
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: `rgb(${settings.keyColor[0]}, ${settings.keyColor[1]}, ${settings.keyColor[2]})`,
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'inline-block',
              boxShadow: '0 0 8px rgba(0,0,0,0.5)',
            }}
            title="Click to choose custom key color"
          >
            <input
              type="color"
              value={`#${settings.keyColor.map((x) => x.toString(16).padStart(2, '0')).join('')}`}
              onChange={(e) => {
                const hex = e.target.value;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                update('keyColor', [r, g, b]);
              }}
              style={{
                opacity: 0,
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
              }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>
              Screen Color
            </span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
              RGB({settings.keyColor.join(', ')})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Eyedropper toggle */}
          <button
            onClick={() => setIsEyedropperActive(!isEyedropperActive)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              background: isEyedropperActive ? '#1c3d2e' : 'var(--bg-input)',
              border: isEyedropperActive ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
              color: isEyedropperActive ? 'var(--accent-green)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
            title="Pick screen color from viewport with eyedropper"
          >
            <Pipette size={13} />
          </button>

          {/* Auto Border Key Button */}
          {onAutoDetectKey && (
            <button
              onClick={onAutoDetectKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                background: '#0e241b',
                border: '1px solid #1a4d35',
                color: 'var(--accent-green)',
                cursor: 'pointer',
              }}
              title="Automatically detect chroma key color from video edges"
            >
              <Wand2 size={12} />
              Auto Key
            </button>
          )}
        </div>
      </div>

      {/* KEYLIGHT CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Screen Gain */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Screen Gain</span>
            <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
              {settings.gain}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={200}
            value={settings.gain}
            onChange={(e) => update('gain', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Screen Balance */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Screen Balance</span>
            <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
              {settings.screenBalance}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.screenBalance}
            onChange={(e) => update('screenBalance', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Clip Black */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clip Black</span>
            <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
              {settings.clipBlack}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            value={settings.clipBlack}
            onChange={(e) => update('clipBlack', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Clip White */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clip White</span>
            <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
              {settings.clipWhite}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={settings.clipWhite}
            onChange={(e) => update('clipWhite', Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Despill Checkbox */}
        <div style={{ marginTop: 4, padding: '4px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.despill}
              onChange={(e) => update('despill', e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)', width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 500 }}>
              Despil (Remove Green Fringe)
            </span>
          </label>
        </div>

        {/* Despill Amount */}
        {settings.despill && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Despill Amt</span>
              <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.despillAmount}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.despillAmount}
              onChange={(e) => update('despillAmount', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* MATTE REFINEMENT */}
      <div style={{ marginTop: 8 }}>
        <div className="sidebar-section-title">Matte Refinement</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Softness */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Softness</span>
              <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.soften}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.soften}
              onChange={(e) => update('soften', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Erode (px) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Erode (px)</span>
              <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.erodePx.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={settings.erodePx}
              onChange={(e) => update('erodePx', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Blur (px) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Blur (px)</span>
              <span style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace', fontWeight: 600 }}>
                {settings.blurPx.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={settings.blurPx}
              onChange={(e) => update('blurPx', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* SMART DEFRINGE / COLOR RECONSTRUCTION (CorridorKey method) */}
      <div style={{ marginTop: 8 }}>
        <div
          className="sidebar-section-title"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={11} color="var(--accent-cyan)" />
            <span>Smart Defringe (CorridorKey)</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, textTransform: 'none' }}>
            <input
              type="checkbox"
              checked={settings.defringe ?? true}
              onChange={(e) => update('defringe', e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ color: settings.defringe ?? true ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
              Enable
            </span>
          </label>
        </div>

        {(settings.defringe ?? true) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'rgba(0, 229, 255, 0.04)',
              border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: 6,
              padding: 10,
            }}
          >
            {/* Radius Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Search Radius (px)</span>
                <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 600 }}>
                  {settings.defringeRadius ?? 2} px
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={settings.defringeRadius ?? 2}
                onChange={(e) => update('defringeRadius', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            {/* Strength Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bleed Strength</span>
                <span style={{ fontSize: 11, color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 600 }}>
                  {settings.defringeStrength ?? 85}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={settings.defringeStrength ?? 85}
                onChange={(e) => update('defringeStrength', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: '1.3' }}>
              Reconstructs edge color from inner body pixels, removing green fringe on hair & weapons without eroding geometry.
            </div>
          </div>
        )}
      </div>

      {/* GARBAGE MATTE / BOUNDING CUTOUT */}
      <div style={{ marginTop: 8 }}>
        <div
          className="sidebar-section-title"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>Garbage Matte (Cutout)</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, textTransform: 'none' }}>
            <input
              type="checkbox"
              checked={settings.garbageMatte?.enabled ?? false}
              onChange={(e) => {
                const cur = settings.garbageMatte ?? {
                  enabled: false,
                  x: 0.05,
                  y: 0.05,
                  width: 0.9,
                  height: 0.9,
                  feather: 2,
                  invert: false,
                };
                update('garbageMatte', { ...cur, enabled: e.target.checked });
              }}
              style={{ accentColor: 'var(--accent-green)' }}
            />
            <span style={{ color: settings.garbageMatte?.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }}>
              Enable
            </span>
          </label>
        </div>

        {settings.garbageMatte?.enabled && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 6,
              padding: 10,
            }}
          >
            {/* Feather */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Edge Feather</span>
                <span style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'monospace', fontWeight: 600 }}>
                  {settings.garbageMatte.feather} px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={settings.garbageMatte.feather}
                onChange={(e) =>
                  update('garbageMatte', {
                    ...settings.garbageMatte!,
                    feather: Number(e.target.value),
                  })
                }
                style={{ width: '100%', accentColor: '#f59e0b' }}
              />
            </div>

            {/* Invert */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Invert (Cut Hole Inside)</span>
              <input
                type="checkbox"
                checked={settings.garbageMatte.invert ?? false}
                onChange={(e) =>
                  update('garbageMatte', {
                    ...settings.garbageMatte!,
                    invert: e.target.checked,
                  })
                }
                style={{ accentColor: '#f59e0b' }}
              />
            </div>

            {/* Current Bounds Info */}
            <div
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                background: 'var(--bg-input)',
                padding: '4px 6px',
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>X: {Math.round(settings.garbageMatte.x * 100)}%</span>
              <span>Y: {Math.round(settings.garbageMatte.y * 100)}%</span>
              <span>W: {Math.round(settings.garbageMatte.width * 100)}%</span>
              <span>H: {Math.round(settings.garbageMatte.height * 100)}%</span>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() =>
                  update('garbageMatte', {
                    ...settings.garbageMatte!,
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                  })
                }
                style={{
                  flex: 1,
                  height: 24,
                  fontSize: 10,
                  borderRadius: 4,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-normal)',
                  cursor: 'pointer',
                }}
                title="Reset bounds to 100% full frame"
              >
                Full Frame
              </button>
              <button
                onClick={() =>
                  update('garbageMatte', {
                    ...settings.garbageMatte!,
                    x: 0.05,
                    y: 0.05,
                    width: 0.9,
                    height: 0.9,
                  })
                }
                style={{
                  flex: 1,
                  height: 24,
                  fontSize: 10,
                  borderRadius: 4,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-normal)',
                  cursor: 'pointer',
                }}
                title="Fit character with 5% margin"
              >
                Fit 90%
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
