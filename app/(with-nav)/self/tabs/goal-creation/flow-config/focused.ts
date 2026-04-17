// goal-creation/flow-config/focused.ts
import type { GoalArchetype, Question } from './types';

export const FOCUSED_QUESTIONS: Record<GoalArchetype, Question[]> = {
  LEARN: [
    { key: 'learn_f_q1', text: 'What specifically do you want to learn?',   type: 'text',   placeholder: 'e.g. Machine learning, guitar, public speaking…' },
    { key: 'learn_f_q2', text: 'Why now — what triggered this?',             type: 'text',   placeholder: 'e.g. A new job, a conversation, long curiosity…'  },
    { key: 'learn_f_q3', text: 'How much time can you give this per week?',  type: 'text',   placeholder: 'e.g. 3 hours, weekends only…'                     },
    { key: 'learn_f_q4', text: "How will you know you've learned it?",       type: 'text',   placeholder: 'e.g. Build something, pass a test, teach someone…' },
  ],
  BUILD: [
    { key: 'build_f_q1', text: 'What are you building?',                     type: 'text',   placeholder: 'e.g. A SaaS product, a community, a restaurant…'  },
    { key: 'build_f_q2', text: 'Who is it for?',                             type: 'text',   placeholder: 'e.g. Small business owners, students, my city…'   },
    { key: 'build_f_q3', text: "What's your first concrete step?",           type: 'text',   placeholder: 'e.g. Write a spec, talk to 10 users, build MVP…'  },
    { key: 'build_f_q4', text: 'When do you want something to show for it?', type: 'text',   placeholder: 'e.g. 3 months, end of year, no deadline yet…'     },
  ],
  EXECUTE: [
    { key: 'exec_f_q1', text: 'Is this a hobby, or something you need to get stable?', type: 'select', options: ['Hobby', 'Need stability', 'Both'] },
    { key: 'exec_f_q2', text: 'What are you trying to execute on?',          type: 'text',   placeholder: 'e.g. Exercise 4x/week, write daily, ship Fridays…' },
    { key: 'exec_f_q3', text: "What's been stopping you so far?",            type: 'text',   placeholder: 'e.g. No structure, procrastination, burnout…'      },
    { key: 'exec_f_q4', text: 'How often do you need to show up for this?',  type: 'text',   placeholder: 'e.g. Daily, 3x a week, every morning…'             },
    // Q5 is branched by Q1 — see branchingRules.ts
  ],
  CONNECT: [
    { key: 'conn_f_q1', text: 'Is this a cause, a person, or a group?',      type: 'select', options: ['Cause', 'Person', 'Group'] },
    { key: 'conn_f_q2', text: 'Tell me who or what you are showing up for.', type: 'text',   placeholder: 'e.g. My family, climate change, local youth…'     },
    { key: 'conn_f_q3', text: 'What does your support look like practically?',type: 'text',   placeholder: 'e.g. Volunteering, funding, advocacy…'            },
    { key: 'conn_f_q4', text: 'How much time or resource can you commit?',   type: 'text',   placeholder: 'e.g. 2 hours/week, ₹5k/month…'                    },
    // Q5 is branched by Q1 — see branchingRules.ts
  ],
};
