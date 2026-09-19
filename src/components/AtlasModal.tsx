import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, RotateCcw, Download } from 'lucide-react';

interface AtlasModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  filename?: string;
}

export const AtlasModal: React.FC<AtlasModalProps> = ({
  isOpen,
  onClose,
  canvas,
  filename = 'atlas_preview',
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset view when modal opens or canvas changes
  useEffect(() => {
    if (isOpen && canvas && containerRef.current) {
      const containerW = containerRef.current.clientWidth || 800;
      const containerH = containerRef.current.clientHeight || 600;
      const fitScale = Math.min(
        (containerW * 0.88) / canvas.width,
        (containerH * 0.88) / canvas.height
      );
      setScale(Math.max(0.1, Number(fitScale.toFixed(2))));
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, canvas]);

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => Math.max(0.1, Math.min(16, Number((prev * factor).toFixed(2)))));
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

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFit = () => {
    if (!canvas || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth || 800;
    const containerH = containerRef.current.clientHeight || 600;
    const fitScale = Math.min(
      (containerW * 0.88) / canvas.width,
      (containerH * 0.88) / canvas.height
    );
    setScale(Math.max(0.05, Number(fitScale.toFixed(2))));
    setPan({ x: 0, y: 0 });
  };

  const handleActualSize = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen || !canvas) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 8, 7, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          height: 52,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(13, 19, 17, 0.95)',
          zIndex: 10,
        }}
      >
        {/* Title and Resolution Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)' }}>
            Atlas View
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              background: '#09291b',
              color: 'var(--accent-green)',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid #145938',
              fontWeight: 700,
            }}
          >
            {canvas.width} × {canvas.height} px
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            {filename}.png
          </span>
        </div>

        {/* Zoom and Pan Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setScale((s) => Math.max(0.1, Number((s * 0.8).toFixed(2))))}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>

          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              minWidth: 46,
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
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={handleFit}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              padding: '0 8px',
              height: 30,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="Fit to Window"
          >
            <Maximize size={13} />
            Fit
          </button>

          <button
            onClick={handleActualSize}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--text-main)',
              padding: '0 8px',
              height: 30,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            title="100% Actual Pixel Size"
          >
            <RotateCcw size={13} />
            1:1
          </button>

          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />

          <button
            onClick={handleDownload}
            style={{
              background: '#0d241a',
              border: '1px solid #1c4535',
              borderRadius: 5,
              color: 'var(--accent-green)',
              padding: '0 10px',
              height: 30,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
            title="Download PNG"
          >
            <Download size={13} />
            Save PNG
          </button>

          {/* Prominent High-Visibility Close Button */}
          <button
            onClick={onClose}
            style={{
              background: '#381318',
              border: '1px solid #991b1b',
              color: '#ff858f',
              height: 30,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              marginLeft: 10,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#381318';
              e.currentTarget.style.borderColor = '#991b1b';
              e.currentTarget.style.color = '#ff858f';
            }}
            title="Close (or press Esc)"
          >
            <X size={15} />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: '#0a0d0c',
          backgroundImage: `
            linear-gradient(45deg, #131715 25%, transparent 25%), 
            linear-gradient(-45deg, #131715 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #131715 75%), 
            linear-gradient(-45deg, transparent 75%, #131715 75%)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'inline-block',
            lineHeight: 0,
            borderRadius: 2,
            backgroundColor: '#000000',
          }}
        >
          <img
            src={canvas.toDataURL()}
            alt="Enlarged Atlas"
            style={{
              width: canvas.width,
              height: canvas.height,
              imageRendering: 'pixelated',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Floating Top-Right Corner Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(38, 14, 18, 0.9)',
            border: '1.5px solid #dc2626',
            color: '#ff858f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
            zIndex: 30,
            backdropFilter: 'blur(6px)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(38, 14, 18, 0.9)';
            e.currentTarget.style.color = '#ff858f';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Close (Esc)"
        >
          <X size={20} />
        </button>

        {/* Subtle Bottom Instruction Pill */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 11,
            color: 'var(--text-dim)',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          Scroll to Zoom • Drag to Pan • Press Esc to Close
        </div>
      </div>
    </div>
  );
};
