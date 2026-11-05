import { ChromaKeySettings, AtlasSettings, SpritesSettings, BackgroundMode } from './types';

export interface EditorSnapshot {
  keyingSettings: ChromaKeySettings;
  atlasSettings: AtlasSettings;
  spritesSettings: SpritesSettings;
  cropStart: number;
  cropEnd: number;
  cropBox?: { x: number; y: number; width: number; height: number } | null;
  bgMode: BackgroundMode;
  bgColor: [number, number, number];
  timestamp: number;
  description: string;
}

export class HistoryManager {
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private maxHistory = 50;
  private isApplying = false;
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('History listener error:', err);
      }
    }
  }

  public pushSnapshot(snapshot: Omit<EditorSnapshot, 'timestamp'>): void {
    if (this.isApplying) return;

    // Avoid duplicate snapshot if nothing changed
    if (this.undoStack.length > 0) {
      const top = this.undoStack[this.undoStack.length - 1];
      if (
        JSON.stringify(top.keyingSettings) === JSON.stringify(snapshot.keyingSettings) &&
        JSON.stringify(top.atlasSettings) === JSON.stringify(snapshot.atlasSettings) &&
        top.cropStart === snapshot.cropStart &&
        top.cropEnd === snapshot.cropEnd &&
        JSON.stringify(top.cropBox) === JSON.stringify(snapshot.cropBox) &&
        top.bgMode === snapshot.bgMode
      ) {
        return;
      }
    }

    this.undoStack.push({
      ...snapshot,
      timestamp: Date.now(),
    });

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Pushing a new state clears the redo stack
    this.redoStack = [];
    this.notify();
  }

  public undo(currentSnapshot: Omit<EditorSnapshot, 'timestamp'>): EditorSnapshot | null {
    if (this.undoStack.length === 0) return null;

    this.isApplying = true;
    try {
      // Save current state to redo stack
      this.redoStack.push({
        ...currentSnapshot,
        timestamp: Date.now(),
      });

      const previous = this.undoStack.pop()!;
      this.notify();
      return previous;
    } finally {
      this.isApplying = false;
    }
  }

  public redo(currentSnapshot: Omit<EditorSnapshot, 'timestamp'>): EditorSnapshot | null {
    if (this.redoStack.length === 0) return null;

    this.isApplying = true;
    try {
      this.undoStack.push({
        ...currentSnapshot,
        timestamp: Date.now(),
      });

      const next = this.redoStack.pop()!;
      this.notify();
      return next;
    } finally {
      this.isApplying = false;
    }
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

export const globalHistory = new HistoryManager();
