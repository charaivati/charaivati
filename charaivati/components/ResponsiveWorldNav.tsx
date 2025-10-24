// File: components/ResponsiveWorldNav.tsx
"use client";


import React, { useState } from "react";
import { Menu, Globe, Map, Users, Layers, Compass } from "lucide-react";


type Props = {
activeId?: string;
onSelect: (id: string) => void;
compact?: boolean; // when compact show as button/hamburger
};


const ITEMS: { id: string; label: string; icon?: any; hint?: string }[] = [
{ id: "Self", label: "You", icon: Users, hint: "Personal" },
{ id: "State", label: "Society", icon: Map, hint: "Local & State" },
{ id: "Nation", label: "Nation", icon: Globe, hint: "Country-wide" },
{ id: "Earth", label: "Earth", icon: Layers, hint: "Global" },
{ id: "Universal", label: "Universe", icon: Compass, hint: "Beyond" },
];


export default function ResponsiveWorldNav({ activeId, onSelect, compact = false }: Props) {
const [open, setOpen] = useState(false);


if (compact) {
return (
<div>
<button
aria-expanded={open}
aria-label="Open navigation"
onClick={() => setOpen((s) => !s)}
className="p-2 rounded-md bg-white/6 hover:bg-white/10"
>
<Menu size={18} />
</button>


{open && (
<div className="absolute right-4 top-12 z-50 w-64 p-3 bg-black rounded-lg border border-white/6 shadow-lg">
<nav className="flex flex-col gap-2">
{ITEMS.map((it) => {
const Icon = it.icon;
const active = activeId === it.id;
return (
<button
key={it.id}
onClick={() => {
onSelect(it.id);
setOpen(false);
}}
className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition ${
active ? "bg-red-700 text-white" : "hover:bg-white/6"
}`}
>
{Icon ? <Icon size={16} /> : null}
<div>
<div className="font-medium">{it.label}</div>
<div className="text-xs text-gray-400">{it.hint}</div>
</div>
</button>
);
})}
</nav>
</div>
)}
</div>
);
}

return (
<nav className="flex flex-col gap-2">
{ITEMS.map((it) => {
const Icon = it.icon;
const active = activeId === it.id;
return (
<button
key={it.id}
onClick={() => onSelect(it.id)}
aria-current={active ? "page" : undefined}
className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition ${
active ? "bg-red-700 text-white shadow" : "hover:bg-white/6"
}`}
>
<div className="w-9 h-9 rounded-full bg-white/6 flex items-center justify-center">
{Icon ? <Icon size={16} /> : null}
</div>
<div className="flex-1">
<div className="font-medium leading-tight">{it.label}</div>
<div className="text-xs text-gray-400">{it.hint}</div>
</div>
</button>
);
})}
</nav>
);
}