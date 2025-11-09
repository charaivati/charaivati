// app/(business)/layout.tsx
import React from "react";
import TopBar from "@/components/TopBar";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="w-full p-3 flex justify-end">
        <TopBar />
      </header>
      <main>{children}</main>
    </div>
  );
}
