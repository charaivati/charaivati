"use client";

import { Pencil } from "lucide-react";

export type StoreFilterBanner = {
  id: string;
  isGlobal: boolean;
  imageUrl: string | null;
  heading: string | null;
  subheading: string | null;
  body: string | null;
};

export type StoreFilterItem = {
  id: string;
  name: string;
  order: number;
  bannerId: string | null;
  banner?: StoreFilterBanner | null;
  sectionIds: string[];
};

export interface FilterBarProps {
  filters: StoreFilterItem[];
  activeFilterId: string | null;
  onFilterChange: (id: string | null) => void;
  editMode: boolean;
  onEditFilters: () => void;
}

export default function FilterBar({ filters, activeFilterId, onFilterChange, editMode, onEditFilters }: FilterBarProps) {
  const pill = (active: boolean) =>
    active
      ? "bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors"
      : "text-white opacity-70 hover:opacity-100 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-all hover:bg-white/10";

  return (
    <div className="w-full bg-[#232F3E] border-b border-[#2E3A47] overflow-x-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto px-3 h-10 flex items-center gap-1">
        <button onClick={() => onFilterChange(null)} className={pill(activeFilterId === null)}>
          All
        </button>
        {filters.map((f) => (
          <button key={f.id} onClick={() => onFilterChange(f.id)} className={pill(activeFilterId === f.id)}>
            {f.name}
          </button>
        ))}
        {editMode && (
          <button
            onClick={onEditFilters}
            className="ml-2 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
            title="Manage filters"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
