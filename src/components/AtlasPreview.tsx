import React, { useState } from 'react';
import { AppMode } from '../core/types';
import { RefreshCw, Download, FileText, Film, Maximize2, Folder, Code2 } from 'lucide-react';
import { AtlasModal } from './AtlasModal';
import { CodeExportModal } from './CodeExportModal';

interface AtlasPreviewProps {
  mode: AppMode;
  atlasCanvas: HTMLCanvasElement | null;
  spritesCanvases: HTMLCanvasElement[];
  exportFilename: string;
  setExportFilename: (name: string) => void;
  onExport: () => void;
  isExporting: boolean;
  hasMedia: boolean;
  // Normal Map, Mask & GIF
  generateNormalMap?: boolean;
  setGenerateNormalMap?: (val: boolean) => void;
  generatePbrPack?: boolean;
  setGeneratePbrPack?: (val: boolean) => void;
  enablePng8?: boolean;
  setEnablePng8?: (val: boolean) => void;
  generateMask?: boolean;
  setGenerateMask?: (val: boolean) => void;
  onExportGif?: () => void;
  isExportingGif?: boolean;
  // Master Atlas
  exportScope?: 'single' | 'master';
  masterTracksCount?: number;
  // Direct Folder Export
  destinationDir?: string;
  onSelectDestinationDir?: () => void;
  layoutMode?: 'grid' | 'advanced';
}

const AtlasPreviewComponent: React.FC<AtlasPreviewProps> = ({
  mode,
  atlasCanvas,
  spritesCanvases,
  exportFilename,
  setExportFilename,
  onExport,
  isExporting,
  hasMedia,
  generateNormalMap = false,
  setGenerateNormalMap,
  generatePbrPack = false,
  setGeneratePbrPack,
  enablePng8 = false,
  setEnablePng8,
  generateMask = false,
  setGenerateMask,
  onExportGif,
  isExportingGif = false,
  exportScope = 'single',
  masterTracksCount = 1,
  destinationDir,
  onSelectDestinationDir,
  layoutMode = 'grid',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  const atlasDataUrl = React.useMemo(() => {
    return atlasCanvas ? atlasCanvas.toDataURL() : '';
  }, [atlasCanvas]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {/* Section Header with Dimension Readout */}
      <div className="sidebar-section-title">
        <span>{mode === 'atlas' ? 'Atlas Preview' : 'Sprites Preview'}</span>
        {mode === 'atlas' && atlasCanvas && (
          <span style={{ fontSize: 11, color: 'var(--accent-orange)', fontWeight: 700, fontFamily: 'monospace' }}>
            {atlasCanvas.width} × {atlasCanvas.height}
          </span>
        )}
      </div>

      {/* Checkerboard Preview Box with View Hover Button */}
      <div
        className="checkerboard"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          width: '100%',
          height: 200,
          minHeight: 180,
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          cursor: mode === 'atlas' && atlasCanvas ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (mode === 'atlas' && atlasCanvas) setIsModalOpen(true);
        }}
      >
        {mode === 'atlas' ? (
          atlasCanvas ? (
            <>
              <img
                src={atlasDataUrl}
                alt="Atlas Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
                }}
              />
              {/* Hover Overlay with "View" button */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(2px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isHovered ? 1 : 0,
                  transition: 'opacity 0.18s ease-in-out',
                  pointerEvents: isHovered ? 'auto' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 6,
                    background: '#2B2D37',
                    border: '1px solid #FF551F',
                    color: '#FF551F',
                    fontSize: 12,
                    fontWeight: 700,
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transform: isHovered ? 'scale(1)' : 'scale(0.95)',
                    transition: 'transform 0.15s ease-out',
                  }}
                >
                  <Maximize2 size={13} />
                  <span>View</span>
                </button>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>No atlas generated</span>
          )
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
              gap: 6,
              width: '100%',
              height: '100%',
              overflowY: 'auto',
            }}
          >
            {spritesCanvases.map((c, i) => (
              <img
                key={i}
                src={c.toDataURL()}
                alt={`Sprite ${i}`}
                style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', background: '#0a0e0d', borderRadius: 4 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Enlarged Atlas Modal Lightbox */}
      <AtlasModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        canvas={atlasCanvas}
        filename={exportFilename}
      />

      {/* Export File Name Field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Export File Name</span>
          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            {mode === 'atlas' ? '.png / .json / .tres' : '.zip'}
          </span>
        </div>
        <div
          style={{
            height: 34,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 10px',
            gap: 6,
          }}
        >
          <FileText size={13} color="#FF551F" />
          <input
            type="text"
            value={exportFilename}
            onChange={(e) => setExportFilename(e.target.value)}
            placeholder="character_animation"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-bright)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Destination Folder Selector (sleek row with Browse... button) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            flex: 1,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 8px',
            gap: 6,
            overflow: 'hidden',
          }}
          title={destinationDir || 'Default Export Folder'}
        >
          <Folder size={14} color="#FF551F" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: 11,
              color: destinationDir ? 'var(--text-bright)' : 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}
          >
            {destinationDir || 'Default: Desktop'}
          </span>
        </div>

        {onSelectDestinationDir && (
          <button
            type="button"
            onClick={onSelectDestinationDir}
            style={{
              height: 34,
              padding: '0 12px',
              fontSize: 11,
              fontWeight: 600,
              background: '#2B2D37',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--text-bright)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Browse...
          </button>
        )}
      </div>

      {/* Generate Normal Map Checkbox */}
      {mode === 'atlas' && setGenerateNormalMap && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: generateNormalMap ? 'var(--text-bright)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={generateNormalMap}
            onChange={(e) => setGenerateNormalMap(e.target.checked)}
            style={{ accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
          />
          <span>Generate Normal Map (_normal.png)</span>
        </label>
      )}

      {/* Generate 2D PBR Pack Checkbox */}
      {mode === 'atlas' && setGeneratePbrPack && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: generatePbrPack ? '#00e5ff' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={generatePbrPack}
            onChange={(e) => {
              setGeneratePbrPack(e.target.checked);
              if (e.target.checked && setGenerateNormalMap) {
                setGenerateNormalMap(true);
              }
            }}
            style={{ accentColor: '#00e5ff', cursor: 'pointer' }}
          />
          <span>💡 2D PBR Pack (Normal + Emission + Roughness)</span>
        </label>
      )}

      {/* PNG-8 Compression Checkbox */}
      {mode === 'atlas' && setEnablePng8 && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: enablePng8 ? '#00f084' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={enablePng8}
            onChange={(e) => setEnablePng8(e.target.checked)}
            style={{ accentColor: '#00f084', cursor: 'pointer' }}
          />
          <span>🗜️ PNG-8 NeuQuant Output (60%–80% smaller)</span>
        </label>
      )}

      {/* Generate Silhouette Alpha Mask Checkbox */}
      {mode === 'atlas' && setGenerateMask && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: generateMask ? 'var(--text-bright)' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={generateMask}
            onChange={(e) => setGenerateMask(e.target.checked)}
            style={{ accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
          />
          <span>Generate Mask (_mask.png)</span>
        </label>
      )}

      {/* Master Atlas Scope Banner */}
      {mode === 'atlas' && exportScope === 'master' && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(255, 92, 38, 0.1)',
            border: '1px solid rgba(255, 92, 38, 0.3)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--accent-orange)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>★ Master Atlas Set</span>
          <span style={{ fontWeight: 700 }}>{masterTracksCount} Animations</span>
        </div>
      )}

      {/* Convert & Export Button (Clean Matte Orange, No Glow) */}
      <button
        onClick={onExport}
        disabled={!hasMedia || isExporting}
        className="btn-mint"
        style={{
          width: '100%',
          height: 44,
          fontSize: 13,
          fontWeight: 600,
          marginTop: 4,
          borderRadius: 8,
          letterSpacing: '0.2px',
          background: 'var(--accent-orange)',
          borderColor: 'var(--accent-orange)',
          color: '#ffffff',
          boxShadow: 'none',
        }}
      >
        {isExporting ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
        {isExporting
          ? 'Exporting...'
          : exportScope === 'master'
          ? `Export Master Atlas (${masterTracksCount} Anims)`
          : 'Convert & Export'}
      </button>

      {/* Export Animated GIF Button */}
      {mode === 'atlas' && onExportGif && (
        <button
          onClick={onExportGif}
          disabled={!hasMedia || isExportingGif}
          style={{
            width: '100%',
            height: 34,
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: 'none',
          }}
        >
          {isExportingGif ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Film size={13} />
          )}
          {isExportingGif ? 'Rendering GIF...' : 'Export Animated GIF'}
        </button>
      )}

      {/* Code Snippets Integration Modal Trigger */}
      {mode === 'atlas' && (
        <button
          onClick={() => setIsCodeModalOpen(true)}
          disabled={!hasMedia}
          style={{
            width: '100%',
            height: 34,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            background: '#2B2D37',
            border: '1px solid #2D2E37',
            color: '#FF551F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: hasMedia ? 'pointer' : 'not-allowed',
            opacity: hasMedia ? 1 : 0.5,
            transition: 'all 0.15s ease',
          }}
        >
          <Code2 size={13} color="#FF551F" />
          <span>Integration Code & Snippets</span>
        </button>
      )}

      {/* Code Export Modal */}
      <CodeExportModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        animName={exportFilename || 'anim'}
        filename={exportFilename || 'spritesheet'}
        isAdvancedPack={layoutMode === 'advanced'}
      />
    </div>
  );
};

export const AtlasPreview = React.memo(AtlasPreviewComponent);
