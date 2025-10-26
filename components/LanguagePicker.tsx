

"use client";

import React from "react";

type LanguagePickerProps = {
  onSelect: (code: string, name?: string) => void;
  onClose: () => void;
  glyphMode?: boolean;
};

const langs = ["English","हिन्दी","Español","Français","中文","العربية"];

export default function LanguagePicker({ onSelect, onClose }: LanguagePickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-black/90 p-6 rounded-xl max-w-lg w-full">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Choose Language</h2>
          <button onClick={onClose} className="text-gray-400">X</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {langs.map(lang=>(
            <button key={lang}
              onClick={()=>onSelect(lang)}
              className="p-3 bg-white/10 rounded-lg hover:bg-white/20 text-white">
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
