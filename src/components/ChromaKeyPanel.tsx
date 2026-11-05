import React, { useState } from 'react';
import { ChromaKeySettings } from '../core/types';
import { Pipette, Wand2, Sparkles, Bookmark, Plus, Trash2, Check, ShieldCheck } from 'lucide-react';

interface ChromaKeyPanelProps {
  settings: ChromaKeySettings;
  onChange: (settings: ChromaKeySettings) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  eyedropperTarget?: 'primary' | 'secondary';
  setEyedropperTarget?: (target: 'primary' | 'secondary') => void;
  onAutoDetectKey?: () => void;
}

const ChromaKeyPanelComponent: React.FC<ChromaKeyPanelProps> = ({
  settings,
  onChange,
  isEyedropperActive,
  setIsEyedropperActive,
  eyedropperTarget = 'primary',
  setEyedropperTarget,
  onAutoDetectKey,
}) => {
  const [customPresets, setCustomPresets] = useState<
    Array<{ id: string; name: string; settings: Partial<ChromaKeySettings> }>
  >(() => {
    try {
      const saved = localStorage.getItem('spriteforge_custom_chroma_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const studioPresets = [
    {
      id: 'bright_green',
      name: 'Bright Green',
      icon: '🟢',
      settings: {
        keyColor: [0, 236, 23] as [number, number, number],
        gain: 45,
        clipBlack: 5,
        clipWhite: 95,
        screenBalance: 50,
        despill: true,
        despillAmount: 100,
        despillWarmSafe: true,
        khakiSuppress: 0,
        defringe: true,
        defringeRadius: 2,
        defringeStrength: 85,
        erodePx: 0.2,
        blurPx: 0.5,
      },
    },
    {
      id: 'dark_shadowed',
      name: 'Shadowed',
      icon: '🌲',
      settings: {
        keyColor: [27, 78, 43] as [number, number, number],
        gain: 62,
        clipBlack: 12,
        clipWhite: 88,
        screenBalance: 55,
        despill: true,
        despillAmount: 100,
        despillWarmSafe: true,
        khakiSuppress: 35,
        defringe: true,
        defringeRadius: 2,
        defringeStrength: 90,
        erodePx: 0.3,
        blurPx: 0.6,
      },
    },
    {
      id: 'blue_screen',
      name: 'Blue Screen',
      icon: '🔵',
      settings: {
        keyColor: [0, 75, 222] as [number, number, number],
        gain: 48,
        clipBlack: 5,
        clipWhite: 95,
        screenBalance: 50,
        despill: true,
        despillAmount: 100,
        despillWarmSafe: false,
        khakiSuppress: 0,
        defringe: true,
        defringeRadius: 2,
        defringeStrength: 85,
        erodePx: 0.2,
        blurPx: 0.5,
      },
    },
    {
      id: 'fine_hair',
      name: 'Fine Hair',
      icon: '✂️',
      settings: {
        gain: 38,
        clipBlack: 2,
        clipWhite: 98,
        screenBalance: 50,
        despill: true,
        despillAmount: 100,
        despillWarmSafe: true,
        khakiSuppress: 15,
        defringe: true,
        defringeRadius: 3,
        defringeStrength: 95,
        erodePx: 0,
        blurPx: 0.8,
      },
    },
  ];

  const handleApplyPreset = (presetId: string, partial: Partial<ChromaKeySettings>) => {
    onChange({
      ...settings,
      ...partial,
      enabled: true,
    });
    setActivePresetId(presetId);
  };

  const handleSaveCustomPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      settings: {
        keyColor: settings.keyColor,
        gain: settings.gain,
        soften: settings.soften,
        clip: settings.clip,
        clipBlack: settings.clipBlack,
        clipWhite: settings.clipWhite,
        screenBalance: settings.screenBalance,
        despill: settings.despill,
        despillAmount: settings.despillAmount,
        despillWarmSafe: settings.despillWarmSafe,
        khakiSuppress: settings.khakiSuppress,
        secondaryKey: settings.secondaryKey,
        defringe: settings.defringe,
        defringeRadius: settings.defringeRadius,
        defringeStrength: settings.defringeStrength,
        erodePx: settings.erodePx,
        blurPx: settings.blurPx,
      },
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem('spriteforge_custom_chroma_presets', JSON.stringify(updated));
    } catch {}
    setActivePresetId(newPreset.id);
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem('spriteforge_custom_chroma_presets', JSON.stringify(updated));
    } catch {}
    if (activePresetId === id) setActivePresetId(null);
  };

  const update = <K extends keyof ChromaKeySettings>(key: K, value: ChromaKeySettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const renderBadge = (value: string | number) => (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 5,
        padding: '2px 8px',
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        color: 'var(--text-bright)',
        minWidth: 44,
        textAlign: 'center',
      }}
    >
      {value}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section Header */}
      <div className="sidebar-section-title">Chroma Key</div>

      {/* Chroma Studio & Custom Presets */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          background: 'var(--bg-card)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Bookmark size={12} color="#FF551F" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>
              Chroma Presets
            </span>
          </div>

          <button
            onClick={() => setIsSavingPreset(!isSavingPreset)}
            style={{
              background: isSavingPreset ? '#2B2D37' : 'transparent',
              border: isSavingPreset ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
              color: isSavingPreset ? '#FF551F' : 'var(--text-muted)',
              borderRadius: 4,
              fontSize: 10,
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="Save current sliders as custom preset"
          >
            <Plus size={10} />
            <span>Save</span>
          </button>
        </div>

        {/* Built-in Studio Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {studioPresets.map((p) => {
            const isActive = activePresetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id, p.settings)}
                style={{
                  height: 26,
                  padding: 0,
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 4,
                  background: isActive ? '#2B2D37' : 'var(--bg-input)',
                  border: isActive ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                  color: isActive ? '#FF551F' : 'var(--text-bright)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  transition: 'all 0.15s ease',
                }}
                title={p.name}
              >
                <span>{p.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Save Preset Input Row */}
        {isSavingPreset && (
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name (e.g. Studio Red)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCustomPreset();
              }}
              style={{
                flex: 1,
                height: 24,
                fontSize: 10,
                background: 'var(--bg-input)',
                border: '1px solid #FF551F',
                borderRadius: 4,
                padding: '0 6px',
                color: 'var(--text-bright)',
                outline: 'none',
              }}
              autoFocus
            />
            <button
              onClick={handleSaveCustomPreset}
              disabled={!newPresetName.trim()}
              style={{
                height: 24,
                padding: '0 8px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                background: 'var(--accent-orange)',
                border: 'none',
                color: '#fff',
                cursor: newPresetName.trim() ? 'pointer' : 'not-allowed',
                opacity: newPresetName.trim() ? 1 : 0.5,
              }}
            >
              OK
            </button>
          </div>
        )}

        {/* Custom Saved Presets list if any */}
        {customPresets.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {customPresets.map((cp) => {
              const isActive = activePresetId === cp.id;
              return (
                <div
                  key={cp.id}
                  onClick={() => handleApplyPreset(cp.id, cp.settings)}
                  style={{
                    height: 22,
                    padding: '0 6px',
                    fontSize: 10,
                    borderRadius: 4,
                    background: isActive ? '#2B2D37' : 'var(--bg-input)',
                    border: isActive ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                    color: isActive ? '#FF551F' : 'var(--text-bright)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>★ {cp.name}</span>
                  <button
                    onClick={(e) => handleDeleteCustomPreset(cp.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Delete preset"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Key Color & Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'var(--bg-card)',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Color swatch with hidden color picker input */}
          <label
            style={{
              position: 'relative',
              width: 26,
              height: 26,
              borderRadius: 6,
              backgroundColor: `rgb(${settings.keyColor[0]}, ${settings.keyColor[1]}, ${settings.keyColor[2]})`,
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'inline-block',
              boxShadow: 'none',
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
          {/* Eyedropper toggle - High contrast white icon inside sleek dark button */}
          <button
            type="button"
            onClick={() => {
              if (isEyedropperActive && eyedropperTarget === 'primary') {
                setIsEyedropperActive(false);
              } else {
                setEyedropperTarget?.('primary');
                setIsEyedropperActive(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 30,
              borderRadius: 6,
              background: isEyedropperActive && eyedropperTarget === 'primary' ? 'rgba(255, 92, 38, 0.2)' : 'var(--bg-input)',
              border: isEyedropperActive && eyedropperTarget === 'primary' ? '1.5px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              color: isEyedropperActive && eyedropperTarget === 'primary' ? 'var(--accent-orange)' : '#ffffff',
              cursor: 'pointer',
              padding: 0,
              boxShadow: 'none',
              transition: 'all 0.15s ease',
            }}
            title="Pick primary screen color from viewport with eyedropper"
          >
            <Pipette
              size={16}
              strokeWidth={2.4}
              color={isEyedropperActive && eyedropperTarget === 'primary' ? 'var(--accent-orange)' : '#ffffff'}
            />
          </button>

          {/* Auto Border Key Button */}
          {onAutoDetectKey && (
            <button
              type="button"
              onClick={onAutoDetectKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-orange)',
                cursor: 'pointer',
                boxShadow: 'none',
              }}
              title="Automatically detect chroma key color from video edges"
            >
              <Wand2 size={13} color="var(--accent-orange)" />
              Auto Key
            </button>
          )}
        </div>
      </div>

      {/* SECONDARY / SHADOW KEY (For Dark Crevices, Gaps & Crumbling Holes) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'var(--bg-card)',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>
              Secondary / Shadow Key
            </span>
            <span
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'rgba(255, 85, 31, 0.15)',
                color: '#FF551F',
                fontWeight: 600,
              }}
            >
              Holes & Gaps
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
            <input
              type="checkbox"
              checked={settings.secondaryKey?.enabled ?? false}
              onChange={(e) => {
                update('secondaryKey', {
                  enabled: e.target.checked,
                  color: settings.secondaryKey?.color ?? [27, 78, 43],
                  gain: settings.secondaryKey?.gain ?? 100,
                });
              }}
              style={{ accentColor: 'var(--accent-orange)' }}
            />
            <span style={{ color: settings.secondaryKey?.enabled ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
              Enable
            </span>
          </label>
        </div>

        {settings.secondaryKey?.enabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label
                  style={{
                    position: 'relative',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    backgroundColor: `rgb(${settings.secondaryKey.color[0]}, ${settings.secondaryKey.color[1]}, ${settings.secondaryKey.color[2]})`,
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                  title="Pick secondary key color"
                >
                  <input
                    type="color"
                    value={`#${settings.secondaryKey.color.map((x) => x.toString(16).padStart(2, '0')).join('')}`}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16);
                      const g = parseInt(hex.slice(3, 5), 16);
                      const b = parseInt(hex.slice(5, 7), 16);
                      update('secondaryKey', {
                        ...settings.secondaryKey!,
                        color: [r, g, b],
                      });
                    }}
                    style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </label>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    RGB({settings.secondaryKey.color.join(', ')})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isEyedropperActive && eyedropperTarget === 'secondary') {
                    setIsEyedropperActive(false);
                  } else {
                    setEyedropperTarget?.('secondary');
                    setIsEyedropperActive(true);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  background: isEyedropperActive && eyedropperTarget === 'secondary' ? 'rgba(255, 92, 38, 0.2)' : 'var(--bg-input)',
                  border: isEyedropperActive && eyedropperTarget === 'secondary' ? '1.5px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  color: isEyedropperActive && eyedropperTarget === 'secondary' ? 'var(--accent-orange)' : 'var(--text-bright)',
                  cursor: 'pointer',
                }}
                title="Pick shadow/dirty green from holes in viewport"
              >
                <Pipette size={12} color={isEyedropperActive && eyedropperTarget === 'secondary' ? 'var(--accent-orange)' : '#ffffff'} />
                <span>Pick Hole</span>
              </button>
            </div>

            {/* Secondary Gain */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Shadow Tolerance</span>
                {renderBadge(`${settings.secondaryKey.gain}%`)}
              </div>
              <input
                type="range"
                min={10}
                max={200}
                value={settings.secondaryKey.gain}
                onChange={(e) => {
                  update('secondaryKey', {
                    ...settings.secondaryKey!,
                    gain: Number(e.target.value),
                  });
                }}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* KEYLIGHT CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Screen Gain */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Screen Gain</span>
            {renderBadge(`${settings.gain}%`)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Screen Balance</span>
            {renderBadge(`${settings.screenBalance}%`)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clip Black</span>
            {renderBadge(settings.clipBlack)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Clip White</span>
            {renderBadge(settings.clipWhite)}
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
              style={{ accentColor: 'var(--accent-orange)', width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 500 }}>
              Despill (Remove Green Fringe)
            </span>
          </label>
        </div>

        {/* Despill Amount */}
        {settings.despill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Despill Amt</span>
                {renderBadge(`${settings.despillAmount}%`)}
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

            {/* Warm / Red Cloth Safe Despill Protection */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                cursor: 'pointer',
                background: '#121316',
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <input
                type="checkbox"
                checked={settings.despillWarmSafe !== false}
                onChange={(e) => update('despillWarmSafe', e.target.checked)}
                style={{ accentColor: 'var(--accent-orange)', width: 14, height: 14, marginTop: 2 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: 500 }}>
                  Warm & Red Cloth Protection
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: '1.25' }}>
                  Prevents khaki/olive tint on red clothes, hair, skin, and fire
                </span>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* MATTE REFINEMENT */}
      <div style={{ marginTop: 8 }}>
        <div className="sidebar-section-title">Matte Refinement</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Khaki & Hole Suppressor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Khaki & Hole Suppress</span>
              {renderBadge(`${settings.khakiSuppress ?? 0}%`)}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.khakiSuppress ?? 0}
              onChange={(e) => update('khakiSuppress', Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3 }}>
              Eliminates dirty yellow-green gaps and white clouds in crumbling animations.
            </div>
          </div>

          {/* Softness */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Softness</span>
              {renderBadge(settings.soften)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Erode (px)</span>
              {renderBadge(settings.erodePx.toFixed(1))}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Blur (px)</span>
              {renderBadge(settings.blurPx.toFixed(1))}
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
            <Sparkles size={12} color="var(--accent-orange)" />
            <span>Smart Defringe (CorridorKey)</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, textTransform: 'none' }}>
            <input
              type="checkbox"
              checked={settings.defringe ?? true}
              onChange={(e) => update('defringe', e.target.checked)}
              style={{ accentColor: 'var(--accent-orange)' }}
            />
            <span style={{ color: settings.defringe ?? true ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
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
              background: '#121316',
              border: 'none',
              borderRadius: 6,
              padding: 10,
            }}
          >
            {/* Radius Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Search Radius</span>
                {renderBadge(`${settings.defringeRadius ?? 2} px`)}
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={settings.defringeRadius ?? 2}
                onChange={(e) => update('defringeRadius', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Strength Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bleed Strength</span>
                {renderBadge(`${settings.defringeStrength ?? 85}%`)}
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={settings.defringeStrength ?? 85}
                onChange={(e) => update('defringeStrength', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: '1.3' }}>
              Reconstructs edge color from inner body pixels, removing green fringe on hair & weapons without eroding geometry.
            </div>
          </div>
        )}
      </div>

      {/* TOPOLOGICAL BORDER CLEAN (BFS FLOOD-FILL NOISE ELIMINATOR) */}
      <div style={{ marginTop: 8 }}>
        <div
          className="sidebar-section-title"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheck size={12} color="var(--accent-orange)" />
            <span>Topological Border Clean</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, textTransform: 'none' }}>
            <input
              type="checkbox"
              checked={settings.enableBorderClean ?? true}
              onChange={(e) => update('enableBorderClean', e.target.checked)}
              style={{ accentColor: 'var(--accent-orange)' }}
            />
            <span style={{ color: settings.enableBorderClean ?? true ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
              Enable
            </span>
          </label>
        </div>

        {(settings.enableBorderClean ?? true) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#121316',
              border: 'none',
              borderRadius: 6,
              padding: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alpha Noise Threshold</span>
                {renderBadge(`${settings.borderCleanThreshold ?? 45}`)}
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={settings.borderCleanThreshold ?? 45}
                onChange={(e) => update('borderCleanThreshold', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: '1.3' }}>
              Floods outer borders inward to wipe out floating green speckles and compression halo blocks without touching enclosed character holes.
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
              style={{ accentColor: 'var(--accent-orange)' }}
            />
            <span style={{ color: settings.garbageMatte?.enabled ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
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
              background: '#121316',
              border: 'none',
              borderRadius: 6,
              padding: 10,
            }}
          >
            {/* Feather */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Edge Feather</span>
                {renderBadge(`${settings.garbageMatte.feather} px`)}
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
                style={{ width: '100%' }}
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
                style={{ accentColor: 'var(--accent-orange)' }}
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
                type="button"
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
                  height: 26,
                  fontSize: 10,
                  borderRadius: 4,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                }}
                title="Reset bounds to 100% full frame"
              >
                Full Frame
              </button>
              <button
                type="button"
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
                  height: 26,
                  fontSize: 10,
                  borderRadius: 4,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
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

export const ChromaKeyPanel = React.memo(ChromaKeyPanelComponent);
