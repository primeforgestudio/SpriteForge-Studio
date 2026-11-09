import React, { useState } from 'react';
import { Heart, X, Copy, Check, ExternalLink, Star } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const usdtAddress = 'TP4teMUZ56aLrNT1DPzm8N42y4fjEY4WCi';
  const patreonUrl = 'https://www.patreon.com/primeforgestudio';
  const githubUrl = 'https://github.com/primeforgestudio/SpriteForge-Studio';

  const handleCopyUsdt = () => {
    navigator.clipboard.writeText(usdtAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          background: '#16171c',
          border: '1px solid rgba(255, 92, 38, 0.25)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85), 0 0 20px rgba(255, 85, 31, 0.08)',
          borderRadius: 12,
          padding: 20,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(255, 92, 38, 0.15)',
                border: '1px solid rgba(255, 92, 38, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-orange)',
              }}
            >
              <Heart size={16} fill="currentColor" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-bright)' }}>
                Support SpriteForge Studio
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Free & Open Source tools for indie game developers
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px 6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 12, color: 'var(--text-main)', lineHeight: 1.5 }}>
            SpriteForge Studio is completely free to use. If it saved you hours of work converting AI videos into sprite sheets and Godot scenes, consider fueling future updates!
          </p>

          {/* Option 1: Patreon */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>
                  Patreon
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#ff6243',
                    background: 'rgba(255, 98, 67, 0.12)',
                    border: '1px solid rgba(255, 98, 67, 0.25)',
                    padding: '1px 6px',
                    borderRadius: 10,
                  }}
                >
                  Cards / PayPal
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Monthly membership or one-time creator support
              </div>
            </div>

            <button
              onClick={() => openUrl(patreonUrl)}
              className="primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Open <ExternalLink size={12} />
            </button>
          </div>

          {/* Option 2: Crypto (USDT TRC20) */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>
                  USDT Crypto Tip
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#26a17b',
                    background: 'rgba(38, 161, 123, 0.15)',
                    border: '1px solid rgba(38, 161, 123, 0.3)',
                    padding: '1px 6px',
                    borderRadius: 10,
                  }}
                >
                  TRON (TRC-20)
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Zero middleman</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: 6,
                padding: '6px 8px',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: 'var(--text-main)',
                  wordBreak: 'break-all',
                  flex: 1,
                  userSelect: 'all',
                }}
              >
                {usdtAddress}
              </span>

              <button
                onClick={handleCopyUsdt}
                title="Copy USDT address"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: copied ? 'rgba(38, 161, 123, 0.2)' : 'var(--bg-card)',
                  color: copied ? '#26a17b' : 'var(--text-bright)',
                  border: `1px solid ${copied ? '#26a17b' : 'var(--border-subtle)'}`,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? (
                  <>
                    <Check size={12} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
              Accepted on Bybit, Binance, Trust Wallet, etc.
            </div>
          </div>

          {/* Option 3: Star on GitHub */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={14} style={{ color: '#e3b341' }} />
              <span style={{ fontSize: 11, color: 'var(--text-main)' }}>
                Don't have funds? Give us a star on GitHub!
              </span>
            </div>
            <button
              onClick={() => openUrl(githubUrl)}
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              GitHub Repo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
