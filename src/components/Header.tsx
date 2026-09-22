import React, { useRef } from 'react';
import { AppMode, BackgroundMode } from '../core/types';
import { UploadCloud, Settings as SettingsIcon } from 'lucide-react';

interface HeaderProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  onLoadFiles: (files: FileList) => void;
  onExport: () => void;
  onOpenSettings: () => void;
  bgMode: BackgroundMode;
  setBgMode: (mode: BackgroundMode) => void;
  bgColor: [number, number, number];
  setBgColor: (color: [number, number, number]) => void;
  bgPresets: [number, number, number][];
  isExporting: boolean;
  hasMedia: boolean;
  activeFilename: string;
  fps: number;
}

const HeaderComponent: React.FC<HeaderProps> = ({
  onLoadFiles,
  onOpenSettings,
  activeFilename,
  fps,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadFiles(e.target.files);
    }
  };

  return (
    <header className="top-header">
      {/* Left: Brand Logo & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Matte Orange "SF" Logo Badge */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            backgroundColor: 'var(--accent-orange)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'none',
            letterSpacing: '-0.5px',
          }}
        >
          SF
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: 13,
              color: 'var(--text-bright)',
              letterSpacing: '1px',
            }}
          >
            SPRITEFORGE
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: 'rgba(255, 92, 38, 0.12)',
              color: 'var(--accent-orange)',
              border: '1px solid rgba(255, 92, 38, 0.3)',
              padding: '1px 5px',
              borderRadius: 4,
              letterSpacing: '0.5px',
            }}
          >
            STUDIO
          </span>
        </div>
      </div>

      {/* Center: Active Sprite Info Pill */}
      {activeFilename ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-card)',
            padding: '4px 12px',
            borderRadius: 20,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Sprite:</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>
            {activeFilename}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-orange)',
              background: 'rgba(255, 92, 38, 0.12)',
              border: '1px solid rgba(255, 92, 38, 0.3)',
              padding: '1px 6px',
              borderRadius: 10,
            }}
          >
            {fps} FPS
          </span>
        </div>
      ) : (
        <div style={{ width: 10 }} />
      )}

      {/* Right: Load Media & Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="video/*,image/*"
          style={{ display: 'none' }}
        />

        <button onClick={onOpenSettings} title="Settings" style={{ padding: '6px' }}>
          <SettingsIcon size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        <button onClick={() => fileInputRef.current?.click()} className="btn-mint">
          <UploadCloud size={14} />
          Load media
        </button>
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderComponent);
