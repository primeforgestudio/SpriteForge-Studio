import React from 'react';
import { SpritesSettings, SpriteTransform } from '../core/types';
import { RotateCcw } from 'lucide-react';

interface SpritesPanelProps {
  settings: SpritesSettings;
  onChangeSettings: (settings: SpritesSettings) => void;
  currentTransform: SpriteTransform;
  onChangeTransform: (transform: SpriteTransform) => void;
  spritesCount: number;
  currentIndex: number;
  onSelectSprite: (index: number) => void;
}

export const SpritesPanel: React.FC<SpritesPanelProps> = ({
  settings,
  onChangeSettings,
  currentTransform,
  onChangeTransform,
  spritesCount,
  currentIndex,
  onSelectSprite,
}) => {
  const updateSettings = <K extends keyof SpritesSettings>(key: K, value: SpritesSettings[K]) => {
    onChangeSettings({ ...settings, [key]: value });
  };

  const updateTransform = <K extends keyof SpriteTransform>(key: K, value: SpriteTransform[K]) => {
    onChangeTransform({ ...currentTransform, [key]: value });
  };

  const resetTransform = () => {
    onChangeTransform({ scale: 1.0, offsetX: 0, offsetY: 0 });
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return res ? [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)] : [0, 0, 0];
  };

  return (
    <div className="panel-section">
      <div className="section-title">
        <span>Sprites Transform</span>
        <button onClick={resetTransform} title="Reset Transform" style={{ fontSize: 10, padding: '2px 5px' }}>
          <RotateCcw size={10} />
        </button>
      </div>

      {/* Sprite Navigation if multiple loaded */}
      {spritesCount > 1 && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Active: <b>{currentIndex + 1}</b> / {spritesCount}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onSelectSprite(Math.max(0, currentIndex - 1))}
              disabled={currentIndex <= 0}
              style={{ padding: '2px 6px' }}
            >
              Prev
            </button>
            <button
              onClick={() => onSelectSprite(Math.min(spritesCount - 1, currentIndex + 1))}
              disabled={currentIndex >= spritesCount - 1}
              style={{ padding: '2px 6px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Target Size */}
      <div className="control-row">
        <span className="control-label" style={{ fontSize: 11 }}>Target Size:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            value={settings.targetWidth}
            onChange={(e) => updateSettings('targetWidth', Math.max(16, Number(e.target.value)))}
            style={{ width: 60, height: 32, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>×</span>
          <input
            type="number"
            value={settings.targetHeight}
            onChange={(e) => updateSettings('targetHeight', Math.max(16, Number(e.target.value)))}
            style={{ width: 60, height: 32, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
          />
        </div>
      </div>

      {/* Apply to all toggle */}
      <div style={{ margin: '8px 0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.applyToAll}
            onChange={(e) => updateSettings('applyToAll', e.target.checked)}
          />
          <span style={{ fontSize: 11, color: 'var(--text-bright)' }}>
            Apply Transform to All Sprites
          </span>
        </label>
      </div>

      {/* Scale */}
      <div className="control-row">
        <span className="control-label">Scale:</span>
        <div className="slider-group">
          <input
            type="range"
            min={0.1}
            max={3.0}
            step={0.05}
            value={currentTransform.scale}
            onChange={(e) => updateTransform('scale', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="slider-value">{currentTransform.scale.toFixed(2)}x</span>
        </div>
      </div>

      {/* Offset X */}
      <div className="control-row">
        <span className="control-label">Offset X:</span>
        <div className="slider-group">
          <input
            type="range"
            min={-300}
            max={300}
            value={currentTransform.offsetX}
            onChange={(e) => updateTransform('offsetX', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="slider-value">{currentTransform.offsetX}px</span>
        </div>
      </div>

      {/* Offset Y */}
      <div className="control-row">
        <span className="control-label">Offset Y:</span>
        <div className="slider-group">
          <input
            type="range"
            min={-300}
            max={300}
            value={currentTransform.offsetY}
            onChange={(e) => updateTransform('offsetY', Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span className="slider-value">{currentTransform.offsetY}px</span>
        </div>
      </div>

      {/* Export Options */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
          Export Settings
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.rename}
              onChange={(e) => updateSettings('rename', e.target.checked)}
            />
            <span style={{ fontSize: 11, color: 'var(--text-bright)' }}>Rename with prefix:</span>
          </label>
        </div>

        {settings.rename && (
          <div className="control-row" style={{ marginBottom: 8 }}>
            <span className="control-label">Prefix:</span>
            <input
              type="text"
              value={settings.prefix}
              onChange={(e) => updateSettings('prefix', e.target.value)}
              style={{ flex: 1 }}
              placeholder="char_"
            />
          </div>
        )}

        <div className="control-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.addBg}
              onChange={(e) => updateSettings('addBg', e.target.checked)}
            />
            <span style={{ fontSize: 11, color: 'var(--text-bright)' }}>Composite Solid BG</span>
          </label>

          {settings.addBg && (
            <input
              type="color"
              value={rgbToHex(settings.bgColor[0], settings.bgColor[1], settings.bgColor[2])}
              onChange={(e) => updateSettings('bgColor', hexToRgb(e.target.value))}
              style={{ width: 24, height: 20, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
