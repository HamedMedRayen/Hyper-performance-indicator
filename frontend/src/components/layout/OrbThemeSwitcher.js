import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../utils/theme';
import { Moon, Sun, Compass, Leaf, Flame, Contrast, Zap } from 'lucide-react';

/* ── Rose icon for Queen theme ─────────────────────────── */
const RoseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M12 22V12" />
    <path d="M12 12C12 12 7 10 7 6a5 5 0 0 1 10 0c0 4-5 6-5 6z" />
    <path d="M9 18c-1.5 0-3-1-3-3" />
    <path d="M15 18c1.5 0 3-1 3-3" />
    <path d="M9 22h6" />
  </svg>
);

const THEMES = [
  { id: 'dark', color: '#94a3b8', Icon: Moon, label: 'Night' },
  { id: 'light', color: '#38bdf8', Icon: Sun, label: 'Sky' },
  { id: 'main', color: '#0ea5e9', Icon: Compass, label: 'Main' },
  { id: 'nature', color: '#4A7C59', Icon: Leaf, label: 'Nature' },
  { id: 'fire', color: '#ff0000', Icon: Flame, label: 'Fire' },
  { id: 'queen', color: '#ff718b', Icon: RoseIcon, label: 'Queen' },
  { id: 'monochrome', color: '#ff3b5c', Icon: Flame, label: 'Obsidian Pulse' },
  { id: 'cyberpunk', color: '#00ffcc', Icon: Zap, label: 'Cyber' },
];

/**
 * OrbThemeSwitcher
 * Trigger: glowing orb button.
 * Menu:    a floating dropdown panel that opens downward-left,
 *          always staying inside the viewport.
 */
export default function OrbThemeSwitcher() {
  const { theme: activeTheme, setTheme, previewTheme, setPreviewTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const displayTheme = previewTheme || activeTheme;
  const activeConfig = THEMES.find(t => t.id === displayTheme) || THEMES[0];
  const selectedConfig = THEMES.find(t => t.id === activeTheme) || THEMES[0];

  /* Close on outside click */
  useEffect(() => {
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setPreviewTheme(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [setPreviewTheme]);

  /* Close on Escape */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSelect = (id) => {
    setTheme(id);
    setPreviewTheme(null);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Trigger orb ───────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label="Switch theme"
        aria-expanded={isOpen}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          background: `radial-gradient(circle at 30% 30%, ${activeConfig.color}ff, ${activeConfig.color}bb)`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 18px ${activeConfig.color}70, inset 0 0 10px rgba(255,255,255,0.35)`,
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
          animation: 'orb-pulse 4s infinite ease-in-out',
          flexShrink: 0,
        }}
      >
        <div style={{
          color: '#fff',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
        }}>
          <activeConfig.Icon size={18} strokeWidth={2.5} />
        </div>
      </button>

      {/* ── Dropdown panel ────────────────────────────── */}
      <div
        role="menu"
        style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          right: 0,                     // anchors to the right edge of the orb
          width: 168,
          background: 'rgba(10,10,22,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '6px',
          boxShadow: '0 20px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 9999,
          /* mount / unmount animation */
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.22,1,0.36,1)',
          transformOrigin: 'top right',
        }}
      >
        {THEMES.filter(t => t.id === 'dark' || t.id === 'main' || t.id === 'monochrome').map((t, i) => {
          const isActive = t.id === activeTheme;
          return (
            <button
              key={t.id}
              role="menuitem"
              onClick={() => handleSelect(t.id)}
              onMouseEnter={() => setPreviewTheme(t.id)}
              onMouseLeave={() => setPreviewTheme(null)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                border: 'none',
                background: isActive
                  ? `rgba(${hexToRgb(t.color)}, 0.14)`
                  : 'transparent',
                cursor: 'pointer',
                transition: `all 0.18s ease ${i * 0.03}s`,
                /* stagger entrance */
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'translateX(0)' : 'translateX(8px)',
              }}
              onMouseOver={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseOut={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Colour dot */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${t.color}, ${t.color}cc)`,
                boxShadow: isActive ? `0 0 10px ${t.color}80` : `0 0 6px ${t.color}40`,
                border: isActive ? `2px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}>
                <t.Icon
                  size={13}
                  style={{ color: '#fff' }}
                />
              </div>

              {/* Label */}
              <span style={{
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? t.color : 'rgba(255,255,255,0.72)',
                letterSpacing: '0.01em',
                transition: 'color 0.2s',
              }}>
                {t.label}
              </span>

              {/* Active tick */}
              {isActive && (
                <div style={{
                  marginLeft: 'auto',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: t.color,
                  boxShadow: `0 0 6px ${t.color}`,
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes orb-pulse {
          0%, 100% {
            box-shadow: 0 0 18px ${activeConfig.color}70, inset 0 0 10px rgba(255,255,255,0.35);
          }
          50% {
            box-shadow: 0 0 28px ${activeConfig.color}aa, inset 0 0 14px rgba(255,255,255,0.5);
          }
        }
      `}</style>
    </div>
  );
}

/* Helper: "#rrggbb" → "r,g,b" for rgba() */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
