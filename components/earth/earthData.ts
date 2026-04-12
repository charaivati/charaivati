// components/earth/earthData.ts — all types, seed data, and constants for the Earth page

export type SignalId = "climate" | "food" | "biodiversity" | "circularity";

export type SignalDetail = {
  id: SignalId;
  name: string;
  value: number;
  delta: number;
  trend: "up" | "down" | "stable";
  description: string;
  pulldownFactors: string[];
  regionsAffected: { region: string; value: number }[];
  relatedStories: { title: string; slug: string }[];
  sparklineData: number[];
};

export type MicroAction = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  signal: SignalId;
  globalCount: string;
};

export type CommunityActivity = {
  id: string;
  signal: SignalId;
  text: string;
  timeAgo: string;
};

// ─── Signal colour maps ───────────────────────────────────────────────────────

export const SIGNAL_COLORS: Record<SignalId, string> = {
  climate: "bg-blue-500",
  food: "bg-emerald-500",
  biodiversity: "bg-amber-500",
  circularity: "bg-purple-500",
};

export const SIGNAL_DOT_COLORS: Record<SignalId, string> = {
  climate: "bg-blue-400",
  food: "bg-emerald-400",
  biodiversity: "bg-amber-400",
  circularity: "bg-purple-400",
};

export const SIGNAL_PILL_TEXT: Record<SignalId, string> = {
  climate: "Climate",
  food: "Food",
  biodiversity: "Biodiversity",
  circularity: "Circularity",
};

// ─── Signal details ───────────────────────────────────────────────────────────

export const SIGNAL_DETAILS: SignalDetail[] = [
  {
    id: "climate",
    name: "Climate Stability Index",
    value: 68,
    delta: 2.1,
    trend: "up",
    description: "A composite signal of heat balance, emissions trajectory, and adaptation readiness across regions.",
    pulldownFactors: [
      "Arctic sea ice extent dropped 4% below 20-year average",
      "Southeast Asian emissions rose 3.2% QoQ despite pledges",
      "Adaptation funding gap widened to $194B globally",
    ],
    regionsAffected: [
      { region: "South Asia", value: 61 },
      { region: "Sub-Saharan Africa", value: 54 },
      { region: "Northern Europe", value: 79 },
      { region: "Latin America", value: 66 },
    ],
    relatedStories: [
      { title: "How Kolkata is rethinking flood resilience", slug: "kolkata-flood-resilience" },
      { title: "The quiet carbon capture revolution in Iceland", slug: "iceland-carbon-capture" },
    ],
    sparklineData: [64, 63, 64, 65, 65, 66, 66, 67, 67, 67, 68, 68],
  },
  {
    id: "food",
    name: "Global Food Resilience",
    value: 74,
    delta: 1.4,
    trend: "up",
    description: "A systems-level view of crop diversity, supply continuity, and vulnerability to climate disruption.",
    pulldownFactors: [
      "Wheat supply chain still concentrated in 4 countries",
      "Pollinator populations declining in temperate zones",
      "Cold chain infrastructure gaps in Sub-Saharan Africa",
    ],
    regionsAffected: [
      { region: "East Africa", value: 48 },
      { region: "South Asia", value: 62 },
      { region: "Western Europe", value: 85 },
      { region: "Central America", value: 59 },
    ],
    relatedStories: [
      { title: "Millet's comeback: India's ancient grain goes global", slug: "millet-comeback" },
      { title: "Urban farms feeding 10,000 in Nairobi", slug: "nairobi-urban-farms" },
    ],
    sparklineData: [70, 71, 71, 72, 72, 73, 73, 73, 74, 74, 74, 74],
  },
  {
    id: "biodiversity",
    name: "Biodiversity Health",
    value: 59,
    delta: -0.8,
    trend: "down",
    description: "An indicator of ecosystem vitality, species protection, and restoration momentum worldwide.",
    pulldownFactors: [
      "Amazon deforestation rate increased 12% year-over-year",
      "Coral reef bleaching events now occurring annually",
      "Insect biomass declined 2.5% in monitored European habitats",
    ],
    regionsAffected: [
      { region: "Amazon Basin", value: 42 },
      { region: "Coral Triangle", value: 47 },
      { region: "Central Africa", value: 55 },
      { region: "Scandinavia", value: 76 },
    ],
    relatedStories: [
      { title: "Rewilding the Scottish Highlands: 5 years in", slug: "scottish-rewilding" },
      { title: "Can AI track every whale in the ocean?", slug: "ai-whale-tracking" },
    ],
    sparklineData: [63, 62, 62, 61, 61, 60, 60, 60, 59, 59, 59, 59],
  },
  {
    id: "circularity",
    name: "Resource Circularity",
    value: 63,
    delta: 1.9,
    trend: "up",
    description: "Tracks how effectively materials are reused, recovered, and reintegrated into planetary value chains.",
    pulldownFactors: [
      "E-waste recycling rate still below 20% globally",
      "Textile waste grew 8% YoY driven by fast fashion",
      "Rare earth mineral recovery infrastructure lacking outside China",
    ],
    regionsAffected: [
      { region: "Western Europe", value: 78 },
      { region: "East Asia", value: 71 },
      { region: "South Asia", value: 49 },
      { region: "North America", value: 61 },
    ],
    relatedStories: [
      { title: "Amsterdam's circular economy blueprint", slug: "amsterdam-circular" },
      { title: "The repair café movement reaches 3,000 locations", slug: "repair-cafes" },
    ],
    sparklineData: [58, 58, 59, 59, 60, 60, 61, 61, 62, 62, 63, 63],
  },
];

// ─── Regional data ────────────────────────────────────────────────────────────

export const REGIONAL_DATA: Record<string, Record<SignalId, number>> = {
  "West Bengal, India": {
    climate: 61,
    food: 64,
    biodiversity: 52,
    circularity: 51,
  },
};

// ─── Micro actions ────────────────────────────────────────────────────────────

export const MICRO_ACTIONS: MicroAction[] = [
  { id: "a1", emoji: "🌱", title: "Plant a native tree", description: "One native species in your area helps local ecosystems recover.", signal: "biodiversity", globalCount: "18.2k" },
  { id: "a2", emoji: "🍽️", title: "One plant meal this week", description: "Swap one meal to plant-based. Small shift, big signal.", signal: "food", globalCount: "42.7k" },
  { id: "a3", emoji: "♻️", title: "Repair before replacing", description: "Fix something instead of buying new. Break the cycle.", signal: "circularity", globalCount: "9.8k" },
  { id: "a4", emoji: "🚶", title: "Car-free day", description: "Walk, cycle, or transit for one full day.", signal: "climate", globalCount: "31.1k" },
  { id: "a5", emoji: "🐝", title: "Report a pollinator", description: "Spot a bee or butterfly? Log it for citizen science.", signal: "biodiversity", globalCount: "6.3k" },
  { id: "a6", emoji: "💧", title: "5-minute shower week", description: "Cap every shower to 5 minutes for 7 days.", signal: "climate", globalCount: "15.9k" },
  { id: "a7", emoji: "🧺", title: "Donate unused clothes", description: "Clear your closet. Feed the circular economy.", signal: "circularity", globalCount: "22.4k" },
  { id: "a8", emoji: "🌾", title: "Buy local produce", description: "One grocery trip, all local. Shorten the supply chain.", signal: "food", globalCount: "28.6k" },
];

// ─── Community feed ───────────────────────────────────────────────────────────

export const COMMUNITY_FEED: CommunityActivity[] = [
  { id: "c1", signal: "circularity", text: "12 people in Kolkata logged a low-waste week", timeAgo: "2h ago" },
  { id: "c2", signal: "climate", text: "West Bengal's climate score improved 0.3% this month", timeAgo: "5h ago" },
  { id: "c3", signal: "biodiversity", text: "8 pollinator sightings reported in Sundarbans region", timeAgo: "yesterday" },
  { id: "c4", signal: "food", text: "34 plant-based meals logged in your area this week", timeAgo: "yesterday" },
  { id: "c5", signal: "circularity", text: "3 repair events organised in South Kolkata", timeAgo: "2d ago" },
  { id: "c6", signal: "climate", text: "156 car-free days pledged across India this month", timeAgo: "3d ago" },
];
