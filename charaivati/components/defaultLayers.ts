// components/defaultLayers.ts
export type DefaultTab = { id: string; label: string; description?: string };
export type DefaultLayer = { id: string; label: string; hint?: string; icon?: string; isDefault?: boolean; tabs: DefaultTab[] };

export const DEFAULT_LAYERS: DefaultLayer[] = [
  {
    id: "layer-self",
    label: "Self",
    hint: "Personal",
    icon: "self",
    isDefault: true,
    tabs: [
      { id: "self-personal", label: "Personal" },
      { id: "self-social", label: "Social" },
      { id: "self-learn", label: "Learn" },
      { id: "self-earn", label: "Earn" },
    ],
  },

  // Society: Birthplace (default)
  {
    id: "layer-society-home",
    label: "Society (Birthplace)",
    hint: "Local & state (birthplace)",
    icon: "state",
    isDefault: true,
    tabs: [
      { id: "soc-home-local", label: "Local body" },
      { id: "soc-home-leg", label: "Legislative" },
      { id: "soc-home-parl", label: "Parliamentary" },
      { id: "soc-home-state", label: "State" },
    ],
  },

  // Society: Workplace (slot reserved for user to add later)
  {
    id: "layer-society-work",
    label: "Society (Workplace)",
    hint: "Local & state (workplace)",
    icon: "custom",
    isDefault: false,
    tabs: [
      { id: "soc-work-local", label: "Local body" },
      { id: "soc-work-leg", label: "Legislative" },
      { id: "soc-work-parl", label: "Parliamentary" },
      { id: "soc-work-state", label: "State" },
    ],
  },

  // National: Birth (default)
  {
    id: "layer-nation-birth",
    label: "National (Birth)",
    hint: "Country (birth)",
    icon: "nation",
    isDefault: true,
    tabs: [
      { id: "nat-birth-leg", label: "Legislature" },
      { id: "nat-birth-exec", label: "Executive" },
      { id: "nat-birth-jud", label: "Judiciary" },
      { id: "nat-birth-media", label: "Media" },
    ],
  },

  // National: Work (slot for user)
  {
    id: "layer-nation-work",
    label: "National (Work)",
    hint: "Country (work)",
    icon: "custom",
    isDefault: false,
    tabs: [
      { id: "nat-work-leg", label: "Legislature" },
      { id: "nat-work-exec", label: "Executive" },
      { id: "nat-work-jud", label: "Judiciary" },
      { id: "nat-work-media", label: "Media" },
    ],
  },

  // Earth (default)
  {
    id: "layer-earth",
    label: "Earth",
    hint: "Global",
    icon: "earth",
    isDefault: true,
    tabs: [
      { id: "earth-world", label: "World view" },
      { id: "earth-stories", label: "Human stories" },
      { id: "earth-act", label: "Collaborate / Act Now" },
      { id: "earth-tools", label: "Knowledge / Tools" },
    ],
  },

  // Universe (default)
  {
    id: "layer-universe",
    label: "Universal",
    hint: "Beyond",
    icon: "universe",
    isDefault: true,
    tabs: [
      { id: "uni-spirit", label: "Spirituality" },
      { id: "uni-science", label: "Science" },
      { id: "uni-timeline", label: "Timeline" },
      { id: "uni-explore", label: "Explore" },
    ],
  },
];
