'use client';
// goal-creation/GoalSummaryCard.tsx — final output with edit + risk flags

import { useState } from 'react';
import type { GoalSummary, RiskFlag } from './flow-config/types';

type Props = {
  summary: GoalSummary;
  onSave: (summary: GoalSummary) => Promise<void>;
  onReset: () => void;
};

function FlagBadge({ flag, onDismiss }: { flag: RiskFlag; onDismiss: () => void }) {
  const isWarn = flag.severity === 'warn';
  return (
    <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs ${
      isWarn
        ? 'bg-amber-500/8 border-amber-500/20 text-amber-300'
        : 'bg-blue-500/8 border-blue-500/20 text-blue-300'
    }`}>
      <span className="flex-shrink-0 mt-0.5">{isWarn ? '⚠' : 'ℹ'}</span>
      <span className="flex-1 leading-relaxed">{flag.message}</span>
      <button type="button" onClick={onDismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">✕</button>
    </div>
  );
}

function EditableField({
  label, value, onChange, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
        />
      )}
    </div>
  );
}

export function GoalSummaryCard({ summary: initial, onSave, onReset }: Props) {
  const [draft, setDraft] = useState<GoalSummary>(initial);
  const [flags, setFlags] = useState<RiskFlag[]>(initial.riskFlags ?? []);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GoalSummary>(key: K, value: GoalSummary[K]) {
    setDraft(d => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({ ...draft, riskFlags: flags });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide mb-1">Your goal</p>
        <p className="text-xs text-gray-600">Edit anything before saving.</p>
      </div>

      <div className="space-y-3">
        <EditableField label="Title" value={draft.title} onChange={v => update('title', v)} />
        <EditableField label="Why now" value={draft.whyNow} onChange={v => update('whyNow', v)} multiline />
        <EditableField label="Commitment" value={draft.commitment} onChange={v => update('commitment', v)} />
        <EditableField label="Success signal" value={draft.successSignal} onChange={v => update('successSignal', v)} multiline />
      </div>

      {/* Risk flags */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Flags to consider</p>
          {flags.map((f, i) => (
            <FlagBadge
              key={i}
              flag={f}
              onDismiss={() => setFlags(fs => fs.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          disabled={!draft.title.trim() || saving}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg bg-white text-gray-950 text-sm font-semibold disabled:opacity-35 hover:bg-gray-100 transition-colors"
        >
          {saving ? 'Saving…' : 'Save goal'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
