import React, { useState, useRef } from 'react';
import { AppMode, ChromaKeySettings, AtlasSettings, AnimationTrack, ExportScope } from '../core/types';
import {
  Layers,
  Crop,
  Film,
  Sparkles,
  Plus,
  Wand2,
  Repeat,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';
import { ChromaKeyPanel } from './ChromaKeyPanel';
import { AiCleanupPanel } from './AiCleanupPanel';

export interface LoadedFileItem {
  id: string;
  name: string;
  framesCount: number;
  sizeStr: string;
  thumbnailUrl?: string;
  fileRef?: File;
}

type LeftSidebarTab = 'media' | 'keylight' | 'cleanup';

interface LeftSidebarProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  // Multi-Track State
  tracks: AnimationTrack[];
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
  onUpdateTrack: (track: AnimationTrack) => void;
  onToggleTrackEnabled: (id: string) => void;
  onMoveTrack: (id: string, dir: 'up' | 'down') => void;
  onAddFiles: (files: FileList) => void;
  exportScope: ExportScope;
  setExportScope: (scope: ExportScope) => void;
  spritesCount: number;
  // Keying Props
  keyingSettings: ChromaKeySettings;
  onChangeKeying: (settings: ChromaKeySettings) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  onAutoDetectKey: () => Promise<void>;
  // AI Cleanup Props
  atlasSettings: AtlasSettings;
  onChangeAtlasSettings: (settings: AtlasSettings) => void;
  width?: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  mode,
  setMode,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onToggleTrackEnabled,
  onMoveTrack,
  onAddFiles,
  exportScope,
  setExportScope,
  spritesCount,
  keyingSettings,
  onChangeKeying,
  isEyedropperActive,
  setIsEyedropperActive,
  onAutoDetectKey,
  atlasSettings,
  onChangeAtlasSettings,
  width,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<LeftSidebarTab>('media');

  const enabledCount = tracks.filter((t) => t.enabled).length;

  return (
    <aside className="left-sidebar" style={width ? { width } : undefined}>
      {/* 1. Workflow Mode Switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#0a0f0d', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setMode('atlas')}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 11,
            borderRadius: 6,
            background: mode === 'atlas' ? '#142a21' : 'transparent',
            border: mode === 'atlas' ? '1px solid #1e4d36' : '1px solid transparent',
            color: mode === 'atlas' ? 'var(--accent-green)' : 'var(--text-muted)',
            fontWeight: mode === 'atlas' ? 700 : 500,
            gap: 5,
          }}
        >
          <Layers size={13} />
          <span>Atlas</span>
        </button>
        <button
          onClick={() => setMode('sprites')}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 11,
            borderRadius: 6,
            background: mode === 'sprites' ? '#142a21' : 'transparent',
            border: mode === 'sprites' ? '1px solid #1e4d36' : '1px solid transparent',
            color: mode === 'sprites' ? 'var(--accent-green)' : 'var(--text-muted)',
            fontWeight: mode === 'sprites' ? 700 : 500,
            gap: 5,
          }}
        >
          <Crop size={13} />
          <span>Sprites ({spritesCount})</span>
        </button>
      </div>

      {/* 2. Tool Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          marginBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 8,
        }}
      >
        <button
          onClick={() => setActiveTab('media')}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 10,
            borderRadius: 5,
            background: activeTab === 'media' ? 'var(--bg-card-active)' : 'transparent',
            border: activeTab === 'media' ? '1px solid var(--border-medium)' : '1px solid transparent',
            color: activeTab === 'media' ? 'var(--text-bright)' : 'var(--text-muted)',
            fontWeight: activeTab === 'media' ? 600 : 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          title="Media Library & Tracks"
        >
          <Film size={12} style={{ color: activeTab === 'media' ? 'var(--accent-green)' : 'inherit' }} />
          <span>Tracks ({tracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('keylight')}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 10,
            borderRadius: 5,
            background: activeTab === 'keylight' ? 'var(--bg-card-active)' : 'transparent',
            border: activeTab === 'keylight' ? '1px solid var(--border-medium)' : '1px solid transparent',
            color: activeTab === 'keylight' ? 'var(--text-bright)' : 'var(--text-muted)',
            fontWeight: activeTab === 'keylight' ? 600 : 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          title="Keylight Chroma Key"
        >
          <Wand2 size={12} style={{ color: activeTab === 'keylight' ? 'var(--accent-green)' : 'inherit' }} />
          <span>Keylight</span>
        </button>

        <button
          onClick={() => setActiveTab('cleanup')}
          style={{
            flex: 1,
            padding: '5px 4px',
            fontSize: 10,
            borderRadius: 5,
            background: activeTab === 'cleanup' ? 'var(--bg-card-active)' : 'transparent',
            border: activeTab === 'cleanup' ? '1px solid var(--border-medium)' : '1px solid transparent',
            color: activeTab === 'cleanup' ? 'var(--text-bright)' : 'var(--text-muted)',
            fontWeight: activeTab === 'cleanup' ? 600 : 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          title="AI Stabilization & Cleanup"
        >
          <Sparkles size={12} style={{ color: activeTab === 'cleanup' ? 'var(--accent-cyan)' : 'inherit' }} />
          <span>AI Clean</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 12 }}>
        {/* TAB: MEDIA & MULTI-TRACKS */}
        {activeTab === 'media' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Scope Switcher: Single vs Master Set */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 3,
                background: '#0a0f0d',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setExportScope('single')}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: 10,
                  borderRadius: 4,
                  background: exportScope === 'single' ? '#14251e' : 'transparent',
                  border: exportScope === 'single' ? '1px solid #1e4535' : '1px solid transparent',
                  color: exportScope === 'single' ? 'var(--accent-green)' : 'var(--text-muted)',
                  fontWeight: exportScope === 'single' ? 700 : 500,
                }}
              >
                Single Clip
              </button>
              <button
                onClick={() => setExportScope('master')}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: 10,
                  borderRadius: 4,
                  background: exportScope === 'master' ? '#1c2419' : 'transparent',
                  border: exportScope === 'master' ? '1px solid var(--accent-orange)' : '1px solid transparent',
                  color: exportScope === 'master' ? 'var(--accent-orange)' : 'var(--text-muted)',
                  fontWeight: exportScope === 'master' ? 700 : 500,
                }}
              >
                ★ Master Set ({enabledCount})
              </button>
            </div>

            <div className="sidebar-section-title" style={{ margin: 0 }}>
              <span>Animation Tracks</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  color: 'var(--accent-green)',
                  padding: '2px 6px',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} />
                <span>Add Clip</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && onAddFiles(e.target.files)}
              multiple
              accept="video/*,image/*"
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tracks.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px dashed var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '20px 10px',
                      textAlign: 'center',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                  >
                    Click <span style={{ color: 'var(--accent-green)' }}>+ Add Clip</span> or drop video / image sequences here
                  </div>
                ) : (
                  tracks.map((track, index) => {
                    const isSelected = track.id === selectedTrackId;
                    return (
                      <div
                        key={track.id}
                        onClick={() => onSelectTrack(track.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          padding: '8px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-card)',
                          border: isSelected
                            ? '1px solid #1e4535'
                            : track.enabled && exportScope === 'master'
                            ? '1px solid #3d3419'
                            : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Top row: Master checkbox + Thumbnail + Animation Name Input + Reorder buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Master checkbox */}
                          <input
                            type="checkbox"
                            checked={track.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleTrackEnabled(track.id);
                            }}
                            title="Include in Master Atlas"
                            style={{
                              accentColor: 'var(--accent-green)',
                              cursor: 'pointer',
                              width: 14,
                              height: 14,
                              margin: 0,
                            }}
                          />

                          {/* Thumbnail */}
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              background: '#18201d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {track.thumbnailUrl ? (
                              <img
                                src={track.thumbnailUrl}
                                alt="thumb"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <Film size={13} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </div>

                          {/* Editable Animation Name */}
                          <div style={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={track.name}
                              onChange={(e) => onUpdateTrack({ ...track, name: e.target.value })}
                              placeholder="anim_name"
                              style={{
                                width: '100%',
                                height: 24,
                                padding: '2px 6px',
                                fontSize: 11,
                                fontWeight: 700,
                                color: isSelected ? 'var(--accent-green)' : 'var(--text-bright)',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                              }}
                              title="Engine Animation Name (e.g. idle, run, attack)"
                            />
                          </div>

                          {/* Reorder Up / Down */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              disabled={index === 0}
                              onClick={() => onMoveTrack(track.id, 'up')}
                              style={{
                                padding: '1px 3px',
                                background: 'transparent',
                                border: 'none',
                                color: index === 0 ? 'var(--text-dim)' : 'var(--text-muted)',
                                cursor: index === 0 ? 'default' : 'pointer',
                              }}
                              title="Move track up"
                            >
                              <ArrowUp size={10} />
                            </button>
                            <button
                              disabled={index === tracks.length - 1}
                              onClick={() => onMoveTrack(track.id, 'down')}
                              style={{
                                padding: '1px 3px',
                                background: 'transparent',
                                border: 'none',
                                color: index === tracks.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)',
                                cursor: index === tracks.length - 1 ? 'default' : 'pointer',
                              }}
                              title="Move track down"
                            >
                              <ArrowDown size={10} />
                            </button>
                          </div>
                        </div>

                        {/* Bottom row: Frames count, FPS, Loop Toggle */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingLeft: 20,
                            fontSize: 10,
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>
                            {track.markers.length || track.totalFrames} frames • {track.fps || 12} FPS
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateTrack({ ...track, loop: !track.loop });
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: 9,
                              borderRadius: 4,
                              background: track.loop ? '#13281d' : '#221915',
                              border: track.loop ? '1px solid #1e4d36' : '1px solid #4a2818',
                              color: track.loop ? 'var(--accent-green)' : 'var(--accent-orange)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              cursor: 'pointer',
                            }}
                            title={track.loop ? 'Loop Animation (true)' : 'Play Once (false)'}
                          >
                            <Repeat size={10} />
                            <span>{track.loop ? 'Loop' : 'Once'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
          </div>
        )}

        {/* TAB: KEYLIGHT */}
        {activeTab === 'keylight' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ChromaKeyPanel
              settings={keyingSettings}
              onChange={onChangeKeying}
              isEyedropperActive={isEyedropperActive}
              setIsEyedropperActive={setIsEyedropperActive}
              onAutoDetectKey={onAutoDetectKey}
            />
          </div>
        )}

        {/* TAB: AI CLEANUP & FX */}
        {activeTab === 'cleanup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sidebar-section-title" style={{ margin: 0 }}>
              <span>AI Cleanup & Stabilization</span>
            </div>
            <AiCleanupPanel settings={atlasSettings} onChange={onChangeAtlasSettings} />
          </div>
        )}
      </div>
    </aside>
  );
};
