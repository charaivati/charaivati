// components/UnderDevelopmentCard.tsx
import React from "react";

export default function UnderDevelopmentCard({
  title = "Under development",
  message,
  small = false
}: { title?: string; message?: string; small?: boolean }) {
  return (
    <div className={`rounded-2xl p-6 shadow-md bg-white/5 border border-white/6 ${small ? "max-w-xl" : "max-w-3xl"}`}>
      <div className="inline-block text-xs px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 mb-3">Under development</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-gray-300">{message ?? "This feature is being prepared. We'll launch it soon — stay tuned."}</p>
      <div className="mt-4">
        <button className="px-3 py-1 rounded-md border border-white/10 text-sm">Notify me</button>
      </div>
    </div>
  );
}
