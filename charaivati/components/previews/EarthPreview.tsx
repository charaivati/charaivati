import React from "react";

export default function EarthPreview(): JSX.Element {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="rounded-full w-80 h-80 bg-gradient-to-br from-[#2b93d6] to-[#0b4fa0] shadow-inner flex items-center justify-center">
        <div className="w-64 h-64 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.06),transparent_20%),radial-gradient(circle_at_70%_70%,rgba(0,0,0,0.06),transparent_30%)]" />
      </div>
    </div>
  );
}
