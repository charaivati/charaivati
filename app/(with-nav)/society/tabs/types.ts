export type Topic = {
  id: string;
  label: string;
};

export type TopicResponse = {
  status: "yes" | "no" | "partial" | null;
  suggestion: string;
};
