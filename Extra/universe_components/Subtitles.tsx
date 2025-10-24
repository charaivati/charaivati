// app/components/Subtitles.tsx
'use client';
import React from 'react';

export default function Subtitles({ text, nearHead = false }: { text: string | null, nearHead?: boolean }) {
  if (!text) return null;

  if (nearHead) {
    // near alien head (center-top-ish)
    return (
      <div style={{
        position: 'fixed',
        left: '50%',
        top: '40%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none'
      }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0.06)',
          border: '2px solid rgba(255,255,255,0.14)',
          color: '#e9fff3',
          padding: '8px 12px',
          borderRadius: 16,
          maxWidth: 420,
          fontSize: 14,
          textAlign: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.6)'
        }}>
          <div style={{ fontFamily: 'monospace', letterSpacing: 0.8 }}>{text}</div>
        </div>
        {/* little speech pointer */}
        <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid rgba(255,255,255,0.06)', margin: '6px auto 0' }} />
      </div>
    );
  }

  // default bottom subtitle bar
  return (
    <div style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 36,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 9999,
    }}>
      <div style={{
        display: 'inline-block',
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 10,
        maxWidth: '80%',
        textAlign: 'center',
        fontSize: 16,
        lineHeight: '20px'
      }}>
        {text}
      </div>
    </div>
  );
}
