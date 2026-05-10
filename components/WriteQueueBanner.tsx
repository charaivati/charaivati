"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { subscribeToQueue } from "@/lib/writeQueue";

export default function WriteQueueBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => subscribeToQueue(setCount), []);

  return (
    <>
      <Toaster position="bottom-right" richColors closeButton />
      {count > 0 && (
        <div
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm shadow-lg"
          style={{ background: "#1c3557", color: "#93c5fd", border: "1px solid #3b82f6" }}
        >
          <span className="animate-pulse">⏳</span>
          {count} unsaved change{count !== 1 ? "s" : ""} — syncing…
        </div>
      )}
    </>
  );
}
