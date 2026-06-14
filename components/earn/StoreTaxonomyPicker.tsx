"use client";

import { PillButton } from "@/components/self/shared";

export interface TaxonomyOption {
  id: string;
  slug: string;
  title: string;
}

export interface StoreTaxonomy {
  categories: TaxonomyOption[];
  tags: TaxonomyOption[];
}

const MAX_CATEGORIES = 3;

interface StoreTaxonomyPickerProps {
  taxonomy: StoreTaxonomy;
  selectedCategoryIds: string[];
  selectedTagIds: string[];
  onChange: (next: { categoryIds: string[]; tagIds: string[] }) => void;
  labels: {
    categoriesLabel: string;
    categoriesPrompt: string;
    tagsLabel: string;
    tagsPrompt: string;
    categoriesCap: string;
  };
}

export default function StoreTaxonomyPicker({
  taxonomy,
  selectedCategoryIds,
  selectedTagIds,
  onChange,
  labels,
}: StoreTaxonomyPickerProps) {
  function toggleCategory(id: string) {
    const isSelected = selectedCategoryIds.includes(id);
    if (!isSelected && selectedCategoryIds.length >= MAX_CATEGORIES) return;
    const next = isSelected
      ? selectedCategoryIds.filter((c) => c !== id)
      : [...selectedCategoryIds, id];
    onChange({ categoryIds: next, tagIds: selectedTagIds });
  }

  function toggleTag(id: string) {
    const isSelected = selectedTagIds.includes(id);
    const next = isSelected
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    onChange({ categoryIds: selectedCategoryIds, tagIds: next });
  }

  const atCap = selectedCategoryIds.length >= MAX_CATEGORIES;

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{labels.categoriesLabel}</p>
          {atCap && <p className="text-xs text-amber-400">{labels.categoriesCap}</p>}
        </div>
        <p className="text-xs text-gray-400">{labels.categoriesPrompt}</p>
        <div className="flex flex-wrap gap-2">
          {taxonomy.categories.map((c) => {
            const active = selectedCategoryIds.includes(c.id);
            return (
              <PillButton key={c.id} active={active} onClick={() => toggleCategory(c.id)}>
                {c.title}
              </PillButton>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">{labels.tagsLabel}</p>
        <p className="text-xs text-gray-400">{labels.tagsPrompt}</p>
        <div className="flex flex-wrap gap-2">
          {taxonomy.tags.map((t) => {
            const active = selectedTagIds.includes(t.id);
            return (
              <PillButton key={t.id} active={active} onClick={() => toggleTag(t.id)}>
                {t.title}
              </PillButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}
