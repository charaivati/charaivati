// File: components/NavControls.tsx
"use client";


import React from "react";
import { User, Globe, LogIn } from "lucide-react";


export default function NavControls() {
return (
<div className="flex items-center gap-2">
<button className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-sm flex items-center gap-2">
<Globe size={14} /> <span className="hidden sm:inline">Language</span>
</button>


<button className="px-3 py-2 rounded-lg bg-gradient-to-r from-red-700 to-pink-600 hover:from-red-600 hover:to-pink-500 text-sm flex items-center gap-2">
<User size={14} /> <span className="hidden sm:inline">Profile</span>
</button>


<button className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-sm flex items-center gap-2">
<LogIn size={14} /> <span className="hidden sm:inline">Login</span>
</button>
</div>
);
}
