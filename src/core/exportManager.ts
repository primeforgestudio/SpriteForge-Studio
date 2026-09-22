import JSZip from 'jszip';
import { AtlasBuilder } from './atlasBuilder';

export interface ExportFileItem {
  name: string;
  data?: Blob | ArrayBuffer | Uint8Array;
  text?: string;
  isText?: boolean;
}

export interface SaveExportResult {
  success: boolean;
  targetDir?: string;
  count?: number;
  canceled?: boolean;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      selectExportDirectory: (defaultPath?: string) => Promise<{ canceled: boolean; filePaths: string[] }>;
      saveExportFiles: (options: {
        baseDir: string;
        folderName: string;
        files: Array<{ name: string; isText?: boolean; text?: string; data?: Uint8Array | ArrayBuffer }>;
      }) => Promise<{ success: boolean; targetDir?: string; count?: number; error?: string }>;
      openPath: (folderPath: string) => Promise<string>;
      getDefaultExportDir: () => Promise<string>;
    };
  }
}

export class ExportManager {
  private static STORAGE_KEY = 'spriteforge_last_export_dir';

  public static isElectron(): boolean {
    return typeof window !== 'undefined' && typeof window.electronAPI?.saveExportFiles === 'function';
  }

  public static getLastExportDirectory(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  public static setLastExportDirectory(dir: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, dir);
    } catch {}
  }

  /**
   * Prompts native directory picker (Electron) or File System Access API
   */
  public static async selectExportDirectory(currentPath?: string): Promise<string | null> {
    if (this.isElectron() && window.electronAPI) {
      const defaultDir = currentPath || this.getLastExportDirectory() || undefined;
      const res = await window.electronAPI.selectExportDirectory(defaultDir);
      if (res && !res.canceled && res.filePaths.length > 0) {
        const chosen = res.filePaths[0];
        this.setLastExportDirectory(chosen);
        return chosen;
      }
      return null;
    }

    return null;
  }

  /**
   * Saves all exported files into a newly created folder named `folderName`
   * within `baseDir` (or prompts user for base directory).
   */
  public static async saveExportPackage(
    preferredBaseDir: string | null | undefined,
    folderName: string,
    items: ExportFileItem[]
  ): Promise<SaveExportResult> {
    const safeFolderName = (folderName || 'sprites_export')
      .trim()
      .replace(/[<>:"/\\|?*]/g, '_');

    // --- 1. ELECTRON NATIVE MODE (creates folder & writes files natively) ---
    if (this.isElectron() && window.electronAPI) {
      let baseDir = preferredBaseDir || this.getLastExportDirectory();

      if (!baseDir) {
        const picked = await this.selectExportDirectory();
        if (!picked) {
          return { success: false, canceled: true };
        }
        baseDir = picked;
      }

      // Convert Blobs to Uint8Array for IPC serialization
      const serializedFiles: Array<{
        name: string;
        isText?: boolean;
        text?: string;
        data?: Uint8Array;
      }> = [];

      for (const item of items) {
        if (item.isText || typeof item.text === 'string') {
          serializedFiles.push({
            name: item.name,
            isText: true,
            text: item.text ?? '',
          });
        } else if (item.data instanceof Blob) {
          const buffer = await item.data.arrayBuffer();
          serializedFiles.push({
            name: item.name,
            isText: false,
            data: new Uint8Array(buffer),
          });
        } else if (item.data instanceof ArrayBuffer) {
          serializedFiles.push({
            name: item.name,
            isText: false,
            data: new Uint8Array(item.data),
          });
        } else if (item.data instanceof Uint8Array) {
          serializedFiles.push({
            name: item.name,
            isText: false,
            data: item.data,
          });
        }
      }

      const res = await window.electronAPI.saveExportFiles({
        baseDir,
        folderName: safeFolderName,
        files: serializedFiles,
      });

      if (res.success) {
        this.setLastExportDirectory(baseDir);
      }

      return res;
    }

    // --- 2. BROWSER FILE SYSTEM ACCESS API (Chromium / Edge) ---
    if (typeof (window as any).showDirectoryPicker === 'function') {
      try {
        const parentHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        const targetDirHandle = await parentHandle.getDirectoryHandle(safeFolderName, {
          create: true,
        });

        for (const item of items) {
          const fileHandle = await targetDirHandle.getFileHandle(item.name, { create: true });
          const writable = await fileHandle.createWritable();
          if (item.isText || typeof item.text === 'string') {
            await writable.write(item.text ?? '');
          } else if (item.data) {
            await writable.write(item.data);
          }
          await writable.close();
        }

        return {
          success: true,
          targetDir: safeFolderName,
          count: items.length,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, canceled: true };
        }
        console.warn('DirectoryPicker failed or declined, falling back to ZIP:', err);
      }
    }

    // --- 3. FALLBACK: JSZip Archive containing the folder ---
    try {
      const zip = new JSZip();
      const folder = zip.folder(safeFolderName) || zip;

      for (const item of items) {
        if (item.isText || typeof item.text === 'string') {
          folder.file(item.name, item.text ?? '');
        } else if (item.data instanceof Blob) {
          folder.file(item.name, item.data);
        } else if (item.data) {
          folder.file(item.name, item.data);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      AtlasBuilder.triggerDownload(zipBlob, `${safeFolderName}.zip`);

      return {
        success: true,
        targetDir: `${safeFolderName}.zip`,
        count: items.length,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
