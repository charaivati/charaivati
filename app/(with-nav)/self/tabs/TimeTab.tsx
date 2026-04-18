'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/ProfileContext';
import { TimeSection } from '@/blocks/TimeBlock';
import { CollapsibleSection } from '@/components/self/shared';
import { TimelineList } from '@/components/timeline/TimelineList';
import { GoalExecuteSection } from './time/components/GoalExecuteSection';
import type { WeekSchedule } from '@/blocks/TimeBlock';

type Props = {
  goalId?:  string;
  view?:    string;
  focusId?: string;
};

export default function TimeTab({ goalId, focusId }: Props) {
  const router      = useRouter();
  const { profile } = useProfile();

  const [schedule, setSchedule] = useState<WeekSchedule>(
    () => (profile?.weekSchedule as WeekSchedule) ?? { slots: [], tasks: [] }
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleScheduleChange(s: WeekSchedule) {
    setSchedule(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weekSchedule: s }),
      }).catch(e => console.error('[TimeTab] schedule save failed', e));
    }, 800);
  }

  function handleFocusChange(id: string | null) {
    if (id) router.push(`/self?tab=time&focus=${id}`);
    else    router.push('/self?tab=time');
  }

  return (
    <div className="space-y-5">

      {/* ── Back to canvas ── */}
      <button
        type="button"
        onClick={() => router.push('/self')}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Personal
      </button>

      {/* ── Focus mode banner ── */}
      {focusId && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl
          bg-indigo-950/40 border border-indigo-800/40">
          <span className="text-sm text-indigo-300">Focus mode</span>
          <button type="button" onClick={() => handleFocusChange(null)}
            className="text-xs text-indigo-400 hover:text-indigo-200 transition-colors">
            Show all goals
          </button>
        </div>
      )}

      {/* ── Execute blocks for all active goals ── */}
      <GoalExecuteSection
        goalId={goalId}
        focusId={focusId}
        onFocusChange={handleFocusChange}
      />

      {/* ── Daily Tasks ── */}
      {!focusId && (
        <TimeSection
          schedule={schedule}
          goals={[]}
          onChange={handleScheduleChange}
          defaultOpen={true}
        />
      )}

      {/* ── Project Timelines ── */}
      {!focusId && (
        <CollapsibleSection
          title="Project Timelines"
          subtitle="Goal-driven projects with phases & milestones"
          defaultOpen={false}
        >
          <TimelineList goals={[]} />
        </CollapsibleSection>
      )}

    </div>
  );
}
