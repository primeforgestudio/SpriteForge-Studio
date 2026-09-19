import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BackgroundMode, GarbageMatteSettings, CollisionSettings } from '../core/types';
import { Plus, Minus, RotateCcw, Maximize2, Pipette, Crosshair, Layers, Scissors, Shield } from 'lucide-react';

interface ViewportProps {
  frameCanvas: HTMLCanvasElement | null;
  bgMode: BackgroundMode;
  setBgMode: (mode: BackgroundMode) => void;
  bgColor: [number, number, number];
  setBgColor: (color: [number, number, number]) => void;
  isEyedropperActive: boolean;
  setIsEyedropperActive: (active: boolean) => void;
  onPickColor: (color: [number, number, number]) => void;
  onFilesDropped: (files: FileList) => void;
  emptyMessage?: string;
  hasMedia: boolean;
  showMask?: boolean;
  setShowMask?: (show: boolean) => void;
  // Pivot
  pivot?: { x: number; y: number };
  onUpdatePivot?: (pivot: { x: number; y: number }) => void;
  showPivot?: boolean;
  setShowPivot?: (show: boolean) => void;
  // Onion Skinning
  enableOnionSkin?: boolean;
  setEnableOnionSkin?: (enabled: boolean) => void;
  onionGhosts?: { prev?: HTMLCanvasElement | null; next?: HTMLCanvasElement | null } | null;
  enableGroundSnap?: boolean;
  // Garbage Matte (Cutout)
  garbageMatte?: GarbageMatteSettings;
  onUpdateGarbageMatte?: (matte: GarbageMatteSettings) => void;
  showGarbageMatte?: boolean;
  setShowGarbageMatte?: (show: boolean) => void;
  // Godot 4 Colliders
  collisionSettings?: CollisionSettings;
  onUpdateCollisionSettings?: (settings: CollisionSettings) => void;
  showColliders?: boolean;
  setShowColliders?: (show: boolean) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  frameCanvas,
  bgMode,
  setBgMode,
  bgColor,
  setBgColor,
  isEyedropperActive,
  setIsEyedropperActive,
  onPickColor,
  onFilesDropped,
  emptyMessage = 'Drop Video or PNG Sequence here',
  hasMedia,
  showMask = false,
  setShowMask,
  pivot = { x: 0.5, y: 0.95 },
  onUpdatePivot,
  showPivot = false,
  setShowPivot,
  enableOnionSkin = false,
  setEnableOnionSkin,
  onionGhosts,
  enableGroundSnap = false,
  garbageMatte,
  onUpdateGarbageMatte,
  showGarbageMatte = false,
  setShowGarbageMatte,
  collisionSettings,
  onUpdateCollisionSettings,
  showColliders = false,
  setShowColliders,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverColor, setHoverColor] = useState<[number, number, number] | null>(null);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  // Garbage Matte Dragging State
  type MatteHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const [activeMatteHandle, setActiveMatteHandle] = useState<MatteHandle | null>(null);
  const matteDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialMatte: { x: number; y: number; width: number; height: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialMatte: { x: 0, y: 0, width: 1, height: 1 },
  });

  const handleMatteMouseDown = (e: React.MouseEvent, handle: MatteHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const cur = garbageMatte || { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
    matteDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialMatte: { x: cur.x, y: cur.y, width: cur.width, height: cur.height },
    };
    setActiveMatteHandle(handle);
  };

  // Global mouse handlers for Garbage Matte dragging/resizing
  useEffect(() => {
    if (!activeMatteHandle || !onUpdateGarbageMatte) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasWrapperRef.current) return;
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dx = (e.clientX - matteDragStartRef.current.clientX) / rect.width;
      const dy = (e.clientY - matteDragStartRef.current.clientY) / rect.height;
      const init = matteDragStartRef.current.initialMatte;

      const curMatte = garbageMatte ?? {
        enabled: true,
        x: 0.05,
        y: 0.05,
        width: 0.9,
        height: 0.9,
        feather: 2,
        invert: false,
      };

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      const MIN_SIZE = 0.02;

      if (activeMatteHandle === 'move') {
        newX = Math.max(0, Math.min(1 - newW, init.x + dx));
        newY = Math.max(0, Math.min(1 - newH, init.y + dy));
      } else {
        // Horizontal resizing
        if (activeMatteHandle === 'w' || activeMatteHandle === 'nw' || activeMatteHandle === 'sw') {
          const maxLeft = init.x + init.width - MIN_SIZE;
          newX = Math.max(0, Math.min(maxLeft, init.x + dx));
          newW = init.x + init.width - newX;
        } else if (activeMatteHandle === 'e' || activeMatteHandle === 'ne' || activeMatteHandle === 'se') {
          newW = Math.max(MIN_SIZE, Math.min(1 - init.x, init.width + dx));
        }

        // Vertical resizing
        if (activeMatteHandle === 'n' || activeMatteHandle === 'nw' || activeMatteHandle === 'ne') {
          const maxTop = init.y + init.height - MIN_SIZE;
          newY = Math.max(0, Math.min(maxTop, init.y + dy));
          newH = init.y + init.height - newY;
        } else if (activeMatteHandle === 's' || activeMatteHandle === 'sw' || activeMatteHandle === 'se') {
          newH = Math.max(MIN_SIZE, Math.min(1 - init.y, init.height + dy));
        }
      }

      onUpdateGarbageMatte({
        ...curMatte,
        enabled: true,
        x: Math.round(newX * 1000) / 1000,
        y: Math.round(newY * 1000) / 1000,
        width: Math.round(newW * 1000) / 1000,
        height: Math.round(newH * 1000) / 1000,
      });
    };

    const handleMouseUp = () => {
      setActiveMatteHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeMatteHandle, garbageMatte, onUpdateGarbageMatte]);

  const handlePivotMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPivot(true);
  };

  // Global mouse handlers for Pivot dragging
  useEffect(() => {
    if (!isDraggingPivot) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasWrapperRef.current || !onUpdatePivot) return;
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onUpdatePivot({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    };

    const handleMouseUp = () => {
      setIsDraggingPivot(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPivot, onUpdatePivot]);

  // Global mouse handlers for Collider & Hitbox dragging/resizing
  type ColliderType = 'feet' | 'hurtbox' | 'hitbox';
  type ColliderDragMode = 'move' | 'resize';
  const [activeColliderType, setActiveColliderType] = useState<ColliderType | null>(null);
  const [activeColliderDragMode, setActiveColliderDragMode] = useState<ColliderDragMode | null>(null);
  const colliderDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialBox: { width: number; height: number; offsetX: number; offsetY: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialBox: { width: 0, height: 0, offsetX: 0, offsetY: 0 },
  });

  const handleColliderMouseDown = (e: React.MouseEvent, type: ColliderType, mode: ColliderDragMode) => {
    e.stopPropagation();
    e.preventDefault();
    if (!collisionSettings) return;
    const box = collisionSettings[type];
    colliderDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: {
        width: box.width,
        height: box.height,
        offsetX: box.offsetX,
        offsetY: box.offsetY,
      },
    };
    setActiveColliderType(type);
    setActiveColliderDragMode(mode);
  };

  useEffect(() => {
    if (!activeColliderType || !activeColliderDragMode || !onUpdateCollisionSettings || !collisionSettings) return;

    const handleMouseMove = (e: MouseEvent) => {
      const init = colliderDragStartRef.current.initialBox;
      const dx = (e.clientX - colliderDragStartRef.current.clientX) / zoom;
      const dy = (e.clientY - colliderDragStartRef.current.clientY) / zoom;

      const currentTarget = { ...collisionSettings[activeColliderType] };

      if (activeColliderDragMode === 'move') {
        currentTarget.offsetX = Math.round(init.offsetX + dx);
        currentTarget.offsetY = Math.round(init.offsetY + dy);
      } else {
        // resize: dragging changes width & height
        currentTarget.width = Math.max(8, Math.round(init.width + dx * 2));
        currentTarget.height = Math.max(6, Math.round(init.height + dy * 2));
      }

      onUpdateCollisionSettings({
        ...collisionSettings,
        [activeColliderType]: currentTarget,
      });
    };

    const handleMouseUp = () => {
      setActiveColliderType(null);
      setActiveColliderDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeColliderType, activeColliderDragMode, collisionSettings, onUpdateCollisionSettings, zoom]);

  const render = useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !frameCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== frameCanvas.width || canvas.height !== frameCanvas.height) {
      canvas.width = frameCanvas.width;
      canvas.height = frameCanvas.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showMask) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgMode === 'solid') {
      ctx.fillStyle = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Onion Skinning: render previous (coral) and next (cyan) keyframe ghosts
    if (!showMask && enableOnionSkin && onionGhosts) {
      if (onionGhosts.prev) {
        ctx.drawImage(onionGhosts.prev, 0, 0);
      }
      if (onionGhosts.next) {
        ctx.drawImage(onionGhosts.next, 0, 0);
      }
    }

    ctx.drawImage(frameCanvas, 0, 0);
  }, [frameCanvas, bgMode, bgColor, showMask, enableOnionSkin, onionGhosts]);

  useEffect(() => {
    render();
  }, [render]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.1, Math.min(10.0, prev * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEyedropperActive) {
      pickColorAtEvent(e);
      setIsEyedropperActive(false);
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    if (isEyedropperActive && frameCanvas) {
      const color = sampleColorAtEvent(e);
      setHoverColor(color);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const sampleColorAtEvent = (e: React.MouseEvent): [number, number, number] | null => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  };

  const pickColorAtEvent = (e: React.MouseEvent) => {
    const color = sampleColorAtEvent(e);
    if (color) {
      onPickColor(color);
    }
  };

  const handleReset = () => {
    setZoom(0.5);
    setPan({ x: 0, y: 0 });
  };

  const handleFit = () => {
    if (!containerRef.current || !frameCanvas) return;
    const containerW = containerRef.current.clientWidth - 40;
    const containerH = containerRef.current.clientHeight - 40;
    const scaleW = containerW / frameCanvas.width;
    const scaleH = containerH / frameCanvas.height;
    setZoom(Math.min(scaleW, scaleH, 1.0));
    setPan({ x: 0, y: 0 });
  };

  // Background selector helper
  const isPresetActive = (type: 'grid' | 'green' | 'black' | 'white') => {
    if (type === 'grid') return bgMode === 'checkerboard';
    if (bgMode !== 'solid') return false;
    if (type === 'green') return bgColor[1] > 180 && bgColor[0] < 100;
    if (type === 'black') return bgColor[0] === 0 && bgColor[1] === 0 && bgColor[2] === 0;
    if (type === 'white') return bgColor[0] === 255 && bgColor[1] === 255 && bgColor[2] === 255;
    return false;
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) onFilesDropped(e.dataTransfer.files);
      }}
      style={{
        flex: 1,
        position: 'relative',
        background: '#0d1311',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isEyedropperActive ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Top-Left Floating Zoom Controls (from screenshot) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(19, 25, 23, 0.92)',
          padding: '3px 4px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.25))}
          style={{ background: 'transparent', border: 'none', padding: '4px 6px', color: 'var(--text-main)' }}
          title="Zoom In"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))}
          style={{ background: 'transparent', border: 'none', padding: '4px 6px', color: 'var(--text-main)' }}
          title="Zoom Out"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleReset}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            color: 'var(--text-main)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="50% Zoom"
        >
          <RotateCcw size={11} style={{ marginRight: 4 }} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleFit}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            color: 'var(--text-main)',
            fontSize: 11,
            fontWeight: 600,
          }}
          title="Fit to Screen"
        >
          <Maximize2 size={11} style={{ marginRight: 4 }} />
          Fit
        </button>

        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 2px' }} />

        {/* Eyedropper Button */}
        <button
          onClick={() => setIsEyedropperActive(!isEyedropperActive)}
          style={{
            background: isEyedropperActive ? 'var(--accent-green)' : 'transparent',
            color: isEyedropperActive ? '#000' : 'var(--text-main)',
            border: 'none',
            padding: '4px 6px',
            borderRadius: 4,
          }}
          title="Eyedropper (Pick Chroma Key Color)"
        >
          <Pipette size={13} />
        </button>

        {showPivot && onUpdatePivot && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 2px' }} />
            <button
              onClick={() => onUpdatePivot({ x: 0.5, y: 0.95 })}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent-green)',
                cursor: 'pointer',
                borderRadius: 4,
              }}
              title="Snap Pivot to Feet (Bottom-Center: 50%, 95%)"
            >
              Snap Feet
            </button>
            <button
              onClick={() => onUpdatePivot({ x: 0.5, y: 0.5 })}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 6px',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: 4,
              }}
              title="Snap Pivot to Center (50%, 50%)"
            >
              Snap Center
            </button>
          </>
        )}
      </div>

      {/* Top-Right Floating Background Presets (from screenshot) */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'rgba(19, 25, 23, 0.92)',
          padding: '3px 4px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => setBgMode('checkerboard')}
          style={{
            background: isPresetActive('grid') ? '#26332e' : 'transparent',
            color: isPresetActive('grid') ? '#fff' : 'var(--text-muted)',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 5,
            fontWeight: 600,
          }}
        >
          Grid
        </button>

        <button
          onClick={() => {
            setBgMode('solid');
            setBgColor([0, 240, 132]);
          }}
          style={{
            background: isPresetActive('green') ? 'var(--accent-green)' : 'transparent',
            color: isPresetActive('green') ? '#000000' : 'var(--text-muted)',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 5,
            fontWeight: 700,
          }}
        >
          Green
        </button>

        <button
          onClick={() => {
            setBgMode('solid');
            setBgColor([0, 0, 0]);
          }}
          style={{
            background: isPresetActive('black') ? '#000000' : 'transparent',
            color: isPresetActive('black') ? '#fff' : 'var(--text-muted)',
            border: isPresetActive('black') ? '1px solid #444' : 'none',
            padding: '4px 10px',
            borderRadius: 5,
            fontWeight: 600,
          }}
        >
          Black
        </button>

        <button
          onClick={() => {
            setBgMode('solid');
            setBgColor([255, 255, 255]);
          }}
          style={{
            background: isPresetActive('white') ? '#ffffff' : 'transparent',
            color: isPresetActive('white') ? '#000000' : 'var(--text-muted)',
            border: 'none',
            padding: '4px 10px',
            borderRadius: 5,
            fontWeight: 700,
          }}
        >
          White
        </button>

        {setShowMask && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 2px' }} />
            <button
              onClick={() => setShowMask(!showMask)}
              style={{
                background: showMask ? 'var(--accent-cyan)' : 'transparent',
                color: showMask ? '#000000' : 'var(--text-muted)',
                border: showMask ? '1px solid var(--accent-cyan)' : 'none',
                padding: '4px 8px',
                borderRadius: 5,
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
              title="Toggle Alpha Mask / Matte inspection"
            >
              Mask
            </button>
          </>
        )}

        {setEnableOnionSkin && (
          <button
            onClick={() => setEnableOnionSkin(!enableOnionSkin)}
            style={{
              background: enableOnionSkin ? '#ff5252' : 'transparent',
              color: enableOnionSkin ? '#ffffff' : 'var(--text-muted)',
              border: enableOnionSkin ? '1px solid #ff5252' : 'none',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Onion Skinning: overlay previous frame (coral red) and next frame (cyan)"
          >
            <Layers size={11} />
            Onion
          </button>
        )}

        {setShowPivot && (
          <button
            onClick={() => setShowPivot(!showPivot)}
            style={{
              background: showPivot ? 'var(--accent-green)' : 'transparent',
              color: showPivot ? '#000000' : 'var(--text-muted)',
              border: showPivot ? '1px solid var(--accent-green)' : 'none',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Toggle Interactive Pivot Point (for Godot 4 and Unity)"
          >
            <Crosshair size={11} />
            Pivot
          </button>
        )}

        {setShowGarbageMatte && (
          <button
            onClick={() => {
              const next = !showGarbageMatte;
              setShowGarbageMatte(next);
              if (next && onUpdateGarbageMatte && !garbageMatte?.enabled) {
                onUpdateGarbageMatte({
                  enabled: true,
                  x: garbageMatte?.x ?? 0.05,
                  y: garbageMatte?.y ?? 0.05,
                  width: garbageMatte?.width ?? 0.9,
                  height: garbageMatte?.height ?? 0.9,
                  feather: garbageMatte?.feather ?? 2,
                  invert: garbageMatte?.invert ?? false,
                });
              }
            }}
            style={{
              background: showGarbageMatte ? '#f59e0b' : 'transparent',
              color: showGarbageMatte ? '#000000' : 'var(--text-muted)',
              border: showGarbageMatte ? '1px solid #f59e0b' : 'none',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Garbage Matte: interactive cutout bounds for AI watermarks and edge artifacts"
          >
            <Scissors size={11} />
            Matte
          </button>
        )}

        {setShowColliders && (
          <button
            onClick={() => setShowColliders(!showColliders)}
            style={{
              background: showColliders ? '#00b0ff' : 'transparent',
              color: showColliders ? '#000000' : 'var(--text-muted)',
              border: showColliders ? '1px solid #00b0ff' : 'none',
              padding: '4px 8px',
              borderRadius: 5,
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Toggle Godot 4 Physics Feet Collider, Hurtbox & Hitbox overlay"
          >
            <Shield size={11} />
            Colliders
          </button>
        )}
      </div>

      {/* Eyedropper Hover Tooltip */}
      {isEyedropperActive && hoverColor && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(15, 20, 18, 0.95)',
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              backgroundColor: `rgb(${hoverColor[0]},${hoverColor[1]},${hoverColor[2]})`,
              border: '1px solid #fff',
            }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-bright)' }}>
            RGB({hoverColor[0]}, {hoverColor[1]}, {hoverColor[2]})
          </span>
        </div>
      )}

      {/* Canvas or Empty State */}
      {!hasMedia ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: 'var(--text-muted)',
            border: '2px dashed var(--border-medium)',
            borderRadius: 12,
            padding: '50px 80px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-bright)', fontWeight: 600 }}>
            {emptyMessage}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Drag and drop media files or click "Load media"
          </div>
        </div>
      ) : (
        <div
          ref={canvasWrapperRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            borderRadius: 4,
            overflow: 'visible',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            position: 'relative',
          }}
          className={bgMode === 'checkerboard' ? 'checkerboard' : ''}
        >
          <canvas ref={displayCanvasRef} style={{ display: 'block', borderRadius: 4 }} />

          {/* Interactive Pivot Reticle */}
          {showPivot && pivot && (
            <div
              onMouseDown={handlePivotMouseDown}
              style={{
                position: 'absolute',
                left: `${pivot.x * 100}%`,
                top: `${pivot.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
                cursor: isDraggingPivot ? 'grabbing' : 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={`Pivot: (${Math.round(pivot.x * 100)}%, ${Math.round(pivot.y * 100)}%). Drag to move.`}
            >
              {/* Outer Target Circle */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: '2px solid var(--accent-green)',
                  backgroundColor: 'rgba(0, 240, 132, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(0,240,132,0.6)',
                  position: 'relative',
                }}
              >
                {/* Horizontal Crosshair */}
                <div
                  style={{
                    position: 'absolute',
                    width: 38,
                    height: 1.5,
                    background: 'var(--accent-green)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Vertical Crosshair */}
                <div
                  style={{
                    position: 'absolute',
                    height: 38,
                    width: 1.5,
                    background: 'var(--accent-green)',
                    pointerEvents: 'none',
                  }}
                />
                {/* Center Dot */}
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#ffffff',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Floating Tag */}
              <div
                style={{
                  position: 'absolute',
                  top: 28,
                  background: 'rgba(10, 15, 13, 0.92)',
                  border: '1px solid var(--accent-green)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: 'var(--accent-green)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
              >
                {Math.round(pivot.x * 100)}%, {Math.round(pivot.y * 100)}%
              </div>
            </div>
          )}

          {/* Ground Baseline Guideline (Active when Ground Snap is enabled) */}
          {enableGroundSnap && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(pivot?.y ?? 0.95) * 100}%`,
                height: 1,
                borderTop: '1.5px dashed rgba(0, 240, 132, 0.7)',
                pointerEvents: 'none',
                zIndex: 25,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 2,
                  fontSize: 8,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  color: 'var(--accent-green)',
                  background: 'rgba(10, 15, 13, 0.85)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid rgba(0, 240, 132, 0.3)',
                }}
              >
                GROUND BASELINE
              </span>
            </div>
          )}

          {/* Garbage Matte (Cutout) Gizmo & Dimmed Outer Regions */}
          {showGarbageMatte && (
            <>
              {/* 4 Dimmed Outer Regions (Hatched) */}
              {/* Top strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Bottom strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${((garbageMatte?.y ?? 0.05) + (garbageMatte?.height ?? 0.9)) * 100}%`,
                  width: '100%',
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Left strip */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  width: `${(garbageMatte?.x ?? 0.05) * 100}%`,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />
              {/* Right strip */}
              <div
                style={{
                  position: 'absolute',
                  left: `${((garbageMatte?.x ?? 0.05) + (garbageMatte?.width ?? 0.9)) * 100}%`,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  right: 0,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px)',
                  pointerEvents: 'none',
                  zIndex: 22,
                }}
              />

              {/* The Interactive Bounding Box */}
              <div
                onMouseDown={(e) => handleMatteMouseDown(e, 'move')}
                style={{
                  position: 'absolute',
                  left: `${(garbageMatte?.x ?? 0.05) * 100}%`,
                  top: `${(garbageMatte?.y ?? 0.05) * 100}%`,
                  width: `${(garbageMatte?.width ?? 0.9) * 100}%`,
                  height: `${(garbageMatte?.height ?? 0.9) * 100}%`,
                  border: '2px dashed #f59e0b',
                  boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), inset 0 0 16px rgba(245, 158, 11, 0.08)',
                  cursor: activeMatteHandle === 'move' ? 'grabbing' : 'grab',
                  zIndex: 24,
                  userSelect: 'none',
                }}
                title="Garbage Matte (Cutout) Bounds. Drag to move box, drag handles to resize."
              >
                {/* Matte Info Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: -22,
                    left: 0,
                    background: 'rgba(15, 20, 18, 0.92)',
                    border: '1px solid #f59e0b',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#f59e0b',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>
                    ✂️ MATTE {Math.round((garbageMatte?.width ?? 0.9) * 100)}% ×{' '}
                    {Math.round((garbageMatte?.height ?? 0.9) * 100)}%
                  </span>
                  {garbageMatte?.invert && <span style={{ color: '#ff5252' }}>[INV]</span>}
                  {garbageMatte?.feather ? <span>(F:{garbageMatte.feather}px)</span> : null}
                </div>

                {/* 8 Resize Handles */}
                {[
                  { id: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
                  { id: 'n', left: '50%', top: 0, cursor: 'ns-resize' },
                  { id: 'ne', left: '100%', top: 0, cursor: 'nesw-resize' },
                  { id: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
                  { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
                  { id: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
                  { id: 'sw', left: 0, top: '100%', cursor: 'nesw-resize' },
                  { id: 'w', left: 0, top: '50%', cursor: 'ew-resize' },
                ].map((h) => (
                  <div
                    key={h.id}
                    onMouseDown={(e) => handleMatteMouseDown(e, h.id as any)}
                    style={{
                      position: 'absolute',
                      left: h.left,
                      top: h.top,
                      width: 10,
                      height: 10,
                      marginLeft: -5,
                      marginTop: -5,
                      borderRadius: 2,
                      background: '#f59e0b',
                      border: '1.5px solid #ffffff',
                      boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                      cursor: h.cursor,
                      zIndex: 26,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Godot 4 Colliders & Combat Hitboxes Overlay */}
          {showColliders && collisionSettings && (
            <>
              {/* 1. Feet Collider (Physics Ground Collision) */}
              {collisionSettings.feet.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'feet', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.feet.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.feet.offsetY}px)`,
                    width: collisionSettings.feet.width,
                    height: collisionSettings.feet.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: collisionSettings.feet.shape === 'capsule' ? 9999 : 3,
                    border: '1.5px solid #00f084',
                    backgroundColor: 'rgba(0, 240, 132, 0.25)',
                    boxShadow: '0 0 10px rgba(0, 240, 132, 0.4)',
                    cursor:
                      activeColliderType === 'feet' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 32,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Feet CollisionShape2D (Floor & Wall Physics). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(10, 20, 15, 0.9)',
                      border: '1px solid #00f084',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#00f084',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    FEET ({collisionSettings.feet.width}×{collisionSettings.feet.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'feet', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#00f084',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}

              {/* 2. Hurtbox (Body Damage Vulnerability Zone) */}
              {collisionSettings.hurtbox.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'hurtbox', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.hurtbox.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.hurtbox.offsetY}px)`,
                    width: collisionSettings.hurtbox.width,
                    height: collisionSettings.hurtbox.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 9999,
                    border: '1.5px dashed #00b0ff',
                    backgroundColor: 'rgba(0, 176, 255, 0.16)',
                    boxShadow: '0 0 10px rgba(0, 176, 255, 0.3)',
                    cursor:
                      activeColliderType === 'hurtbox' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 31,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Hurtbox Area2D (Body Damage Zone). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(10, 18, 25, 0.9)',
                      border: '1px solid #00b0ff',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#00b0ff',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    HURTBOX ({collisionSettings.hurtbox.width}×{collisionSettings.hurtbox.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'hurtbox', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#00b0ff',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}

              {/* 3. Hitbox (Attack Weapon Strike Zone) */}
              {collisionSettings.hitbox.enabled && (
                <div
                  onMouseDown={(e) => handleColliderMouseDown(e, 'hitbox', 'move')}
                  style={{
                    position: 'absolute',
                    left: `calc(${pivot.x * 100}% + ${collisionSettings.hitbox.offsetX}px)`,
                    top: `calc(${pivot.y * 100}% + ${collisionSettings.hitbox.offsetY}px)`,
                    width: collisionSettings.hitbox.width,
                    height: collisionSettings.hitbox.height,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 4,
                    border: '1.5px solid #ff3366',
                    backgroundColor: 'rgba(255, 51, 102, 0.22)',
                    boxShadow: '0 0 10px rgba(255, 51, 102, 0.4)',
                    cursor:
                      activeColliderType === 'hitbox' && activeColliderDragMode === 'move'
                        ? 'grabbing'
                        : 'grab',
                    zIndex: 33,
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Hitbox Area2D (Weapon Attack Strike Zone). Drag to move, drag handle to resize."
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: -16,
                      background: 'rgba(25, 10, 15, 0.9)',
                      border: '1px solid #ff3366',
                      borderRadius: 3,
                      padding: '1px 4px',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#ff3366',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    HITBOX ({collisionSettings.hitbox.width}×{collisionSettings.hitbox.height})
                  </span>
                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => handleColliderMouseDown(e, 'hitbox', 'resize')}
                    style={{
                      position: 'absolute',
                      right: -3,
                      bottom: -3,
                      width: 7,
                      height: 7,
                      background: '#ff3366',
                      border: '1px solid #fff',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
