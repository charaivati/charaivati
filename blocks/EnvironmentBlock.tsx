"use client";
// blocks/EnvironmentBlock.tsx

import React, { useState } from "react";
import { CollapsibleSection, TextInput, FieldLabel } from "@/components/self/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkspaceType = "home" | "office" | "coworking" | "hybrid" | "remote";
export type LivingWith    = "alone" | "family" | "roommates" | "partner";

export type EnvironmentProfile = {
  city: string;
  country: string;
  timezone: string;
  workspace: WorkspaceType | "";
  livingWith: LivingWith | "";
  constraints: string[];
  assets: string[];
};

// ─── Default ──────────────────────────────────────────────────────────────────

export function defaultEnvironmentProfile(): EnvironmentProfile {
  return {
    city: "", country: "", timezone: "", workspace: "", livingWith: "",
    constraints: [], assets: [],
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSPACE_TYPES: WorkspaceType[]    = ["home", "office", "coworking", "hybrid", "remote"];
const LIVING_WITH_OPTIONS: LivingWith[]   = ["alone", "family", "roommates", "partner"];

// ─── TagList ──────────────────────────────────────────────────────────────────

function TagList({
  items,
  onRemove,
  onAdd,
  tagClass,
  placeholder,
}: {
  items: string[];
  onRemove: (item: string) => void;
  onAdd: (item: string) => void;
  tagClass: string;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const v = input.trim();
      if (v && !items.includes(v)) { onAdd(v); }
      setInput("");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span
            key={item}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tagClass}`}
          >
            {item}
            <button
              onClick={() => onRemove(item)}
              className="opacity-60 hover:opacity-100 ml-0.5 leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
      />
    </div>
  );
}

// ─── EnvironmentSection ───────────────────────────────────────────────────────

export function EnvironmentSection({
  env,
  onChange,
}: {
  env: EnvironmentProfile;
  onChange: (e: EnvironmentProfile) => void;
}) {
  function set<K extends keyof EnvironmentProfile>(k: K, v: EnvironmentProfile[K]) {
    onChange({ ...env, [k]: v });
  }

  const badgeBase = "px-3 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer capitalize";
  function badgeClass(selected: boolean) {
    return selected
      ? `${badgeBase} bg-gray-600 border-gray-500 text-white`
      : `${badgeBase} bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600`;
  }

  return (
    <CollapsibleSection
      title="Your environment"
      defaultOpen={false}
    >
      <div className="space-y-5 pt-1">

        {/* Location */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</p>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px] space-y-1">
              <FieldLabel>City</FieldLabel>
              <TextInput
                value={env.city}
                onChange={v => set("city", v)}
                placeholder="Mumbai"
              />
            </div>
            <div className="flex-1 min-w-[120px] space-y-1">
              <FieldLabel>Country</FieldLabel>
              <TextInput
                value={env.country}
                onChange={v => set("country", v)}
                placeholder="India"
              />
            </div>
          </div>
          <div className="space-y-1">
            <FieldLabel>Timezone</FieldLabel>
            <TextInput
              value={env.timezone}
              onChange={v => set("timezone", v)}
              placeholder="Asia/Kolkata"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workspace</p>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_TYPES.map(w => (
              <button
                key={w}
                onClick={() => set("workspace", env.workspace === w ? "" : w)}
                className={badgeClass(env.workspace === w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Living with */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Living with</p>
          <div className="flex flex-wrap gap-2">
            {LIVING_WITH_OPTIONS.map(l => (
              <button
                key={l}
                onClick={() => set("livingWith", env.livingWith === l ? "" : l)}
                className={badgeClass(env.livingWith === l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Constraints */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Constraints</p>
          <TagList
            items={env.constraints}
            onRemove={item => set("constraints", env.constraints.filter(c => c !== item))}
            onAdd={item => set("constraints", [...env.constraints, item])}
            tagClass="bg-red-500/10 text-red-300 border-red-500/30"
            placeholder="Add constraint (Enter)"
          />
        </div>

        {/* Assets */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assets</p>
          <TagList
            items={env.assets}
            onRemove={item => set("assets", env.assets.filter(a => a !== item))}
            onAdd={item => set("assets", [...env.assets, item])}
            tagClass="bg-green-500/10 text-green-300 border-green-500/30"
            placeholder="Add asset (Enter)"
          />
        </div>

      </div>
    </CollapsibleSection>
  );
}
