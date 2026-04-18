/**
 * Single source of truth for which sections of the Charaivati site are actually built.
 *
 * Three-state model:
 *   live       — fully functional; safe to link and route users to.
 *   scaffolded — page exists but only some features work; see `liveFeatures` / `plannedFeatures`.
 *   planned    — no page yet; only an `interim` suggestion and an `eta` are available.
 *
 * The execution plan generator reads this registry to decide where it can route users.
 * Never link users to a section whose status is 'planned' — it will 404 or mislead them.
 */

export type SectionStatus = 'live' | 'scaffolded' | 'planned';

export type SectionInfo = {
  key: string;
  label: string;
  layer: 'self' | 'society' | 'state' | 'nation' | 'earth' | 'universe';
  status: SectionStatus;
  route: string | null;
  liveFeatures?: string[];
  plannedFeatures?: string[];
  eta?: string;
  interim?: string;
};

export const SECTIONS: Record<string, SectionInfo> = {
  // ── Self ────────────────────────────────────────────────────────────────────
  'self.personal': {
    key: 'self.personal',
    label: 'Personal',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal',
  },
  'self.social': {
    key: 'self.social',
    label: 'Social',
    layer: 'self',
    status: 'live',
    route: '/self?tab=social',
  },
  'self.learning': {
    key: 'self.learning',
    label: 'Learning',
    layer: 'self',
    status: 'scaffolded',
    route: '/self?tab=learning',
    liveFeatures: ['skill profiles', 'external resource links'],
    plannedFeatures: ['tutor matching', 'video library'],
  },
  'self.earning': {
    key: 'self.earning',
    label: 'Earning',
    layer: 'self',
    status: 'live',
    route: '/self?tab=earning',
  },
  'self.time': {
    key: 'self.time',
    label: 'Time',
    layer: 'self',
    status: 'live',
    route: '/self?tab=time',
  },

  // ── Society ─────────────────────────────────────────────────────────────────
  'society.local_admin': {
    key: 'society.local_admin',
    label: 'Local Administration',
    layer: 'society',
    status: 'planned',
    route: null,
    eta: 'Q3 2026',
    interim: 'Use Self → Social to find neighbours working on similar issues',
  },
  'society.infrastructure': {
    key: 'society.infrastructure',
    label: 'Infrastructure',
    layer: 'society',
    status: 'planned',
    route: null,
    eta: 'Q3 2026',
    interim: 'Log observations and meeting notes in Self → Time',
  },
  'society.local_politics': {
    key: 'society.local_politics',
    label: 'Local Politics',
    layer: 'society',
    status: 'planned',
    route: null,
    eta: 'Q4 2026',
    interim: 'Track news and discussions via Self → Social',
  },

  // ── State ───────────────────────────────────────────────────────────────────
  'state.policies': {
    key: 'state.policies',
    label: 'Policies',
    layer: 'state',
    status: 'planned',
    route: null,
    eta: 'Q4 2026',
    interim: 'Use Self → Social for policy discussions and group formation',
  },

  // ── Nation ──────────────────────────────────────────────────────────────────
  'nation.pillars_democracy': {
    key: 'nation.pillars_democracy',
    label: 'Pillars of Democracy',
    layer: 'nation',
    status: 'planned',
    route: null,
    eta: '2027 H1',
    interim: 'For civic action, start with local issues via Self → Social',
  },

  // ── Earth ───────────────────────────────────────────────────────────────────
  'earth.survival': {
    key: 'earth.survival',
    label: 'Survival',
    layer: 'earth',
    status: 'planned',
    route: null,
    eta: 'TBD',
    interim: 'Reflection and discussion via Self → Social',
  },

  // ── Universe ─────────────────────────────────────────────────────────────────
  'universe.science_spirituality': {
    key: 'universe.science_spirituality',
    label: 'Science & Spirituality',
    layer: 'universe',
    status: 'planned',
    route: null,
    eta: 'TBD',
    interim: 'Reflection and discussion via Self → Social',
  },
};

export function getSection(key: string): SectionInfo | undefined {
  return SECTIONS[key];
}

export function getSectionsByStatus(status: SectionStatus): SectionInfo[] {
  return Object.values(SECTIONS).filter((s) => s.status === status);
}
