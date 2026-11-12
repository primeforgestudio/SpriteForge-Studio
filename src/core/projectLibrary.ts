import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauriBridge';
import { CharacterLibraryEntry, SpriteForgeProject } from './types';

const WEB_LIBRARY_KEY = 'spriteforge_character_library_v1';

interface RawLibraryEntryMeta {
  id: string;
  character_name: string;
  action_name: string;
  file_path: string;
  thumbnail_url?: string;
  frames_count: number;
  fps: number;
  updated_at: string;
}

export class ProjectLibraryManager {
  public static async listEntries(): Promise<CharacterLibraryEntry[]> {
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<RawLibraryEntryMeta[]>('list_library_cmd');
        return res.map((r) => ({
          id: r.id,
          characterName: r.character_name,
          actionName: r.action_name,
          filePath: r.file_path,
          thumbnailUrl: r.thumbnail_url,
          framesCount: r.frames_count,
          fps: r.fps,
          updatedAt: r.updated_at,
        }));
      } catch (err) {
        console.warn('[ProjectLibrary] Native list failed, falling back:', err);
      }
    }

    try {
      const raw = localStorage.getItem(WEB_LIBRARY_KEY);
      if (!raw) return [];
      const map = JSON.parse(raw) as Record<string, { meta: CharacterLibraryEntry; content: string }>;
      return Object.values(map)
        .map((v) => v.meta)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch {
      return [];
    }
  }

  public static async saveToLibrary(
    characterName: string,
    actionName: string,
    project: SpriteForgeProject
  ): Promise<string> {
    const cleanChar = characterName.trim() || 'Default_Character';
    const cleanAct = actionName.trim() || 'idle';
    const enrichedProject: SpriteForgeProject = {
      ...project,
      name: `${cleanChar}_${cleanAct}`,
      characterName: cleanChar,
      savedAt: new Date().toISOString(),
    };
    const jsonContent = JSON.stringify(enrichedProject, null, 2);

    if (isTauriEnvironment()) {
      return await invoke<string>('save_to_library_cmd', {
        characterName: cleanChar,
        actionName: cleanAct,
        content: jsonContent,
      });
    }

    // Web fallback
    const id = `${cleanChar}/${cleanAct}`;
    const raw = localStorage.getItem(WEB_LIBRARY_KEY);
    const map: Record<string, { meta: CharacterLibraryEntry; content: string }> = raw ? JSON.parse(raw) : {};
    const firstTrack = project.tracks[0];
    map[id] = {
      meta: {
        id,
        characterName: cleanChar,
        actionName: cleanAct,
        filePath: id,
        thumbnailUrl: firstTrack?.thumbnailUrl,
        framesCount: firstTrack?.markers?.length || firstTrack?.totalFrames || 0,
        fps: project.atlasSettings?.fps || 24,
        updatedAt: enrichedProject.savedAt,
      },
      content: jsonContent,
    };
    localStorage.setItem(WEB_LIBRARY_KEY, JSON.stringify(map));
    return id;
  }

  public static async loadFromLibrary(filePath: string): Promise<SpriteForgeProject | null> {
    if (isTauriEnvironment()) {
      const content = await invoke<string>('load_library_file_cmd', { filePath });
      return JSON.parse(content) as SpriteForgeProject;
    }

    const raw = localStorage.getItem(WEB_LIBRARY_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { meta: CharacterLibraryEntry; content: string }>;
    const item = map[filePath];
    return item ? (JSON.parse(item.content) as SpriteForgeProject) : null;
  }

  public static async deleteFromLibrary(filePath: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('delete_library_file_cmd', { filePath });
      return;
    }

    const raw = localStorage.getItem(WEB_LIBRARY_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, { meta: CharacterLibraryEntry; content: string }>;
    delete map[filePath];
    localStorage.setItem(WEB_LIBRARY_KEY, JSON.stringify(map));
  }
}
