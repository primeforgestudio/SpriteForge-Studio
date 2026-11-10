import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Download,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Grid,
  Hash,
  Film,
  Eye,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { GifEncoder } from '../core/gifEncoder';
import { AtlasBuilder } from '../core/atlasBuilder';

export interface AtlasModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  frames?: HTMLCanvasElement[];
  filename?: string;
  fps?: number;
  columns?: number;
  rows?: number;
  frameWidth?: number;
  frameHeight?: number;
  layoutMode?: 'grid' | 'advanced';
}

type PlaybackMode = 'loop' | 'ping-pong' | 'once';
type BackgroundPreviewMode = 'checkerboard' | 'dark' | 'green' | 'white';

export const AtlasModal: React.FC<AtlasModalProps> = ({
  isOpen,
  onClose,
  canvas,
  frames = [],
  filename = 'atlas_studio',
  fps = 24,
  columns: propCols,
  rows: propRows,
  frameWidth: propFw,
  frameHeight: propFh,
}) => {
  // 1. Navigation & View State for Sheet Canvas
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);

  // Overlay Toggles
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [bgMode, setBgMode] = useState<BackgroundPreviewMode>('checkerboard');

  // 2. Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playerFps, setPlayerFps] = useState(fps || 24);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('loop');
  const [onionSkin, setOnionSkin] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExportingGif, setIsExportingGif] = useState(false);

  // Ping-pong direction: 1 for forward, -1 for reverse
  const pingPongDirRef = useRef<number>(1);
  const lastFrameTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Character preview canvas
  const playerCanvasRef = useRef<HTMLCanvasElement>(null);

  // 3. Grid & Frames Extraction
  const calculatedCols = propCols || Math.max(1, Math.min(8, frames.length || 8));
  const calculatedRows = propRows || Math.ceil((frames.length || 1) / calculatedCols);

  const activeFrames: HTMLCanvasElement[] = useMemo(() => {
    if (frames && frames.length > 0) {
      return frames;
    }
    if (!canvas) return [];

    // Slice cells from canvas if individual frames array wasn't passed
    const cols = calculatedCols;
    const rows = calculatedRows;
    const cellW = propFw || Math.floor(canvas.width / cols);
    const cellH = propFh || Math.floor(canvas.height / rows);

    const extracted: HTMLCanvasElement[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c * cellW >= canvas.width || r * cellH >= canvas.height) continue;
        const cellCanvas = document.createElement('canvas');
        cellCanvas.width = cellW;
        cellCanvas.height = cellH;
        const ctx = cellCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
        }
        extracted.push(cellCanvas);
      }
    }
    return extracted;
  }, [canvas, frames, calculatedCols, calculatedRows, propFw, propFh]);

  const totalFrames = activeFrames.length;

  // Frame enabled mask for Even/Odd/Custom filtering
  const [frameEnabled, setFrameEnabled] = useState<boolean[]>([]);

  useEffect(() => {
    if (totalFrames > 0) {
      setFrameEnabled(new Array(totalFrames).fill(true));
      setCurrentFrameIndex(0);
    }
  }, [totalFrames]);

  const enabledIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < totalFrames; i++) {
      if (frameEnabled[i] ?? true) {
        indices.push(i);
      }
    }
    return indices;
  }, [totalFrames, frameEnabled]);

  // Initial fit to view
  useEffect(() => {
    if (isOpen && canvas && containerRef.current) {
      const containerW = containerRef.current.clientWidth || 800;
      const containerH = containerRef.current.clientHeight || 600;
      const fitScale = Math.min(
        (containerW * 0.85) / canvas.width,
        (containerH * 0.85) / canvas.height
      );
      setScale(Math.max(0.1, Number(fitScale.toFixed(2))));
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, canvas]);

  // Keyboard shortcut listener (Space = play/pause, Esc = close, Left/Right = step)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, totalFrames, enabledIndices]);

  // 4. Playback Animation Engine
  const stepFrame = useCallback((dir: number) => {
    if (enabledIndices.length === 0) return;
    setCurrentFrameIndex((prev) => {
      const currentPos = enabledIndices.indexOf(prev);
      if (currentPos === -1) return enabledIndices[0];
      let nextPos = currentPos + dir;
      if (nextPos >= enabledIndices.length) nextPos = 0;
      if (nextPos < 0) nextPos = enabledIndices.length - 1;
      return enabledIndices[nextPos];
    });
  }, [enabledIndices]);

  useEffect(() => {
    if (!isOpen || !isPlaying || enabledIndices.length === 0) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const intervalMs = 1000 / (Math.max(1, playerFps) * playbackSpeed);

    const loop = (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed >= intervalMs) {
        lastFrameTimeRef.current = timestamp - (elapsed % intervalMs);

        setCurrentFrameIndex((prevIndex) => {
          const pos = enabledIndices.indexOf(prevIndex);
          if (pos === -1) return enabledIndices[0];

          if (playbackMode === 'loop') {
            const nextPos = (pos + 1) % enabledIndices.length;
            return enabledIndices[nextPos];
          } else if (playbackMode === 'ping-pong') {
            let nextPos = pos + pingPongDirRef.current;
            if (nextPos >= enabledIndices.length) {
              pingPongDirRef.current = -1;
              nextPos = Math.max(0, enabledIndices.length - 2);
            } else if (nextPos < 0) {
              pingPongDirRef.current = 1;
              nextPos = Math.min(1, enabledIndices.length - 1);
            }
            return enabledIndices[nextPos];
          } else if (playbackMode === 'once') {
            const nextPos = pos + 1;
            if (nextPos >= enabledIndices.length) {
              setIsPlaying(false);
              return prevIndex;
            }
            return enabledIndices[nextPos];
          }
          return prevIndex;
        });
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen, isPlaying, playerFps, playbackSpeed, playbackMode, enabledIndices]);

  // 5. Render Character Preview Canvas (with optional Onion Skinning)
  useEffect(() => {
    const canvasEl = playerCanvasRef.current;
    if (!canvasEl || activeFrames.length === 0) return;

    const currentFrameCanvas = activeFrames[currentFrameIndex];
    if (!currentFrameCanvas) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    canvasEl.width = currentFrameCanvas.width;
    canvasEl.height = currentFrameCanvas.height;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.imageSmoothingEnabled = false;

    // Onion Skinning
    if (onionSkin && enabledIndices.length > 1) {
      const pos = enabledIndices.indexOf(currentFrameIndex);
      // Previous frame in faint Cyan
      if (pos > 0 || playbackMode === 'loop') {
        const prevIdx = pos > 0 ? enabledIndices[pos - 1] : enabledIndices[enabledIndices.length - 1];
        const prevCanvas = activeFrames[prevIdx];
        if (prevCanvas) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.drawImage(prevCanvas, 0, 0);
          // Tint cyan
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
          ctx.restore();
        }
      }

      // Next frame in faint Orange
      if (pos < enabledIndices.length - 1 || playbackMode === 'loop') {
        const nextIdx = pos < enabledIndices.length - 1 ? enabledIndices[pos + 1] : enabledIndices[0];
        const nextCanvas = activeFrames[nextIdx];
        if (nextCanvas) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(nextCanvas, 0, 0);
          // Tint orange
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = '#ff5c26';
          ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
          ctx.restore();
        }
      }
    }

    // Render active frame crisp on top
    ctx.drawImage(currentFrameCanvas, 0, 0);
  }, [currentFrameIndex, activeFrames, onionSkin, enabledIndices, playbackMode]);

  // 6. Draw Atlas Sheet with Overlays (Grid, Numbers, Active Highlight)
  useEffect(() => {
    const sheetCanvas = sheetCanvasRef.current;
    if (!sheetCanvas || !canvas) return;

    sheetCanvas.width = canvas.width;
    sheetCanvas.height = canvas.height;

    const ctx = sheetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Draw main sheet
    ctx.drawImage(canvas, 0, 0);

    const cols = calculatedCols;
    const rows = calculatedRows;
    const cellW = propFw || Math.floor(canvas.width / cols);
    const cellH = propFh || Math.floor(canvas.height / rows);

    // Draw Grid Lines
    if (showGrid && cols > 0 && rows > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, canvas.height);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(canvas.width, r * cellH);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Cell Number Badges (#0, #1, #2...)
    if (showNumbers && cols > 0 && rows > 0) {
      ctx.save();
      const badgeFontSize = Math.max(9, Math.min(14, Math.floor(cellH * 0.12)));
      ctx.font = `bold ${badgeFontSize}px monospace`;

      let cellIdx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cellIdx >= totalFrames) break;
          const x = c * cellW;
          const y = r * cellH;
          const label = `#${cellIdx}`;
          const isCurrent = cellIdx === currentFrameIndex;
          const isOff = frameEnabled[cellIdx] === false;

          // Background pill
          ctx.fillStyle = isCurrent
            ? 'rgba(255, 92, 38, 0.9)'
            : isOff
            ? 'rgba(0, 0, 0, 0.4)'
            : 'rgba(0, 0, 0, 0.65)';
          const textW = ctx.measureText(label).width;
          ctx.beginPath();
          ctx.roundRect(x + 4, y + 4, textW + 8, badgeFontSize + 6, 4);
          ctx.fill();

          // Text
          ctx.fillStyle = isCurrent ? '#ffffff' : isOff ? '#666666' : 'rgba(255, 255, 255, 0.85)';
          ctx.fillText(label, x + 8, y + badgeFontSize + 3);

          // Dim disabled frames with diagonal strikethrough
          if (isOff) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(x, y, cellW, cellH);
          }

          cellIdx++;
        }
      }
      ctx.restore();
    }

    // Draw Active Selected Frame Outline
    if (cols > 0 && rows > 0 && currentFrameIndex >= 0 && currentFrameIndex < totalFrames) {
      const activeCol = currentFrameIndex % cols;
      const activeRow = Math.floor(currentFrameIndex / cols);
      const ax = activeCol * cellW;
      const ay = activeRow * cellH;

      ctx.save();
      // Outer bright orange highlight border
      ctx.strokeStyle = '#ff5c26';
      ctx.lineWidth = 3;
      ctx.strokeRect(ax + 1.5, ay + 1.5, cellW - 3, cellH - 3);

      // Inner white contrast hairline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(ax + 3, ay + 3, cellW - 6, cellH - 6);
      ctx.restore();
    }
  }, [canvas, showGrid, showNumbers, calculatedCols, calculatedRows, propFw, propFh, currentFrameIndex, totalFrames, frameEnabled]);

  // Click on sheet canvas to select cell
  const handleSheetClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const sheetCanvas = sheetCanvasRef.current;
    if (!sheetCanvas) return;

    const rect = sheetCanvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * sheetCanvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * sheetCanvas.height;

    const cols = calculatedCols;
    const rows = calculatedRows;
    const cellW = propFw || Math.floor(sheetCanvas.width / cols);
    const cellH = propFh || Math.floor(sheetCanvas.height / rows);

    const c = Math.floor(clickX / cellW);
    const r = Math.floor(clickY / cellH);
    const idx = r * cols + c;

    if (idx >= 0 && idx < totalFrames) {
      setCurrentFrameIndex(idx);
    }
  };

  // Zoom / Pan handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => Math.max(0.05, Math.min(16, Number((prev * factor).toFixed(2)))));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleFit = () => {
    if (!canvas || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth || 800;
    const containerH = containerRef.current.clientHeight || 600;
    const fitScale = Math.min(
      (containerW * 0.85) / canvas.width,
      (containerH * 0.85) / canvas.height
    );
    setScale(Math.max(0.05, Number(fitScale.toFixed(2))));
    setPan({ x: 0, y: 0 });
  };

  // Frame Filter Operations
  const handleFilterAll = () => setFrameEnabled(new Array(totalFrames).fill(true));
  const handleFilterNone = () => setFrameEnabled(new Array(totalFrames).fill(false));
  const handleFilterInvert = () => setFrameEnabled((prev) => prev.map((v) => !v));
  const handleFilterEven = () => setFrameEnabled(new Array(totalFrames).fill(false).map((_, i) => i % 2 === 0));
  const handleFilterOdd = () => setFrameEnabled(new Array(totalFrames).fill(false).map((_, i) => i % 2 !== 0));

  // Export Tools
  const handleDownloadSheet = () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDownloadCurrentFrame = () => {
    const f = activeFrames[currentFrameIndex];
    if (!f) return;
    const link = document.createElement('a');
    link.download = `${filename}_frame_${String(currentFrameIndex).padStart(3, '0')}.png`;
    link.href = f.toDataURL('image/png');
    link.click();
  };

  const handleCopyCurrentFrame = async () => {
    const f = activeFrames[currentFrameIndex];
    if (!f) return;
    try {
      f.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      });
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleExportGif = async () => {
    const framesToExport = enabledIndices.map((i) => activeFrames[i]).filter(Boolean);
    if (framesToExport.length === 0) return;

    setIsExportingGif(true);
    try {
      const blob = await GifEncoder.encodeCanvasesToGif(framesToExport, playerFps);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_animated.gif`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GIF export error:', err);
    } finally {
      setIsExportingGif(false);
    }
  };

  if (!isOpen || !canvas) return null;

  const bgStyle =
    bgMode === 'checkerboard'
      ? {
          backgroundImage:
            'linear-gradient(45deg, #181c1a 25%, transparent 25%), linear-gradient(-45deg, #181c1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181c1a 75%), linear-gradient(-45deg, transparent 75%, #181c1a 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#101412',
        }
      : bgMode === 'green'
      ? { backgroundColor: '#00ff00' }
      : bgMode === 'white'
      ? { backgroundColor: '#ffffff' }
      : { backgroundColor: '#0c0e12' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 6, 0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        color: 'var(--text-main)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 1. TOP HEADER BAR */}
      <div
        style={{
          height: 52,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 18, 16, 0.98)',
          zIndex: 20,
        }}
      >
        {/* Title and Metadata Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/icon.png"
            alt="SpriteForge"
            style={{
              width: 22,
              height: 22,
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-bright)' }}>
            ATLAS STUDIO & INSPECTOR
          </span>

          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              background: '#09291b',
              color: '#00e599',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #145938',
              fontWeight: 700,
            }}
          >
            {canvas.width} × {canvas.height} px
          </span>

          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              background: 'rgba(255, 92, 38, 0.12)',
              color: 'var(--accent-orange)',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid rgba(255, 92, 38, 0.3)',
              fontWeight: 600,
            }}
          >
            {totalFrames} Frames ({calculatedCols} × {calculatedRows})
          </span>
        </div>

        {/* View Controls & Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Zoom controls */}
          <button
            onClick={() => setScale((s) => Math.max(0.05, Number((s * 0.8).toFixed(2))))}
            className="btn-icon"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>

          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              minWidth: 44,
              textAlign: 'center',
              color: 'var(--text-bright)',
              fontWeight: 600,
            }}
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => setScale((s) => Math.min(16, Number((s * 1.25).toFixed(2))))}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>

          <button
            onClick={handleFit}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              padding: '0 8px',
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="Fit to Window"
          >
            <Maximize size={12} />
            Fit
          </button>

          <button
            onClick={() => {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              padding: '0 8px',
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="100% 1:1 Pixel Scale"
          >
            <RotateCcw size={12} />
            1:1
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid((g) => !g)}
            style={{
              background: showGrid ? 'rgba(255, 92, 38, 0.15)' : 'var(--bg-card)',
              border: showGrid ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: showGrid ? 'var(--accent-orange)' : 'var(--text-muted)',
              padding: '0 8px',
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
            title="Toggle Grid Lines"
          >
            <Grid size={13} />
            Grid
          </button>

          {/* Cell Number Badges Toggle */}
          <button
            onClick={() => setShowNumbers((n) => !n)}
            style={{
              background: showNumbers ? 'rgba(255, 92, 38, 0.15)' : 'var(--bg-card)',
              border: showNumbers ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: showNumbers ? 'var(--accent-orange)' : 'var(--text-muted)',
              padding: '0 8px',
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="Toggle Frame Number Labels"
          >
            <Hash size={13} />
            Labels
          </button>

          {/* Background switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-card)',
              borderRadius: 5,
              border: '1px solid var(--border-subtle)',
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => setBgMode('checkerboard')}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                border: bgMode === 'checkerboard' ? '1px solid #ff5c26' : '1px solid transparent',
                background: '#1a1f1d',
                cursor: 'pointer',
              }}
              title="Checkerboard BG"
            />
            <button
              onClick={() => setBgMode('dark')}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                border: bgMode === 'dark' ? '1px solid #ff5c26' : '1px solid transparent',
                background: '#0c0e12',
                cursor: 'pointer',
              }}
              title="Dark BG"
            />
            <button
              onClick={() => setBgMode('green')}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                border: bgMode === 'green' ? '1px solid #ff5c26' : '1px solid transparent',
                background: '#00ff00',
                cursor: 'pointer',
              }}
              title="Green Chroma BG"
            />
            <button
              onClick={() => setBgMode('white')}
              style={{
                width: 22,
                height: 22,
                borderRadius: 3,
                border: bgMode === 'white' ? '1px solid #ff5c26' : '1px solid transparent',
                background: '#ffffff',
                cursor: 'pointer',
              }}
              title="White BG"
            />
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              borderRadius: 6,
              color: '#ffffff',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e63946';
              e.currentTarget.style.borderColor = '#ff4d4d';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(230, 57, 70, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            }}
            title="Close Atlas View (Esc)"
          >
            <X size={18} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* 2. MAIN BODY (SPLIT VIEW: Interactive Sheet Left + Playback Sidebar Right) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT / CENTER: Interactive Zoom & Pan Sheet Canvas */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...bgStyle,
          }}
        >
          <canvas
            ref={sheetCanvasRef}
            onClick={handleSheetClick}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              imageRendering: 'pixelated',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
          />

          {/* Quick HUD on bottom left of canvas */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              background: 'rgba(10, 14, 12, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none',
            }}
          >
            <span>Click any cell to inspect</span>
            <span>•</span>
            <span>Wheel to zoom</span>
            <span>•</span>
            <span>Drag to pan</span>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Live Playback Studio Panel */}
        <div
          style={{
            width: 330,
            background: '#121417',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Section: Playback Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Film size={14} color="var(--accent-orange)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-bright)' }}>Live Playback</span>
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: 'var(--accent-orange)',
                fontWeight: 700,
                background: 'rgba(255, 92, 38, 0.1)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              Frame {currentFrameIndex} / {Math.max(0, totalFrames - 1)}
            </span>
          </div>

          {/* Character Live Preview Box */}
          <div
            style={{
              margin: '12px 16px 8px 16px',
              height: 220,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              ...bgStyle,
            }}
          >
            <canvas
              ref={playerCanvasRef}
              style={{
                maxWidth: '92%',
                maxHeight: '92%',
                objectFit: 'contain',
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
              }}
            />

            {/* Ghost onion skin active badge */}
            {onionSkin && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  fontSize: 9,
                  background: 'rgba(0, 229, 255, 0.2)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontWeight: 700,
                }}
              >
                ONION SKIN
              </div>
            )}
          </div>

          {/* Primary Transport Controls */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Scrubber slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalFrames - 1)}
                value={currentFrameIndex}
                onChange={(e) => {
                  setCurrentFrameIndex(Number(e.target.value));
                  setIsPlaying(false);
                }}
                style={{ width: '100%', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>0</span>
                <span>{((currentFrameIndex / Math.max(1, playerFps))).toFixed(2)}s</span>
                <span>{Math.max(0, totalFrames - 1)}</span>
              </div>
            </div>

            {/* Play / Step Buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => stepFrame(-1)}
                style={{
                  flex: 1,
                  height: 32,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 6,
                  color: 'var(--text-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Previous Frame (Left Arrow)"
              >
                <SkipBack size={13} />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                style={{
                  flex: 2,
                  height: 32,
                  background: isPlaying ? '#ff5c26' : '#2B2D37',
                  border: isPlaying ? '1px solid #ff5c26' : '1px solid #3d4050',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: isPlaying ? '0 0 12px rgba(255, 92, 38, 0.4)' : 'none',
                }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={() => stepFrame(1)}
                style={{
                  flex: 1,
                  height: 32,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 6,
                  color: 'var(--text-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Next Frame (Right Arrow)"
              >
                <SkipForward size={13} />
              </button>
            </div>
          </div>

          {/* Section: Mode & FPS Controls */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Playback Mode (Loop / Ping-Pong / Once) */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Playback Mode</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['loop', 'ping-pong', 'once'] as PlaybackMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPlaybackMode(m)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 4,
                      textTransform: 'capitalize',
                      background: playbackMode === m ? '#ff5c26' : '#2B2D37',
                      color: playbackMode === m ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'ping-pong' ? 'Ping-Pong' : m}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS Selector Slider & Quick Buttons */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: 'var(--text-muted)' }}>Playback FPS</span>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {playerFps} fps
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={playerFps}
                onChange={(e) => setPlayerFps(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[8, 12, 15, 24, 30, 60].map((f) => (
                  <button
                    key={f}
                    onClick={() => setPlayerFps(f)}
                    style={{
                      flex: 1,
                      padding: '2px 0',
                      fontSize: 9,
                      borderRadius: 3,
                      background: playerFps === f ? 'rgba(255, 92, 38, 0.2)' : '#1e2126',
                      border: playerFps === f ? '1px solid #ff5c26' : '1px solid transparent',
                      color: playerFps === f ? '#ff5c26' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Multiplier & Onion Skin Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  style={{
                    background: '#2B2D37',
                    border: '1px solid #3d4050',
                    color: 'var(--text-bright)',
                    borderRadius: 4,
                    fontSize: 10,
                    padding: '2px 4px',
                    cursor: 'pointer',
                  }}
                >
                  <option value={0.25}>0.25x</option>
                  <option value={0.5}>0.5x</option>
                  <option value={1.0}>1.0x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2.0}>2.0x</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onionSkin}
                  onChange={(e) => setOnionSkin(e.target.checked)}
                  style={{ accentColor: '#00e5ff' }}
                />
                <span style={{ color: onionSkin ? '#00e5ff' : 'var(--text-muted)', fontWeight: 500 }}>Onion Skin</span>
              </label>
            </div>
          </div>

          {/* Section: Timeline Filmstrip & Frame Filters */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-bright)' }}>Frame Filters</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Active: {enabledIndices.length} / {totalFrames}
              </span>
            </div>

            {/* Quick Action Filter Buttons (All, None, Invert, Even, Odd) */}
            <div style={{ display: 'flex', gap: 3 }}>
              <button
                onClick={handleFilterAll}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 4,
                  color: 'var(--text-bright)',
                  cursor: 'pointer',
                }}
                title="Enable all frames"
              >
                All
              </button>
              <button
                onClick={handleFilterNone}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                title="Deselect all"
              >
                None
              </button>
              <button
                onClick={handleFilterInvert}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 4,
                  color: 'var(--text-bright)',
                  cursor: 'pointer',
                }}
                title="Invert selection"
              >
                Invert
              </button>
              <button
                onClick={handleFilterEven}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 4,
                  color: '#00e599',
                  cursor: 'pointer',
                }}
                title="Keep only even frames (0, 2, 4...) - 2x downsampling"
              >
                Even
              </button>
              <button
                onClick={handleFilterOdd}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  background: '#2B2D37',
                  border: '1px solid #3d4050',
                  borderRadius: 4,
                  color: '#00e599',
                  cursor: 'pointer',
                }}
                title="Keep only odd frames (1, 3, 5...)"
              >
                Odd
              </button>
            </div>

            {/* Horizontal Filmstrip of Frames */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                overflowX: 'auto',
                padding: '6px 2px',
                background: '#0a0c0e',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.06)',
                maxHeight: 64,
              }}
            >
              {activeFrames.map((f, idx) => {
                const isSelected = idx === currentFrameIndex;
                const isOff = frameEnabled[idx] === false;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCurrentFrameIndex(idx);
                      setIsPlaying(false);
                    }}
                    onDoubleClick={() => {
                      setFrameEnabled((prev) => {
                        const next = [...prev];
                        next[idx] = !next[idx];
                        return next;
                      });
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative',
                      border: isSelected ? '2px solid #ff5c26' : '1px solid rgba(255,255,255,0.1)',
                      opacity: isOff ? 0.35 : 1,
                      cursor: 'pointer',
                      background: '#15181c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={`Frame #${idx} (Double-click to toggle)`}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 1,
                        left: 2,
                        fontSize: 8,
                        fontFamily: 'monospace',
                        color: isSelected ? '#ff5c26' : 'rgba(255,255,255,0.7)',
                        fontWeight: 700,
                        zIndex: 2,
                      }}
                    >
                      {idx}
                    </span>
                    <img
                      src={f.toDataURL()}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Export & Copy Actions */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Export Full Atlas PNG */}
            <button
              onClick={handleDownloadSheet}
              style={{
                width: '100%',
                height: 34,
                background: 'var(--accent-orange)',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              <span>Download Atlas PNG</span>
            </button>

            {/* Export Animated GIF */}
            <button
              onClick={handleExportGif}
              disabled={isExportingGif}
              style={{
                width: '100%',
                height: 32,
                background: '#2B2D37',
                border: '1px solid #3d4050',
                borderRadius: 6,
                color: '#00e5ff',
                fontWeight: 600,
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <Film size={13} />
              <span>{isExportingGif ? 'Rendering GIF...' : 'Export Animated GIF'}</span>
            </button>

            {/* Copy Active Frame to Clipboard */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleCopyCurrentFrame}
                style={{
                  flex: 1,
                  height: 30,
                  background: '#1a1d23',
                  border: '1px solid #2d313b',
                  borderRadius: 5,
                  color: copiedToast ? '#00e599' : 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                {copiedToast ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedToast ? 'Copied!' : 'Copy Frame'}</span>
              </button>

              <button
                onClick={handleDownloadCurrentFrame}
                style={{
                  flex: 1,
                  height: 30,
                  background: '#1a1d23',
                  border: '1px solid #2d313b',
                  borderRadius: 5,
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <Download size={11} />
                <span>Save Frame</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
