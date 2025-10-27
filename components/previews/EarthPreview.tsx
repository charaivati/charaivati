// components/EarthPreview.tsx
import React from "react";

export default function EarthPreview(): React.ReactElement {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="rounded-full w-80 h-80 bg-gradient-to-br from-[#2b93d6] to-[#0b4fa0] shadow-inner flex items-center justify-center">
        <div
          className="w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06) 0%, transparent 20%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.06) 0%, transparent 30%)",
          }}
        />
      </div>
    </div>
  );
}
