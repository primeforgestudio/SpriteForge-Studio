import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FolderKanban,
  User,
  Film,
  Plus,
  Trash2,
  FolderOpen,
  Layers,
  Search,
  Check,
} from 'lucide-react';
import { CharacterLibraryEntry, SpriteForgeProject } from '../core/types';
import { ProjectLibraryManager } from '../core/projectLibrary';

interface ProjectLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasActiveMedia: boolean;
  defaultCharacterName?: string;
  defaultActionName?: string;
  onSaveCurrentToLibrary: (characterName: string, actionName: string) => Promise<void>;
  onLoadProjectFromLibrary: (project: SpriteForgeProject, filePath: string) => Promise<void>;
  onAppendActionToMaster: (project: SpriteForgeProject) => Promise<void>;
}

const ACTION_PRESETS = ['idle', 'walk', 'run', 'attack', 'jump', 'hit', 'death'];

export const ProjectLibraryModal: React.FC<ProjectLibraryModalProps> = ({
  isOpen,
  onClose,
  hasActiveMedia,
  defaultCharacterName = 'Hero_Character',
  defaultActionName = 'idle',
  onSaveCurrentToLibrary,
  onLoadProjectFromLibrary,
  onAppendActionToMaster,
}) => {
  const [entries, setEntries] = useState<CharacterLibraryEntry[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [charInput, setCharInput] = useState(defaultCharacterName);
  const [actionInput, setActionInput] = useState(defaultActionName);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refreshLibrary = async () => {
    setIsLoading(true);
    try {
      const list = await ProjectLibraryManager.listEntries();
      setEntries(list);
      if (list.length > 0 && (!selectedCharacter || !list.some((e) => e.characterName === selectedCharacter))) {
        setSelectedCharacter(list[0].characterName);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCharInput(defaultCharacterName || 'Hero_Character');
      setActionInput(defaultActionName || 'idle');
      refreshLibrary();
    }
  }, [isOpen, defaultCharacterName, defaultActionName]);

  const characters = useMemo(() => {
    const map = new Map<string, CharacterLibraryEntry[]>();
    for (const item of entries) {
      if (
        searchQuery &&
        !item.characterName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.actionName.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        continue;
      }
      const list = map.get(item.characterName) || [];
      list.push(item);
      map.set(item.characterName, list);
    }
    return Array.from(map.entries()).map(([name, actions]) => ({
      name,
      actions,
      thumbnailUrl: actions.find((a) => a.thumbnailUrl)?.thumbnailUrl,
    }));
  }, [entries, searchQuery]);

  const activeActions = useMemo(() => {
    return characters.find((c) => c.name === selectedCharacter)?.actions || [];
  }, [characters, selectedCharacter]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!hasActiveMedia || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveCurrentToLibrary(charInput.trim() || 'Hero_Character', actionInput.trim() || 'idle');
      setSelectedCharacter(charInput.trim() || 'Hero_Character');
      await refreshLibrary();
      setStatusMsg(`Saved "${charInput} → ${actionInput}"`);
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpen = async (entry: CharacterLibraryEntry) => {
    const proj = await ProjectLibraryManager.loadFromLibrary(entry.filePath);
    if (proj) {
      await onLoadProjectFromLibrary(proj, entry.filePath);
      onClose();
    }
  };

  const handleAppend = async (entry: CharacterLibraryEntry) => {
    const proj = await ProjectLibraryManager.loadFromLibrary(entry.filePath);
    if (proj) {
      await onAppendActionToMaster(proj);
      setStatusMsg(`Added "${entry.actionName}" to Master Set`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleDelete = async (entry: CharacterLibraryEntry) => {
    await ProjectLibraryManager.deleteFromLibrary(entry.filePath);
    await refreshLibrary();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 11, 14, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '920px',
          maxWidth: '95vw',
          height: '640px',
          maxHeight: '88vh',
          background: '#17181C',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1D1E24',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={18} color="#FF551F" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                Character & Actions Library
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Organize saved animations by Character → Action and merge them into Master Sets
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: '#2B2D37',
              border: '1px solid var(--border-medium)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Close Library"
          >
            <X size={16} />
          </button>
        </div>

        {/* Save Current Workspace Bar */}
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(255, 85, 31, 0.06)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
            <User size={13} color="#FF551F" />
            <input
              type="text"
              value={charInput}
              onChange={(e) => setCharInput(e.target.value)}
              placeholder="Character (e.g. Orc_Warrior)"
              style={{
                flex: 1,
                height: 30,
                background: '#121316',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 10px',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px' }}>
            <Film size={13} color="#FF551F" />
            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder="Action (e.g. walk, attack)"
              style={{
                flex: 1,
                height: 30,
                background: '#121316',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 10px',
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {ACTION_PRESETS.slice(0, 5).map((preset) => (
              <button
                key={preset}
                onClick={() => setActionInput(preset)}
                style={{
                  padding: '4px 7px',
                  fontSize: 10,
                  borderRadius: 4,
                  background: actionInput === preset ? '#2B2D37' : '#121316',
                  border: actionInput === preset ? '1px solid #FF551F' : '1px solid var(--border-subtle)',
                  color: actionInput === preset ? '#FF551F' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={!hasActiveMedia || isSaving}
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 6,
              background: hasActiveMedia ? '#FF551F' : '#2B2D37',
              border: 'none',
              color: hasActiveMedia ? '#ffffff' : 'var(--text-dim)',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: hasActiveMedia ? 'pointer' : 'not-allowed',
            }}
            title={hasActiveMedia ? 'Save active workspace into Library' : 'Load video/media first'}
          >
            <Plus size={13} />
            <span>{isSaving ? 'Saving...' : 'Save Current to Library'}</span>
          </button>
        </div>

        {/* Status Bar / Search */}
        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#141519',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 260, background: '#1D1E24', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
            <Search size={12} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter characters or actions..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: 11,
                outline: 'none',
              }}
            />
          </div>

          {statusMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10B981', fontWeight: 600 }}>
              <Check size={13} />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Body: Left Characters List | Right Actions Grid */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Characters */}
          <div
            style={{
              width: 240,
              borderRight: '1px solid var(--border-subtle)',
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: '#15161A',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px', textTransform: 'uppercase' }}>
              Characters ({characters.length})
            </div>

            {isLoading ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 12 }}>Loading library...</div>
            ) : characters.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 12, lineHeight: 1.4 }}>
                No saved characters yet. Load a video and click "Save Current to Library" above!
              </div>
            ) : (
              characters.map((c) => {
                const isActive = c.name === selectedCharacter;
                return (
                  <button
                    key={c.name}
                    onClick={() => {
                      setSelectedCharacter(c.name);
                      setCharInput(c.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isActive ? '#2B2D37' : 'transparent',
                      border: isActive ? '1px solid #FF551F' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 5,
                        background: '#121316',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {c.thumbnailUrl ? (
                        <img src={c.thumbnailUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <User size={14} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isActive ? '#FF551F' : '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {c.actions.length} {c.actions.length === 1 ? 'action' : 'actions'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {activeActions.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: 8 }}>
                <FolderKanban size={32} opacity={0.4} />
                <div style={{ fontSize: 12 }}>Select a character or save an action above</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                {activeActions.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      background: '#1E2027',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        className="checkerboard"
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {act.thumbnailUrl ? (
                          <img src={act.thumbnailUrl} alt={act.actionName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <Film size={18} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                          {act.actionName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {act.framesCount} frames • {act.fps} FPS
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                          {act.updatedAt ? new Date(act.updatedAt).toLocaleString() : 'Saved locally'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(act)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Delete action from library"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleOpen(act)}
                        style={{
                          flex: 1,
                          height: 28,
                          borderRadius: 5,
                          background: '#FF551F',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          cursor: 'pointer',
                        }}
                      >
                        <FolderOpen size={12} />
                        <span>Open</span>
                      </button>
                      <button
                        onClick={() => handleAppend(act)}
                        style={{
                          flex: 1,
                          height: 28,
                          borderRadius: 5,
                          background: '#2B2D37',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-bright)',
                          fontSize: 10,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          cursor: 'pointer',
                        }}
                        title="Append this action as a track into current Master Set"
                      >
                        <Layers size={11} color="#FF551F" />
                        <span>+ Master Set</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
