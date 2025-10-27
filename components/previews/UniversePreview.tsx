// components/previews/UniversePreview.tsx
import React from "react";

export default function UniversePreview(): React.ReactElement {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="w-full h-full rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(200,220,255,0.06) 0%, transparent 40%)",
          backdropFilter: "blur(4px)",
        }}
      />
    </div>
  );
}
