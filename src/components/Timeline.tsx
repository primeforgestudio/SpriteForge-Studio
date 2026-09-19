import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCw, Plus, Check } from 'lucide-react';

interface TimelineProps {
  totalFrames: number;
  currentFrame: number;
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>>;
  cropStart: number;
  setCropStart: (start: number) => void;
  cropEnd: number;
  setCropEnd: (end: number) => void;
  markers: number[];
  setMarkers: (markers: number[]) => void;
  fps: number;
  setFps: (fps: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onDistributeMarkers: () => void;
  onDetectLoop?: () => Promise<string | null>;
}

export const Timeline: React.FC<TimelineProps> = ({
  totalFrames,
  currentFrame,
  setCurrentFrame,
  cropStart,
  setCropStart,
  cropEnd,
  setCropEnd,
  markers,
  setMarkers,
  fps,
  isPlaying,
  setIsPlaying,
  onDistributeMarkers,
  onDetectLoop,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isLooping, setIsLooping] = useState(true);
  const [isDetectingLoop, setIsDetectingLoop] = useState(false);
  const [loopStatusMsg, setLoopStatusMsg] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<
    'playhead' | 'cropStart' | 'cropEnd' | { markerIndex: number } | null
  >(null);

  const handleDetectLoopClick = async () => {
    if (!onDetectLoop || isDetectingLoop) return;
    setIsDetectingLoop(true);
    try {
      const msg = await onDetectLoop();
      if (msg) {
        setLoopStatusMsg(msg);
        setTimeout(() => setLoopStatusMsg(null), 4000);
      }
    } catch {
      setLoopStatusMsg('Detection failed');
      setTimeout(() => setLoopStatusMsg(null), 3000);
    } finally {
      setIsDetectingLoop(false);
    }
  };

  const maxFrame = Math.max(1, totalFrames - 1);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) return;

    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setCurrentFrame((prev) => {
        let next = prev + 1;
        if (next > cropEnd) {
          if (isLooping) {
            next = cropStart;
          } else {
            setIsPlaying(false);
            return cropEnd;
          }
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, fps, totalFrames, cropStart, cropEnd, isLooping, setCurrentFrame, setIsPlaying]);

  const frameToPx = (frame: number, width: number) => {
    return (Math.max(0, Math.min(maxFrame, frame)) / maxFrame) * width;
  };

  const pxToFrame = (px: number, width: number) => {
    const ratio = Math.max(0, Math.min(1, px / width));
    return Math.round(ratio * maxFrame);
  };

  // Draw ruler numbers and ticks (0, 10, 20, 30...)
  const drawRuler = useCallback(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (totalFrames <= 0) return;

    // Horizontal baseline
    ctx.strokeStyle = '#1e2924';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();

    // Determine step for numbers based on total frames
    let majorStep = 10;
    if (totalFrames > 300) majorStep = 50;
    else if (totalFrames > 150) majorStep = 20;
    else if (totalFrames < 30) majorStep = 5;

    const minorStep = majorStep / 2;

    ctx.font = '9px -apple-system, BlinkMacSystemFont, "Inter", monospace';
    ctx.textAlign = 'center';

    for (let f = 0; f <= maxFrame; f += minorStep) {
      const x = frameToPx(f, w);
      const isMajor = f % majorStep === 0;

      if (isMajor) {
        // Major tick
        ctx.strokeStyle = '#31443d';
        ctx.beginPath();
        ctx.moveTo(x, h - 7);
        ctx.lineTo(x, h - 1);
        ctx.stroke();

        // Number
        ctx.fillStyle = '#657770';
        ctx.fillText(String(f), x, h - 10);
      } else {
        // Minor tick
        ctx.strokeStyle = '#22312b';
        ctx.beginPath();
        ctx.moveTo(x, h - 4);
        ctx.lineTo(x, h - 1);
        ctx.stroke();
      }
    }
  }, [totalFrames, maxFrame]);

  // Sync ruler canvas resolution
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (canvas && trackRef.current) {
      canvas.width = trackRef.current.clientWidth;
      canvas.height = 24;
      drawRuler();
    }
  }, [drawRuler]);

  useEffect(() => {
    const handleResize = () => {
      if (rulerCanvasRef.current && trackRef.current) {
        rulerCanvasRef.current.width = trackRef.current.clientWidth;
        drawRuler();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawRuler]);

  // Mouse drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current || totalFrames <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = pxToFrame(x, rect.width);
    setCurrentFrame(frame);
    setDraggingItem('playhead');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingItem || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = pxToFrame(x, rect.width);

    if (draggingItem === 'playhead') {
      setCurrentFrame(frame);
    } else if (draggingItem === 'cropStart') {
      setCropStart(Math.min(frame, cropEnd - 1));
    } else if (draggingItem === 'cropEnd') {
      setCropEnd(Math.max(frame, cropStart + 1));
    } else if (typeof draggingItem === 'object' && 'markerIndex' in draggingItem) {
      const idx = draggingItem.markerIndex;
      const updated = [...markers];
      updated[idx] = Math.max(cropStart, Math.min(cropEnd, frame));
      updated.sort((a, b) => a - b);
      setMarkers(updated);
    }
  };

  const handleMouseUp = () => {
    setDraggingItem(null);
  };

  const toggleKeyAtCurrent = () => {
    if (markers.includes(currentFrame)) {
      setMarkers(markers.filter((m) => m !== currentFrame));
    } else {
      const updated = [...markers, currentFrame].sort((a, b) => a - b);
      setMarkers(updated);
    }
  };

  const trackWidth = trackRef.current?.clientWidth || 1000;
  const playheadX = frameToPx(currentFrame, trackWidth);
  const cropStartX = frameToPx(cropStart, trackWidth);
  const cropEndX = frameToPx(cropEnd, trackWidth);

  const durationSec = (totalFrames / fps).toFixed(1);
  const formattedCurFrame = String(currentFrame).padStart(2, '0');
  const formattedTotalFrames = String(totalFrames).padStart(2, '0');

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        background: '#0d1311',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Playback controls + Frame info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Skip Back */}
            <button
              onClick={() => setCurrentFrame(cropStart)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px' }}
              title="Go to In Point"
            >
              <SkipBack size={15} />
            </button>

            {/* Big Neon Mint Green Play Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)',
                color: '#000000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px var(--accent-green-glow)',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} fill="#000" /> : <Play size={14} fill="#000" style={{ marginLeft: 2 }} />}
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => setCurrentFrame(cropEnd)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '4px' }}
              title="Go to Out Point"
            >
              <SkipForward size={15} />
            </button>

            {/* Loop toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLooping ? 'var(--accent-green)' : 'var(--text-dim)',
                padding: '4px',
              }}
              title="Loop playback"
            >
              <RotateCw size={14} />
            </button>
          </div>

          {/* Center: Frame and Duration Readout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>Frame: </span>
              <b style={{ color: 'var(--accent-green)' }}>{formattedCurFrame}</b>
              <span style={{ color: 'var(--text-dim)' }}> / {formattedTotalFrames}</span>
            </span>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <span>
              <span style={{ color: 'var(--text-muted)' }}>Duration: </span>
              <b style={{ color: 'var(--text-bright)' }}>{durationSec}s</b>
            </span>
          </div>
        </div>

        {/* Right Buttons: Set In [4], Set Out [12], Full, Distribute Keys (16), +Add Key */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCropStart(currentFrame)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              padding: '4px 8px',
              color: 'var(--text-main)',
            }}
            title="Set In Marker"
          >
            Set In [{cropStart}]
          </button>

          <button
            onClick={() => setCropEnd(currentFrame)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              padding: '4px 8px',
              color: 'var(--text-main)',
            }}
            title="Set Out Marker"
          >
            Set Out [{cropEnd}]
          </button>

          <button
            onClick={() => {
              setCropStart(0);
              setCropEnd(maxFrame);
            }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              fontSize: 10,
              padding: '4px 8px',
              color: 'var(--text-main)',
            }}
            title="Reset range to full duration"
          >
            Full
          </button>

          {/* Distribute Keys Button (Styled in dark green with mint text from screenshot) */}
          <button
            onClick={onDistributeMarkers}
            style={{
              background: '#0d241a',
              border: '1px solid #1c4535',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              color: 'var(--accent-green)',
            }}
            title="Evenly distribute keys across the In-Out range"
          >
            Distribute Keys ({markers.length})
          </button>

          {/* Auto-Detect Loop Button */}
          {onDetectLoop && (
            <button
              onClick={handleDetectLoopClick}
              disabled={isDetectingLoop}
              style={{
                background: isDetectingLoop ? '#0a1a13' : '#0d241a',
                border: '1px solid var(--accent-green)',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 9px',
                color: 'var(--accent-green)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: isDetectingLoop ? 'wait' : 'pointer',
                opacity: isDetectingLoop ? 0.7 : 1,
              }}
              title="Auto-detect optimal seamless loop frame"
            >
              <RotateCw size={11} className={isDetectingLoop ? 'animate-spin' : ''} />
              {isDetectingLoop ? 'Detecting...' : 'Detect Loop'}
            </button>
          )}

          {loopStatusMsg && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--accent-green)',
                background: '#0b1f16',
                border: '1px solid #1a4d35',
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              {loopStatusMsg}
            </span>
          )}

          {/* +Add Key Button (Non-flickering during playback with fixed dimensions) */}
          {(() => {
            const isKeyActive = !isPlaying && markers.includes(currentFrame);
            return (
              <button
                onClick={toggleKeyAtCurrent}
                disabled={isPlaying}
                style={{
                  background: isKeyActive ? '#0e2b1e' : 'var(--bg-card)',
                  border: isKeyActive ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  fontSize: 10,
                  width: 82,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  color: isKeyActive ? 'var(--accent-green)' : 'var(--text-main)',
                  cursor: isPlaying ? 'default' : 'pointer',
                  opacity: isPlaying ? 0.5 : 1,
                  userSelect: 'none',
                }}
                title={isPlaying ? 'Pause playback to add or remove keyframes' : 'Add or remove keyframe at current frame'}
              >
                {isKeyActive ? (
                  <>
                    <Check size={11} style={{ marginRight: 4, color: 'var(--accent-green)' }} />
                    Key Active
                  </>
                ) : (
                  <>
                    <Plus size={11} style={{ marginRight: 4 }} />
                    +Add Key
                  </>
                )}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Timeline Ruler & Keyframes Track */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{
          position: 'relative',
          height: 38,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Ruler Canvas (Ticks and frame numbers: 0, 10, 20...) */}
        <canvas
          ref={rulerCanvasRef}
          style={{ width: '100%', height: 24, display: 'block', pointerEvents: 'none' }}
        />

        {/* Dimmed Out-of-bounds Regions */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: cropStartX,
            height: 24,
            background: 'rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: cropEndX,
            top: 0,
            right: 0,
            height: 24,
            background: 'rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        />

        {/* Neon Green Crop In Bracket [ */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setDraggingItem('cropStart');
          }}
          style={{
            position: 'absolute',
            left: cropStartX - 3,
            top: 4,
            width: 8,
            height: 20,
            cursor: 'ew-resize',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          title={`In: Frame ${cropStart}`}
        >
          {/* Top flag */}
          <div style={{ width: 6, height: 2, background: 'var(--accent-green)' }} />
          {/* Vertical spine */}
          <div style={{ width: 2, flex: 1, background: 'var(--accent-green)' }} />
          {/* Bottom flag */}
          <div style={{ width: 6, height: 2, background: 'var(--accent-green)' }} />
        </div>

        {/* Neon Green Crop Out Bracket ] */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setDraggingItem('cropEnd');
          }}
          style={{
            position: 'absolute',
            left: cropEndX - 5,
            top: 4,
            width: 8,
            height: 20,
            cursor: 'ew-resize',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
          title={`Out: Frame ${cropEnd}`}
        >
          {/* Top flag */}
          <div style={{ width: 6, height: 2, background: 'var(--accent-green)' }} />
          {/* Vertical spine */}
          <div style={{ width: 2, flex: 1, background: 'var(--accent-green)' }} />
          {/* Bottom flag */}
          <div style={{ width: 6, height: 2, background: 'var(--accent-green)' }} />
        </div>

        {/* Keyframe Diamonds Track (from screenshot) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 26,
            height: 12,
            pointerEvents: 'none',
          }}
        >
          {markers.map((f, idx) => {
            const x = frameToPx(f, trackWidth);
            const isCurrent = f === currentFrame;
            return (
              <div
                key={idx}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingItem({ markerIndex: idx });
                  setCurrentFrame(f);
                }}
                style={{
                  position: 'absolute',
                  left: x - 3,
                  top: 2,
                  width: 6,
                  height: 6,
                  transform: 'rotate(45deg)',
                  backgroundColor: 'var(--accent-green)',
                  border: isCurrent ? '1px solid #ffffff' : 'none',
                  boxShadow: isCurrent ? '0 0 8px var(--accent-green-glow)' : 'none',
                  cursor: 'ew-resize',
                  pointerEvents: 'auto',
                  zIndex: 25,
                }}
                title={`Keyframe ${idx + 1}: Frame ${f}`}
              />
            );
          })}
        </div>

        {/* Playhead Vertical Line */}
        <div
          style={{
            position: 'absolute',
            left: playheadX - 1,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: '#ffffff',
            boxShadow: '0 0 6px rgba(255,255,255,0.8)',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};
