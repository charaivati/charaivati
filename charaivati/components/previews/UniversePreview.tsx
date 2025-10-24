import React from "react";

export default function UniversePreview(): JSX.Element {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full h-full rounded-full bg-[radial-gradient(circle_at_center,rgba(200,220,255,0.06),transparent_40%)] backdrop-blur-sm" />
    </div>
  );
}
