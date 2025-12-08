// Configuration for section tag matching (no DB changes needed)
// Place this in a shared constants file or at top of page.tsx

export const SECTION_TAG_MAPPINGS = {
    "epfo": {
      names: ["epfo", "employee-provident-fund", "pension", "pf"],
      description: "Employee Provident Fund"
    },
    "senior": {
      names: ["senior", "senior-citizen", "elderly", "aged", "senior-citizens", "pensioner"],
      description: "Senior Citizen Help"
    },
    "aadhar": {
      names: ["aadhar", "aadhaar", "identity", "uid", "aadhar-card"],
      description: "Aadhar Services"
    },
    "irctc": {
      names: ["irctc", "railway", "train", "ticket", "rail-booking"],
      description: "IRCTC Railway"
    },
    "ids": {
      names: ["ids", "identity", "document", "proof", "id-document"],
      description: "Identity Documents"
    },
    "health": {
      names: ["health", "healthcare", "medical", "insurance", "ayushman", "pm-jay"],
      description: "Health & Wellness"
    }
  };
  
  /**
   * Check if any post tags match a section's tag names
   * Returns true if there's at least one matching tag (case-insensitive)
   */
  export function doesPostMatchSection(postTags: string[], sectionSlug: string): boolean {
    const sectionConfig = SECTION_TAG_MAPPINGS[sectionSlug as keyof typeof SECTION_TAG_MAPPINGS];
    
    if (!sectionConfig) return false;
  
    const normalizedPostTags = postTags.map(t => t.toLowerCase().trim());
    const normalizedSectionTags = sectionConfig.names.map(t => t.toLowerCase().trim());
  
    // Return true if any post tag matches any section tag
    return normalizedPostTags.some(postTag => 
      normalizedSectionTags.some(sectionTag => 
        sectionTag.includes(postTag) || postTag.includes(sectionTag)
      )
    );
  }
  
  /**
   * Get matching section slugs for a post
   */
  export function getMatchingSections(postTags: string[]): string[] {
    return Object.keys(SECTION_TAG_MAPPINGS).filter(slug =>
      doesPostMatchSection(postTags, slug)
    );
  }