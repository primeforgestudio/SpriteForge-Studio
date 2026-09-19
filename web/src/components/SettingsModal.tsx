import React, { useRef } from 'react';
import { SavedSettingsState, StorageManager } from '../core/storage';
import { Download, Upload, RotateCcw, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SavedSettingsState;
  onUpdateSettings: (newSettings: SavedSettingsState) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const json = StorageManager.exportSettingsJson(settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const updated = StorageManager.parseSettingsJson(text, settings);
        onUpdateSettings(updated);
        alert('Settings imported successfully!');
      } catch (err) {
        alert('Failed to parse settings JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>
            Application Settings & Presets
          </span>
          <button onClick={onClose} style={{ padding: '2px 5px' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Settings are automatically saved in your browser (localStorage). You can also export and import them as <b>settings.json</b> (fully compatible with SpriteForge Studio desktop presets).
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExportJson} className="blue" style={{ flex: 1, padding: '8px' }}>
              <Download size={13} />
              Export JSON
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJson}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, padding: '8px' }}
            >
              <Upload size={13} />
              Import JSON
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <button
              onClick={() => {
                if (confirm('Reset all settings to default values?')) {
                  onResetSettings();
                  onClose();
                }
              }}
              style={{ width: '100%', color: 'var(--text-danger)', borderColor: '#552222' }}
            >
              <RotateCcw size={12} />
              Reset All Settings to Factory Defaults
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="primary" style={{ padding: '5px 14px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
