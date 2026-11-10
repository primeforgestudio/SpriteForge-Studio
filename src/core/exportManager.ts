import JSZip from 'jszip';
import { AtlasBuilder } from './atlasBuilder';
import { isTauriEnvironment } from './tauriBridge';

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

async function itemToBase64(item: ExportFileItem): Promise<string> {
  if (item.data instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(item.data as Blob);
    });
  } else if (item.data instanceof ArrayBuffer || item.data instanceof Uint8Array) {
    const bytes = item.data instanceof Uint8Array ? item.data : new Uint8Array(item.data);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return '';
}

export class ExportManager {
  private static STORAGE_KEY = 'spriteforge_last_export_dir';

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
   * Prompts native directory picker (Tauri) or File System Access API
   */
  public static async selectExportDirectory(currentPath?: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      // 1. Try 100% native Rust folder picker first
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const defaultDir = currentPath || this.getLastExportDirectory() || undefined;
        const selected = await invoke<string | null>('pick_export_directory_cmd', { defaultPath: defaultDir });
        if (selected && typeof selected === 'string') {
          this.setLastExportDirectory(selected);
          return selected;
        }
        if (selected === null) {
          return null;
        }
      } catch (err) {
        console.warn('[ExportManager] pick_export_directory_cmd error, fallback to plugin-dialog:', err);
      }

      // 2. Fallback to Tauri plugin-dialog
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const defaultDir = currentPath || this.getLastExportDirectory() || undefined;
        const selected = await open({
          directory: true,
          multiple: false,
          defaultPath: defaultDir,
          title: 'Select Destination Directory for Sprite Export',
        });
        if (selected && typeof selected === 'string') {
          this.setLastExportDirectory(selected);
          return selected;
        }
        return null;
      } catch (err) {
        console.warn('[ExportManager] Tauri dialog open error:', err);
      }
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

    // --- 1. TAURI NATIVE DESKTOP MODE (Rust Direct File System) ---
    if (isTauriEnvironment()) {
      try {
        let baseDir = preferredBaseDir || this.getLastExportDirectory();

        if (!baseDir) {
          const picked = await this.selectExportDirectory();
          if (!picked) {
            return { success: false, canceled: true };
          }
          baseDir = picked;
        }

        const { invoke } = await import('@tauri-apps/api/core');
        const serializedFiles = await Promise.all(
          items.map(async (item) => {
            if (item.isText || typeof item.text === 'string') {
              return { name: item.name, text: item.text ?? '', content_base64: null };
            }
            const b64 = await itemToBase64(item);
            return { name: item.name, text: null, content_base64: b64 };
          })
        );

        const res = await invoke<{ success: boolean; target_dir?: string; error?: string; count: number }>(
          'save_export_files_native_cmd',
          { targetDir: baseDir, folderName: safeFolderName, files: serializedFiles }
        );

        if (res && res.success) {
          this.setLastExportDirectory(baseDir);
          return {
            success: true,
            targetDir: res.target_dir,
            count: res.count,
          };
        } else if (res && res.error) {
          console.warn('[ExportManager] Native export reported error, trying fallback:', res.error);
        }
      } catch (err: any) {
        console.warn('[ExportManager] Rust native export invoke failed, trying plugin-fs fallback:', err);
      }

      // Fallback to Tauri plugin-fs
      try {
        const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
        let baseDir = preferredBaseDir || this.getLastExportDirectory();
        if (baseDir) {
          const separator = baseDir.includes('\\') ? '\\' : '/';
          const targetDir = `${baseDir}${separator}${safeFolderName}`;
          await mkdir(targetDir, { recursive: true });

          for (const item of items) {
            const filePath = `${targetDir}${separator}${item.name}`;
            if (item.isText || typeof item.text === 'string') {
              const encoder = new TextEncoder();
              await writeFile(filePath, encoder.encode(item.text ?? ''));
            } else if (item.data instanceof Blob) {
              const buffer = await item.data.arrayBuffer();
              await writeFile(filePath, new Uint8Array(buffer));
            } else if (item.data instanceof ArrayBuffer) {
              await writeFile(filePath, new Uint8Array(item.data));
            } else if (item.data instanceof Uint8Array) {
              await writeFile(filePath, item.data);
            }
          }

          this.setLastExportDirectory(baseDir);
          return {
            success: true,
            targetDir,
            count: items.length,
          };
        }
      } catch (err: any) {
        console.warn('[ExportManager] plugin-fs failed, falling back to ZIP:', err);
      }
    }

    // --- 2. BROWSER FILE SYSTEM ACCESS API ---
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
        console.warn('DirectoryPicker failed, falling back to ZIP:', err);
      }
    }

    // --- 3. UNIVERSAL FALLBACK: JSZip Archive ---
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
