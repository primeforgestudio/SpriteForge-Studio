import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  GraduationCap,
  FolderOpen,
  Plus,
  LayoutGrid,
  List,
  UploadCloud,
  Film,
  FolderKanban,
  ArrowLeft,
  X,
  Heart,
  Github,
  Sparkles,
  Scissors,
  Layers,
} from 'lucide-react';
import { RecentProjectItem } from '../core/projectManager';
import { CharacterLibraryEntry, SpriteForgeProject } from '../core/types';
import { ProjectLibraryManager } from '../core/projectLibrary';

interface HomeScreenProps {
  recentProjects: RecentProjectItem[];
  onRemoveRecent: (filePath: string) => void;
  onNewProject: () => void;
  onOpenProjectDialog: () => void;
  onOpenRecentProject: (filePath: string) => Promise<void>;
  onLoadMediaFiles: (files: FileList) => Promise<void>;
  onOpenLibraryProject: (project: SpriteForgeProject, filePath: string) => Promise<void>;
  hasActiveWorkspace: boolean;
  activeWorkspaceName?: string;
  onResumeWorkspace: () => void;
  onOpenSupport?: () => void;
}

type HomeTab = 'home' | 'library' | 'learn';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  recentProjects,
  onRemoveRecent,
  onNewProject,
  onOpenProjectDialog,
  onOpenRecentProject,
  onLoadMediaFiles,
  onOpenLibraryProject,
  hasActiveWorkspace,
  activeWorkspaceName,
  onResumeWorkspace,
  onOpenSupport,
}) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [libraryEntries, setLibraryEntries] = useState<CharacterLibraryEntry[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ProjectLibraryManager.listEntries().then(setLibraryEntries);
  }, [activeTab]);

  const handleOpenMediaInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadMediaFiles(e.target.files);
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#17181C',
        color: 'var(--text-bright)',
        display: 'flex',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="video/*,image/*,.sfproj"
        onChange={handleOpenMediaInput}
        style={{ display: 'none' }}
      />

      {/* Left Sidebar Rail (Matching PhotoCraft / Adobe Dark Layout) */}
      <aside
        style={{
          width: 210,
          background: '#1B1C21',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '18px 14px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onNewProject}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 6,
                background: '#FF551F',
                border: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255, 85, 31, 0.35)',
              }}
            >
              <Plus size={14} />
              <span>New project</span>
            </button>

            <button
              onClick={onOpenProjectDialog}
              style={{
                width: '100%',
                height: 34,
                borderRadius: 6,
                background: '#25272F',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-bright)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <FolderOpen size={13} color="#FF551F" />
              <span>Open...</span>
            </button>

            {hasActiveWorkspace && (
              <button
                onClick={onResumeWorkspace}
                style={{
                  width: '100%',
                  height: 34,
                  borderRadius: 6,
                  background: 'rgba(16, 185, 129, 0.14)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  color: '#10B981',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  marginTop: 2,
                }}
                title={`Return to ${activeWorkspaceName || 'current project'}`}
              >
                <ArrowLeft size={13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Resume Workspace
                </span>
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
            {(
              [
                { id: 'home', label: 'Home', icon: <Home size={14} /> },
                { id: 'library', label: 'Characters', icon: <FolderKanban size={14} /> },
                { id: 'learn', label: 'Learn', icon: <GraduationCap size={14} /> },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: isActive ? '#262830' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '2.5px solid #FF551F' : '2.5px solid transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: isActive ? '#FF551F' : 'inherit', display: 'flex' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Studio Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          {onOpenSupport && (
            <button
              onClick={onOpenSupport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <Heart size={13} color="#FF551F" />
              <span>Prime Forge Studio</span>
            </button>
          )}
          <a
            href="https://github.com/primeforgestudio/SpriteForge-Studio"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              color: 'var(--text-muted)',
              fontSize: 11,
              textDecoration: 'none',
            }}
          >
            <Github size={13} />
            <span>GitHub Repository</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px' }}>
        {/* Top Brand Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="SpriteForge" style={{ height: 26, width: 'auto', display: 'block' }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: 'rgba(255, 92, 38, 0.14)',
                color: '#FF551F',
                border: '1px solid rgba(255, 92, 38, 0.35)',
                padding: '2px 7px',
                borderRadius: 5,
                letterSpacing: '0.6px',
              }}
            >
              STUDIO
            </span>
          </div>

          {activeTab !== 'learn' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#1D1E24', padding: 3, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '5px 7px',
                  borderRadius: 4,
                  background: viewMode === 'grid' ? '#2B2D37' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '5px 7px',
                  borderRadius: 4,
                  background: viewMode === 'list' ? '#2B2D37' : 'transparent',
                  border: 'none',
                  color: viewMode === 'list' ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                }}
                title="List View"
              >
                <List size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Tab: HOME (Recent Projects + Drop Zone) */}
        {activeTab === 'home' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 14 }}>
              Recent Projects
            </div>

            {viewMode === 'grid' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: 14,
                }}
              >
                {recentProjects.map((proj) => (
                  <div
                    key={proj.filePath}
                    onClick={() => onOpenRecentProject(proj.filePath)}
                    style={{
                      background: '#22232A',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF551F')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRecent(proj.filePath);
                      }}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: 'rgba(18, 19, 22, 0.85)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 5,
                      }}
                      title="Remove from recent"
                    >
                      <X size={11} />
                    </button>

                    <div
                      className="checkerboard"
                      style={{
                        height: 112,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#141519',
                        padding: 8,
                      }}
                    >
                      {proj.thumbnailUrl ? (
                        <img
                          src={proj.thumbnailUrl}
                          alt={proj.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <Film size={28} color="var(--text-dim)" />
                      )}
                    </div>

                    <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {proj.name}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-dim)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                        }}
                        title={proj.filePath}
                      >
                        {proj.framesCount} frames • {proj.fps} FPS
                      </div>
                    </div>
                  </div>
                ))}

                {/* Dashed Drop Media / Project Card (Matching Reference Screenshot) */}
                <div
                  onClick={() => mediaInputRef.current?.click()}
                  style={{
                    minHeight: 168,
                    border: '1.5px dashed var(--border-medium)',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: 16,
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#FF551F';
                    e.currentTarget.style.background = 'rgba(255, 85, 31, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                  }}
                >
                  <UploadCloud size={24} color="var(--text-muted)" />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Drop video, PNG sequence, or <span style={{ color: '#FF551F', fontWeight: 700 }}>.sfproj</span> anywhere to open
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentProjects.map((proj) => (
                  <div
                    key={proj.filePath}
                    onClick={() => onOpenRecentProject(proj.filePath)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      background: '#22232A',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 4, background: '#141519', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {proj.thumbnailUrl ? (
                        <img src={proj.thumbnailUrl} alt={proj.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Film size={16} color="var(--text-dim)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{proj.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {proj.filePath}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {proj.framesCount} frames • {proj.fps} FPS
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Character Library Preview on Home */}
            {libraryEntries.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>
                    Saved Character Actions ({libraryEntries.length})
                  </span>
                  <button
                    onClick={() => setActiveTab('library')}
                    style={{ background: 'transparent', border: 'none', color: '#FF551F', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    View all →
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 14 }}>
                  {libraryEntries.slice(0, 6).map((act) => (
                    <div
                      key={act.id}
                      onClick={async () => {
                        const proj = await ProjectLibraryManager.loadFromLibrary(act.filePath);
                        if (proj) await onOpenLibraryProject(proj, act.filePath);
                      }}
                      style={{
                        background: '#22232A',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#10B981')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                    >
                      <div className="checkerboard" style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        {act.thumbnailUrl ? (
                          <img src={act.thumbnailUrl} alt={act.actionName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <Film size={24} color="var(--text-dim)" />
                        )}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>{act.characterName}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>{act.actionName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: CHARACTERS LIBRARY */}
        {activeTab === 'library' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 14 }}>
              Character & Actions Library ({libraryEntries.length})
            </div>
            {libraryEntries.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-dim)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                No character actions saved in Library yet. Open a project and use "Library → Save Current to Library".
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14 }}>
                {libraryEntries.map((act) => (
                  <div
                    key={act.id}
                    onClick={async () => {
                      const proj = await ProjectLibraryManager.loadFromLibrary(act.filePath);
                      if (proj) await onOpenLibraryProject(proj, act.filePath);
                    }}
                    style={{
                      background: '#22232A',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#FF551F')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <div className="checkerboard" style={{ height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      {act.thumbnailUrl ? (
                        <img src={act.thumbnailUrl} alt={act.actionName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Film size={28} color="var(--text-dim)" />
                      )}
                    </div>
                    <div style={{ padding: '10px 10px' }}>
                      <div style={{ fontSize: 10, color: '#FF551F', fontWeight: 700 }}>{act.characterName}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>{act.actionName}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                        {act.framesCount} frames • {act.fps} FPS
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: LEARN */}
        {activeTab === 'learn' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 16 }}>
              SpriteForge Studio Quick Workflow
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ background: '#22232A', padding: 18, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <Sparkles size={20} color="#FF551F" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>1. Keying or AI Matte</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Use GPU KeyForge for green/blue screens, or switch to AI Neural / Smart Flood to isolate characters from complex backgrounds.
                </div>
              </div>
              <div style={{ background: '#22232A', padding: 18, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <Scissors size={20} color="#10B981" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>2. Retouch, Outline & Crop</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Clean residual pockets with the Magic Wand or Eraser, hide glitched frames on the timeline, add Outline strokes, and drag the Crop Box directly on the canvas.
                </div>
              </div>
              <div style={{ background: '#22232A', padding: 18, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <Layers size={20} color="#3B82F6" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>3. Master Atlas & Engine Export</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Combine Idle + Walk + Attack in Master Set, pack with Regular Grid or MaxRects, generate Normal/PBR maps, and export ready for Godot 4, Unity, or Spine.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
