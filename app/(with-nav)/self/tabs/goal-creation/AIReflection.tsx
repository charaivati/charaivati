'use client';
// goal-creation/AIReflection.tsx — shows compressed reflection of user's last answer

type Props = { text: string };

export function AIReflection({ text }: Props) {
  return (
    <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-indigo-500/8 border border-indigo-500/15">
      <span className="text-indigo-400 text-sm flex-shrink-0 mt-0.5">✦</span>
      <p className="text-sm text-gray-300 leading-relaxed italic">{text}</p>
    </div>
  );
}
