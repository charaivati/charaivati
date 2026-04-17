// goal-creation/flow-config/zoomedOut.ts
import type { GoalArchetype, Question } from './types';

export const ZOOMED_OUT_QUESTIONS: Record<GoalArchetype, Question[]> = {
  LEARN: [
    { key: 'learn_z_q1', text: 'What is the core question or problem driving your learning?',        type: 'text',     placeholder: 'The deeper reason, not just the topic…'              },
    { key: 'learn_z_q2', text: 'Who are the key thinkers or resources in this space?',              type: 'text',     placeholder: 'Books, institutions, people you know of…'            },
    { key: 'learn_z_q3', text: "What's missing that you want to address?",                          type: 'text',     placeholder: "The gap you sense, even if you can't fully name it…" },
    { key: 'learn_z_q4', text: 'What level of mastery are you aiming for?',                        type: 'select',   options: ['Practitioner', 'Expert', 'Researcher / contributor']    },
    { key: 'learn_z_q5', text: 'What does a 1-year and 3-year milestone look like?',               type: 'textarea', placeholder: 'What can you do, create, or show?'                   },
    { key: 'learn_z_q6', text: 'How much time per week can you protect — non-negotiably?',         type: 'text',     placeholder: 'e.g. 10 hours/week, every morning 6–8am…'            },
    { key: 'learn_z_q7', text: 'What is the output — skill, body of work, credential, publication?',type: 'text',    placeholder: 'What you want to have made or become…'               },
  ],
  BUILD: [
    // Market/competitor study is a separate module — not here
    { key: 'build_z_q1', text: 'What problem are you solving? Who suffers from it today?',         type: 'textarea', placeholder: 'Name the pain and the people who feel it…'           },
    { key: 'build_z_q2', text: 'What is your specific angle — why you, why this approach?',        type: 'textarea', placeholder: 'Your unfair advantage or unique insight…'            },
    { key: 'build_z_q3', text: 'What does the structure look like — venture, verticals, movement?',type: 'text',     placeholder: 'Single thing or portfolio of bets?'                  },
    { key: 'build_z_q4', text: 'What are your success parameters at 6 months, 2 years, 5 years?', type: 'textarea', placeholder: 'Revenue, users, impact — be concrete…'               },
    { key: 'build_z_q5', text: 'What is your current resource base — time, capital, team?',        type: 'text',     placeholder: 'Hours/week, funding, co-founders, network…'          },
    { key: 'build_z_q6', text: 'What is the first version that proves the idea works?',            type: 'textarea', placeholder: 'The smallest thing that validates everything…'       },
  ],
  EXECUTE: [
    { key: 'exec_z_q1', text: 'What are the 2–3 things you must execute consistently?',            type: 'textarea', placeholder: 'Your non-negotiables to keep everything moving…'    },
    { key: 'exec_z_q2', text: 'What does financial stability mean for you — number, lifestyle?',   type: 'text',     placeholder: 'e.g. ₹2L/month, no debt, own a home…'              },
    { key: 'exec_z_q3', text: 'What is your current income structure and what needs to change?',   type: 'textarea', placeholder: 'Job, freelance, business — what\'s working?'        },
    { key: 'exec_z_q4', text: 'What do you want freedom for?',                                     type: 'text',     placeholder: 'What would you do with more time and security?'     },
    { key: 'exec_z_q5', text: 'What has historically derailed your consistency?',                  type: 'text',     placeholder: 'Your known failure modes, honestly…'                },
    { key: 'exec_z_q6', text: 'What does a good week look like, concretely?',                      type: 'textarea', placeholder: 'Day by day — what happened?'                        },
    { key: 'exec_z_q7', text: 'When do you want this stability locked in by?',                     type: 'text',     placeholder: 'A date or milestone, not a feeling…'                },
  ],
  CONNECT: [
    { key: 'conn_z_q1', text: "What is the problem or injustice you're responding to?",            type: 'textarea', placeholder: 'What makes you angry or sad enough to act?'         },
    { key: 'conn_z_q2', text: 'Who is already working on this — are they sufficient?',             type: 'textarea', placeholder: "What exists? What's missing from their efforts?"    },
    { key: 'conn_z_q3', text: 'What is your specific contribution?',                               type: 'text',     placeholder: 'Organizing, funding, advocacy, infrastructure?'    },
    { key: 'conn_z_q4', text: 'Who are you trying to reach or mobilize?',                          type: 'text',     placeholder: 'Voters, youth, local community, policymakers?'     },
    { key: 'conn_z_q5', text: 'What does meaningful scale look like?',                             type: 'text',     placeholder: 'Local, national, or systemic change?'               },
    { key: 'conn_z_q6', text: 'What resources do you have and need?',                              type: 'textarea', placeholder: 'Time, money, people — be honest about gaps…'        },
    { key: 'conn_z_q7', text: 'What is a 1-year sign that the movement is real and growing?',      type: 'text',     placeholder: 'A concrete indicator you\'re making progress…'      },
  ],
};
