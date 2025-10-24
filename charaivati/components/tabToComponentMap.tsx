// components/tabToComponentMap.tsx
import dynamic from "next/dynamic";

// lazy imports for tabs (only load when needed)
const PersonalTab = dynamic(() => import("../app/(with-nav)/self/tabs/SelfTab"), { ssr: false });
const SocialTab = dynamic(() => import("../app/(with-nav)/self/tabs/SocialTab"), { ssr: false });
const LearnTab = dynamic(() => import("../app/(with-nav)/self/tabs/LearningTab"), { ssr: false });
const EarnTab = dynamic(() => import("../app/(with-nav)/self/tabs/EarningTab"), { ssr: false });

export default function getTabComponentForSlug(slug: string | undefined) {
  switch (slug) {
    case "personal":
      return PersonalTab;
    case "social":
      return SocialTab;
    case "learn":
    case "learning":
      return LearnTab;
    case "earn":
    case "income":
      return EarnTab;
    default:
      return PersonalTab;
  }
}
