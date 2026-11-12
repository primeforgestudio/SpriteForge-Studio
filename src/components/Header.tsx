import React, { useRef } from 'react';
import { AppMode, BackgroundMode } from '../core/types';
import { UploadCloud, Settings as SettingsIcon, Undo2, Redo2, Heart, FolderOpen, Save, FolderKanban } from 'lucide-react';

interface HeaderProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  onLoadFiles: (files: FileList) => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenSupport?: () => void;
  bgMode: BackgroundMode;
  setBgMode: (mode: BackgroundMode) => void;
  bgColor: [number, number, number];
  setBgColor: (color: [number, number, number]) => void;
  bgPresets: [number, number, number][];
  isExporting: boolean;
  hasMedia: boolean;
  activeFilename: string;
  fps: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onOpenLibrary?: () => void;
  projectName?: string;
  isSavingProject?: boolean;
}

const HeaderComponent: React.FC<HeaderProps> = ({
  onLoadFiles,
  onOpenSettings,
  onOpenSupport,
  activeFilename,
  fps,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenProject,
  onSaveProject,
  onOpenLibrary,
  projectName,
  isSavingProject = false,
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
        {/* New Official Brand Logo & Studio Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img
            src="/logo.png"
            alt="SpriteForge"
            style={{
              height: 22,
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              background: 'rgba(255, 92, 38, 0.12)',
              color: 'var(--accent-orange)',
              border: '1px solid rgba(255, 92, 38, 0.3)',
              padding: '1px 5px',
              borderRadius: 4,
              letterSpacing: '0.6px',
            }}
          >
            STUDIO
          </span>
        </div>

        {/* Undo / Redo Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--bg-card)',
            padding: '2px 4px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            marginLeft: 4,
          }}
        >
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              opacity: canUndo ? 1 : 0.35,
              cursor: canUndo ? 'pointer' : 'default',
              color: canUndo ? 'var(--text-bright)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
            }}
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              opacity: canRedo ? 1 : 0.35,
              cursor: canRedo ? 'pointer' : 'default',
              color: canRedo ? 'var(--text-bright)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
            }}
          >
            <Redo2 size={13} />
          </button>
        </div>

        {/* Project Actions: Open & Save (.sfproj) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--bg-card)',
            padding: '2px 3px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            marginLeft: 2,
          }}
        >
          {onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              title="Character & Actions Library"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 7px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-bright)',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <FolderKanban size={13} style={{ color: '#10B981' }} />
              <span>Library</span>
            </button>
          )}

          {onOpenProject && (
            <button
              onClick={onOpenProject}
              title="Open Project (Ctrl+O)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 7px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-bright)',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <FolderOpen size={13} style={{ color: '#FF551F' }} />
              <span>Open</span>
            </button>
          )}

          {onSaveProject && (
            <button
              onClick={onSaveProject}
              disabled={isSavingProject}
              title="Save Project (Ctrl+S)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 700,
                color: '#ffffff',
                background: '#FF551F',
                border: 'none',
                borderRadius: 4,
                cursor: isSavingProject ? 'wait' : 'pointer',
                opacity: isSavingProject ? 0.7 : 1,
                boxShadow: '0 1px 4px rgba(255, 85, 31, 0.4)',
              }}
            >
              <Save size={12} />
              <span>{isSavingProject ? 'Saving...' : 'Save'}</span>
            </button>
          )}
        </div>

        {/* Active Project File Name Badge */}
        {projectName && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(255, 85, 31, 0.08)',
              border: '1px solid rgba(255, 85, 31, 0.25)',
              padding: '2px 8px',
              borderRadius: 5,
              fontSize: 10,
              fontWeight: 700,
              color: '#FF551F',
              fontFamily: 'monospace',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`Active Project File: ${projectName}`}
          >
            <span>{projectName}</span>
          </div>
        )}
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

      {/* Right: Support, Settings & Load Media */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="video/*,image/*"
          style={{ display: 'none' }}
        />

        {/* Support Project Button */}
        {onOpenSupport && (
          <button
            onClick={onOpenSupport}
            title="Support SpriteForge Studio"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              background: 'rgba(255, 92, 38, 0.12)',
              border: '1px solid rgba(255, 92, 38, 0.35)',
              color: 'var(--accent-orange)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Heart size={13} fill="currentColor" />
            <span>Support</span>
          </button>
        )}

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
