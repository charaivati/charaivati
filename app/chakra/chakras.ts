// Shared chakra data for both /chakra variants.
// spineY: vertical position along the figure, 0 = base (root), 1 = crown.
// Listed root -> crown so index 0 lights first as energy rises.

export type Chakra = {
  key: string;
  name: string;
  sanskrit: string;
  color: string;
  line: string;
  spineY: number;
  petals: number; // lotus petal count of the traditional symbol
  bija: string; // seed syllable drawn at the centre
};

export const CHAKRAS: Chakra[] = [
  { key: "root", name: "Root", sanskrit: "Muladhara", color: "#E5383B", line: "Grounding, safety, the earth beneath you.", spineY: 0.04, petals: 4, bija: "लं" },
  { key: "sacral", name: "Sacral", sanskrit: "Svadhisthana", color: "#FF7B00", line: "Creativity, flow, desire.", spineY: 0.2, petals: 6, bija: "वं" },
  { key: "solar", name: "Solar Plexus", sanskrit: "Manipura", color: "#FFD000", line: "Will, power, the fire within.", spineY: 0.38, petals: 10, bija: "रं" },
  { key: "heart", name: "Heart", sanskrit: "Anahata", color: "#38B000", line: "Love, compassion, connection.", spineY: 0.56, petals: 12, bija: "यं" },
  { key: "throat", name: "Throat", sanskrit: "Vishuddha", color: "#00B4D8", line: "Voice, truth, expression.", spineY: 0.72, petals: 16, bija: "हं" },
  { key: "thirdEye", name: "Third Eye", sanskrit: "Ajna", color: "#5A189A", line: "Insight, intuition, the inner gaze.", spineY: 0.86, petals: 2, bija: "ॐ" },
  { key: "crown", name: "Crown", sanskrit: "Sahasrara", color: "#9D4EDD", line: "Awareness, unity, the boundless.", spineY: 0.98, petals: 24, bija: "ॐ" },
];
