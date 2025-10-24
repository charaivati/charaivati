// File: components/TopTabs.tsx
"use client";


import React from "react";


type Props = { activeId?: string; onSelect: (id: string) => void };


const TABS: { id: string; label: string }[] = [
{ id: "Self", label: "You" },
{ id: "State", label: "State" },
{ id: "Nation", label: "Nation" },
{ id: "Earth", label: "Earth" },
{ id: "Universal", label: "Universe" },
];


export default function TopTabs({ activeId, onSelect }: Props) {
return (
<div className="flex items-center gap-3 flex-wrap">
{TABS.map((t) => {
const active = activeId === t.id;
return (
<button
key={t.id}
onClick={() => onSelect(t.id)}
className={`px-4 py-2 rounded-full text-sm font-medium transition ${
active ? "bg-red-700 text-white shadow" : "bg-white/6 hover:bg-white/12"
}`}
aria-pressed={active}
>
{t.label}
</button>
);
})}
</div>
);
}