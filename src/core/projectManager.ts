import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauriBridge';
import {
  SpriteForgeProject,
  AnimationTrack,
  ChromaKeySettings,
  AtlasSettings,
  SpritesSettings,
  AppMode,
  ExportScope,
} from './types';

export interface NativeProjectDialogResult {
  success: boolean;
  file_path?: string;
  content?: string;
  error?: string;
  canceled: boolean;
}

export class ProjectManager {
  /**
   * Converts a File or Blob into a Base64 string for embedding into self-contained projects
   */
  public static async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Reconstructs a File object from Base64 or native disk file path
   */
  public static async reconstructTrackFile(track: {
    fileName: string;
    filePath?: string;
    mediaBase64?: string;
  }): Promise<File | null> {
    try {
      // 1. If project has embedded mediaBase64
      if (track.mediaBase64) {
        const res = await fetch(track.mediaBase64);
        const blob = await res.blob();
        const mime = track.fileName.endsWith('.png') ? 'image/png' : 'video/mp4';
        return new File([blob], track.fileName, { type: mime });
      }

      // 2. If running natively in Tauri and we have a local disk path
      if (track.filePath && isTauriEnvironment()) {
        const bytes = await invoke<number[]>('read_media_file_bytes_cmd', {
          filePath: track.filePath,
        });
        if (bytes && bytes.length > 0) {
          const uint8 = new Uint8Array(bytes);
          const mime = track.fileName.endsWith('.png') ? 'image/png' : 'video/mp4';
          const file = new File([uint8], track.fileName, { type: mime });
          (file as any).path = track.filePath;
          return file;
        }
      }
    } catch (e) {
      console.warn(`[ProjectManager] Could not reconstruct media file for "${track.fileName}":`, e);
    }
    return null;
  }

  /**
   * Serializes current Studio application state into a complete SpriteForge Project schema
   */
  public static async serializeProject(params: {
    projectName: string;
    appMode: AppMode;
    exportScope: ExportScope;
    exportFilename: string;
    keyingSettings: ChromaKeySettings;
    atlasSettings: AtlasSettings;
    spritesSettings: SpritesSettings;
    tracks: AnimationTrack[];
    selectedTrackId: string;
    currentFrame: number;
    maskFilename?: string;
    invertMask?: boolean;
    embedMedia?: boolean; // Embed source video/images directly into project (default true for files < 35MB)
  }): Promise<SpriteForgeProject> {
    const {
      projectName,
      appMode,
      exportScope,
      exportFilename,
      keyingSettings,
      atlasSettings,
      spritesSettings,
      tracks,
      selectedTrackId,
      currentFrame,
      maskFilename,
      invertMask,
      embedMedia = true,
    } = params;

    const serializedTracks = await Promise.all(
      tracks.map(async (t) => {
        let mediaBase64 = t.mediaBase64;
        let filePath = t.filePath || (t.fileRef as any)?.path;

        // If requested to embed media and we have fileRef and file is reasonably sized (< 35 MB)
        if (embedMedia && !mediaBase64 && t.fileRef && t.fileRef.size < 35 * 1024 * 1024) {
          try {
            mediaBase64 = await this.fileToBase64(t.fileRef);
          } catch (err) {
            console.warn(`[ProjectManager] Failed to embed Base64 media for track "${t.name}":`, err);
          }
        }

        return {
          id: t.id,
          name: t.name,
          fileName: t.fileName,
          filePath,
          mediaBase64,
          thumbnailUrl: t.thumbnailUrl,
          totalFrames: t.totalFrames,
          cropStart: t.cropStart,
          cropEnd: t.cropEnd,
          markers: [...t.markers],
          fps: t.fps,
          loop: t.loop,
          enabled: t.enabled,
          cropBox: t.cropBox ? { ...t.cropBox } : null,
          directionLabel: t.directionLabel,
        };
      })
    );

    return {
      format: 'spriteforge-project',
      version: '1.0.0',
      name: projectName || 'SpriteForge_Project',
      savedAt: new Date().toISOString(),
      appMode,
      exportScope,
      exportFilename,
      keyingSettings: { ...keyingSettings },
      atlasSettings: { ...atlasSettings },
      spritesSettings: { ...spritesSettings },
      tracks: serializedTracks,
      selectedTrackId,
      currentFrame,
      maskFilename,
      invertMask,
    };
  }

  /**
   * Saves a project file to disk via native Windows file dialog or browser download
   */
  public static async saveProject(
    project: SpriteForgeProject,
    suggestedFilename?: string
  ): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
    const defaultName = (
      suggestedFilename ||
      project.exportFilename ||
      project.name ||
      'character_project'
    )
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_') + '.sfproj';

    const jsonString = JSON.stringify(project, null, 2);

    // Native Tauri Save Dialog
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<NativeProjectDialogResult>('save_project_file_native_cmd', {
          defaultName,
          content: jsonString,
        });

        if (res.canceled) {
          return { success: false, canceled: true };
        }
        if (res.success && res.file_path) {
          return { success: true, filePath: res.file_path };
        }
        return { success: false, error: res.error || 'Failed to save project' };
      } catch (err: any) {
        console.error('[ProjectManager] Tauri save dialog failed, using web fallback:', err);
      }
    }

    // Web Fallback (download .sfproj file)
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filePath: defaultName };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Opens an existing .sfproj project via native Windows file dialog or web file input
   */
  public static async openProject(): Promise<{
    success: boolean;
    project?: SpriteForgeProject;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }> {
    // Native Tauri Open Dialog
    if (isTauriEnvironment()) {
      try {
        const res = await invoke<NativeProjectDialogResult>('open_project_file_native_cmd');
        if (res.canceled) {
          return { success: false, canceled: true };
        }
        if (res.success && res.content) {
          const parsed = JSON.parse(res.content) as SpriteForgeProject;
          if (parsed.format !== 'spriteforge-project' && !parsed.tracks) {
            return { success: false, error: 'Invalid or incompatible project format' };
          }
          return { success: true, project: parsed, filePath: res.file_path };
        }
        return { success: false, error: res.error || 'Failed to open project' };
      } catch (err: any) {
        console.error('[ProjectManager] Tauri open dialog failed, using web fallback:', err);
      }
    }

    // Web Fallback (file input picker)
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sfproj,.json';
      input.style.display = 'none';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, canceled: true });
          return;
        }

        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as SpriteForgeProject;
          if (parsed.format !== 'spriteforge-project' && !parsed.tracks) {
            resolve({ success: false, error: 'Invalid or incompatible project format' });
            return;
          }
          resolve({ success: true, project: parsed, filePath: file.name });
        } catch (e: any) {
          resolve({ success: false, error: `Failed to parse project file: ${e.message}` });
        }
      };

      input.oncancel = () => resolve({ success: false, canceled: true });
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }

  /**
   * Parses project file content directly (e.g. from Drag & Drop)
   */
  public static parseProjectContent(content: string): SpriteForgeProject | null {
    try {
      const parsed = JSON.parse(content) as SpriteForgeProject;
      if (parsed.format === 'spriteforge-project' || parsed.tracks) {
        return parsed;
      }
    } catch (e) {
      console.warn('[ProjectManager] Failed to parse dropped project content:', e);
    }
    return null;
  }
}
