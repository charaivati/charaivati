'use client';
// goal-creation/ArchetypeSelector.tsx — Step 0: pick Learn / Build / Execute / Connect

import type { GoalArchetype } from './flow-config/types';

type ArchetypeConfig = {
  id: GoalArchetype;
  icon: string;
  label: string;
  desc: string;
};

const ARCHETYPES: ArchetypeConfig[] = [
  { id: 'LEARN',   icon: '📖', label: 'Learn',   desc: 'Something to understand or master'   },
  { id: 'BUILD',   icon: '🔨', label: 'Build',   desc: 'A product, project, or system'        },
  { id: 'EXECUTE', icon: '⚡', label: 'Execute', desc: 'A habit or practice to stay on'       },
  { id: 'CONNECT', icon: '🤝', label: 'Connect', desc: 'A cause or group to support'           },
];

type Props = {
  onSelect: (a: GoalArchetype) => void;
};

export function ArchetypeSelector({ onSelect }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-1">New goal</p>
        <p className="text-lg font-semibold text-white">What kind of goal is this?</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {ARCHETYPES.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className="flex flex-col items-start p-4 rounded-xl border border-gray-800 bg-gray-950/50
              hover:border-gray-600 hover:scale-[1.02] active:scale-[0.98] transition-all text-left"
          >
            <span className="text-xl mb-2">{a.icon}</span>
            <span className="text-sm font-semibold text-white">{a.label}</span>
            <span className="text-xs text-gray-500 mt-0.5 leading-snug">{a.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
