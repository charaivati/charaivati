// app/components/LanguagePicker.tsx
'use client';
import { useEffect, useState } from 'react';

type Lang = { id: number; code: string; name: string; enabled: boolean };

export default function LanguagePicker({
  onSelect,
  onClose,
  glyphMode = true,
}: {
  onSelect: (code: string, name?: string) => void;
  onClose?: () => void;
  glyphMode?: boolean;
}) {
  const [langs, setLangs] = useState<Lang[] | null>(null);
  useEffect(() => {
    fetch('/api/languages').then(r => r.json()).then(setLangs).catch(() => setLangs([]));
  }, []);

  const glyphFor = (code: string) => {
    const map: Record<string, string> = {
      en: '⟡',
      hi: '☸',
      ta: '卐',
    };
    return map[code] ?? '◦';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#07141a', padding: 18, borderRadius: 12, width: 520, maxWidth: '94%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => onClose && onClose()} style={{ color: '#fff', background: 'transparent', border: 'none', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, justifyItems: 'center', alignItems: 'center' }}>
          {langs?.map(l => (
            <button
              key={l.code}
              disabled={!l.enabled}
              onClick={() => onSelect(l.code, l.name)}
              style={{
                width: 92,
                height: 92,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: l.enabled ? 'linear-gradient(90deg,#102a3a,#0a1722)' : '#0b0b0b',
                color: l.enabled ? '#fff' : '#666',
                border: '1px solid rgba(255,255,255,0.04)',
                cursor: l.enabled ? 'pointer' : 'not-allowed',
                fontSize: 28
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 6 }}>{glyphFor(l.code)}</div>
              { !glyphMode && <div style={{ marginTop: 6 }}>{l.name}</div> }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
