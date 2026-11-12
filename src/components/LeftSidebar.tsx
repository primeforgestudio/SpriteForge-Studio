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
  Trash2,
  GripVertical,
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
  onReorderTracks?: (fromIndex: number, toIndex: number) => void;
  onDeleteTrack?: (id: string) => void;
  onAddFiles: (files: FileList) => void;
  exportScope: ExportScope;
  setExportScope: (scope: ExportScope) => void;
  spritesCount: number;
  // Keying Props
  keyingSettings: ChromaKeySettings;
  onChangeKeying: (settings: ChromaKeySettings) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  eyedropperTarget?: 'primary' | 'secondary';
  setEyedropperTarget?: (target: 'primary' | 'secondary') => void;
  onAutoDetectKey: () => Promise<void>;
  // AI Cleanup Props
  atlasSettings: AtlasSettings;
  onChangeAtlasSettings: (settings: AtlasSettings) => void;
  width?: number;
  // Dual-Stream Matte Props
  onLoadMaskMedia?: (file: File) => void;
  onRemoveMaskMedia?: () => void;
  maskFilename?: string;
  hasMaskMedia?: boolean;
  invertMask?: boolean;
  onToggleInvertMask?: () => void;
  // AI Background Removal (No Chroma Key)
  onRunAiMatte?: (scope: 'current' | 'all') => void;
  onClearAiMasks?: () => void;
  isProcessingAiBg?: boolean;
  aiBgProgress?: { current: number; total: number; stage: string } | null;
  aiMasksCount?: number;
}

const LeftSidebarComponent: React.FC<LeftSidebarProps> = ({
  mode,
  setMode,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onToggleTrackEnabled,
  onMoveTrack,
  onReorderTracks,
  onDeleteTrack,
  onAddFiles,
  exportScope,
  setExportScope,
  spritesCount,
  keyingSettings,
  onChangeKeying,
  isEyedropperActive,
  setIsEyedropperActive,
  eyedropperTarget,
  setEyedropperTarget,
  onAutoDetectKey,
  atlasSettings,
  onChangeAtlasSettings,
  width,
  onLoadMaskMedia,
  onRemoveMaskMedia,
  maskFilename = '',
  hasMaskMedia = false,
  invertMask = false,
  onToggleInvertMask,
  onRunAiMatte,
  onClearAiMasks,
  isProcessingAiBg = false,
  aiBgProgress = null,
  aiMasksCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<LeftSidebarTab>('media');
  const [draggedTrackIdx, setDraggedTrackIdx] = useState<number | null>(null);
  const [dragOverTrackIdx, setDragOverTrackIdx] = useState<number | null>(null);

  const enabledCount = tracks.filter((t) => t.enabled).length;

  return (
    <aside className="left-sidebar" style={width ? { width } : undefined}>
      {/* 1. Workflow Mode Switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#121316', padding: 3, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setMode('atlas')}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 11,
            borderRadius: 6,
            background: mode === 'atlas' ? '#2B2D37' : 'transparent',
            border: mode === 'atlas' ? '1px solid #FF551F' : '1px solid transparent',
            color: mode === 'atlas' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: mode === 'atlas' ? 700 : 500,
            gap: 5,
          }}
        >
          <Layers size={13} style={{ color: mode === 'atlas' ? '#FF551F' : 'currentColor' }} />
          <span>Atlas</span>
        </button>
        <button
          onClick={() => setMode('sprites')}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 11,
            borderRadius: 6,
            background: mode === 'sprites' ? '#2B2D37' : 'transparent',
            border: mode === 'sprites' ? '1px solid #FF551F' : '1px solid transparent',
            color: mode === 'sprites' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: mode === 'sprites' ? 700 : 500,
            gap: 5,
          }}
        >
          <Crop size={13} style={{ color: mode === 'sprites' ? '#FF551F' : 'currentColor' }} />
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
          <Film size={12} style={{ color: activeTab === 'media' ? '#FF551F' : 'inherit' }} />
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
          title="KeyForge Chroma Key"
        >
          <Wand2 size={12} style={{ color: activeTab === 'keylight' ? '#FF551F' : 'inherit' }} />
          <span>KeyForge</span>
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
          <Sparkles size={12} style={{ color: activeTab === 'cleanup' ? '#FF551F' : 'inherit' }} />
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
                background: '#121316',
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
                  background: exportScope === 'single' ? '#2B2D37' : 'transparent',
                  border: exportScope === 'single' ? '1px solid #2D2E37' : '1px solid transparent',
                  color: exportScope === 'single' ? '#ffffff' : 'var(--text-muted)',
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
                  background: exportScope === 'master' ? '#2B2D37' : 'transparent',
                  border: exportScope === 'master' ? '1px solid #FF551F' : '1px solid transparent',
                  color: exportScope === 'master' ? '#FF551F' : 'var(--text-muted)',
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
                  color: '#FF551F',
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
                    Click <span style={{ color: '#FF551F' }}>+ Add Clip</span> or drop video / image sequences here
                  </div>
                ) : (
                  tracks.map((track, index) => {
                    const isSelected = track.id === selectedTrackId;
                    const isDragged = draggedTrackIdx === index;
                    const isDragOver = dragOverTrackIdx === index;

                    return (
                      <div
                        key={track.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(index));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedTrackIdx(index);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverTrackIdx !== index) {
                            setDragOverTrackIdx(index);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverTrackIdx === index) {
                            setDragOverTrackIdx(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedTrackIdx !== null && draggedTrackIdx !== index && onReorderTracks) {
                            onReorderTracks(draggedTrackIdx, index);
                          }
                          setDraggedTrackIdx(null);
                          setDragOverTrackIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggedTrackIdx(null);
                          setDragOverTrackIdx(null);
                        }}
                        onClick={() => onSelectTrack(track.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          padding: '8px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-card)',
                          border: isDragOver
                            ? '2px solid #FF551F'
                            : isSelected
                            ? '1px solid #FF551F'
                            : track.enabled && exportScope === 'master'
                            ? '1px solid #FF551F'
                            : '1px solid var(--border-subtle)',
                          opacity: isDragged ? 0.4 : 1,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        {/* Top row: Drag Handle + Master checkbox + Thumbnail + Animation Name Input + Reorder buttons + Delete button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {/* Drag-and-Drop Reorder Grip Handle */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'grab',
                              color: 'var(--text-dim)',
                              flexShrink: 0,
                            }}
                            title="Drag to reorder track position"
                          >
                            <GripVertical size={13} />
                          </div>

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
                              accentColor: '#FF551F',
                              cursor: 'pointer',
                              width: 14,
                              height: 14,
                              margin: 0,
                              flexShrink: 0,
                            }}
                          />

                          {/* Thumbnail */}
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              background: '#1f2026',
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
                                color: isSelected ? '#FF551F' : 'var(--text-bright)',
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
                                padding: '1px 2px',
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
                                padding: '1px 2px',
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

                          {/* Dedicated Track Delete Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTrack?.(track.id);
                            }}
                            style={{
                              padding: '3px 4px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title={`Delete track "${track.name}"`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Bottom row: Direction badge, Frames count, FPS, Loop Toggle */}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {track.directionLabel && (
                              <span
                                style={{
                                  background: 'rgba(255, 85, 31, 0.15)',
                                  color: '#FF551F',
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  fontWeight: 700,
                                  fontSize: 9,
                                }}
                              >
                                {track.directionLabel}
                              </span>
                            )}
                            <span>
                              {track.markers.length || track.totalFrames} frames • {track.fps || 12} FPS
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateTrack({ ...track, loop: !track.loop });
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: 9,
                              borderRadius: 4,
                              background: track.loop ? '#2B2D37' : 'transparent',
                              border: track.loop ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                              color: track.loop ? '#FF551F' : 'var(--text-muted)',
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
            {/* DUAL-STREAM / ALPHA MATTE PASS */}
            <div
              style={{
                background: '#121316',
                padding: 10,
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Film size={12} color="var(--accent-orange)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>
                    Dual-Stream Matte Pass
                  </span>
                </div>
                {hasMaskMedia && (
                  <span
                    style={{
                      fontSize: 9,
                      background: 'rgba(0, 229, 255, 0.15)',
                      color: '#00e5ff',
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              {hasMaskMedia ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '4px 8px',
                      borderRadius: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-bright)',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 180,
                      }}
                    >
                      {maskFilename}
                    </span>
                    <button
                      onClick={onRemoveMaskMedia}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff4d4d',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                      title="Remove Matte"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={invertMask}
                      onChange={onToggleInvertMask}
                      style={{ accentColor: 'var(--accent-orange)' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>Invert Matte (Black = Opaque)</span>
                  </label>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="matte-file-input"
                    accept="video/*,image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0] && onLoadMaskMedia) {
                        onLoadMaskMedia(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    onClick={() => document.getElementById('matte-file-input')?.click()}
                    style={{
                      width: '100%',
                      height: 28,
                      fontSize: 10,
                      fontWeight: 600,
                      background: '#2B2D37',
                      border: '1px dashed #444',
                      borderRadius: 5,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={11} />
                    <span>Load Alpha Matte Video / Mask</span>
                  </button>
                </div>
              )}
            </div>

            <ChromaKeyPanel
              settings={keyingSettings}
              onChange={onChangeKeying}
              isEyedropperActive={isEyedropperActive}
              setIsEyedropperActive={setIsEyedropperActive}
              eyedropperTarget={eyedropperTarget}
              setEyedropperTarget={setEyedropperTarget}
              onAutoDetectKey={onAutoDetectKey}
              onRunAiMatte={onRunAiMatte}
              onClearAiMasks={onClearAiMasks}
              isProcessingAiBg={isProcessingAiBg}
              aiBgProgress={aiBgProgress}
              aiMasksCount={aiMasksCount}
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

export const LeftSidebar = React.memo(LeftSidebarComponent);
