export function kindLabel(page: { type: string; pageType: string }): string {
  if (page.type === "health")                    return "Health business";
  if (page.pageType === "helping")               return "Helping initiative";
  if (page.pageType === "learning")              return "Learning";
  if (page.pageType === "service")               return "Service";
  if (page.pageType === "community_group")       return "Community Group";
  return "Store";
}
