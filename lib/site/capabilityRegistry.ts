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

export type SectionDimension =
  | 'health' | 'skills' | 'funds' | 'environment' | 'social'
  | 'energy' | 'time' | 'business' | 'support';

export type SectionInfo = {
  key: string;
  label: string;
  layer: 'self' | 'society' | 'state' | 'nation' | 'earth' | 'universe';
  status: SectionStatus;
  route: string | null;
  /** Which life dimension this section serves — used to group plan requirements. */
  dimension?: SectionDimension;
  /** SelfCanvas partner panel to auto-open when routed here (?panel=). */
  panel?: string;
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
    dimension: 'time',
  },
  'self.health': {
    key: 'self.health',
    label: 'Health',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=health',
    dimension: 'health',
    panel: 'health',
  },
  'self.skills': {
    key: 'self.skills',
    label: 'Skills',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=skills',
    dimension: 'skills',
    panel: 'skills',
  },
  'self.funds': {
    key: 'self.funds',
    label: 'Funds',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=funds',
    dimension: 'funds',
    panel: 'funds',
  },
  'self.environment': {
    key: 'self.environment',
    label: 'Environment',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=environment',
    dimension: 'environment',
    panel: 'environment',
  },
  'self.energy': {
    key: 'self.energy',
    label: 'Energy',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=energy',
    dimension: 'energy',
    panel: 'energy',
  },
  'self.network': {
    key: 'self.network',
    label: 'Network',
    layer: 'self',
    status: 'live',
    route: '/self?tab=personal&panel=network',
    dimension: 'social',
    panel: 'network',
  },
  'business.evaluate': {
    key: 'business.evaluate',
    label: 'Business Idea Evaluation',
    layer: 'self',
    status: 'live',
    route: '/business/idea',
    dimension: 'business',
    liveFeatures: ['idea scoring interview', 'market sizing', 'validation todos'],
  },
  'business.plan': {
    key: 'business.plan',
    label: 'Business Plan & Pitch Documents',
    layer: 'self',
    status: 'live',
    route: '/business',
    dimension: 'business',
    liveFeatures: ['SWOT', 'business model canvas', 'financials', 'PDF export & sharing'],
  },
  'earn.initiatives': {
    key: 'earn.initiatives',
    label: 'Initiatives',
    layer: 'self',
    status: 'live',
    route: '/app/initiatives',
    dimension: 'business',
    liveFeatures: ['store, service and fleet ventures', 'teams & partners', 'order workflows'],
  },
  'earn.hub': {
    key: 'earn.hub',
    label: 'Earning Hub',
    layer: 'self',
    status: 'live',
    route: '/earn',
    dimension: 'business',
  },
  'listen.consult': {
    key: 'listen.consult',
    label: 'Listen (guided conversation)',
    layer: 'self',
    status: 'live',
    route: '/listen',
    dimension: 'support',
    liveFeatures: ['one-on-one guided conversation', 'drive discovery', 'crisis-aware support'],
  },
  'chakra.landing': {
    key: 'chakra.landing',
    label: 'Chakra Journey',
    layer: 'self',
    status: 'live',
    route: '/chakra/landing',
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
