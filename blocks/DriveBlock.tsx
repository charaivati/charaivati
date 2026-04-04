"use client";
// blocks/DriveBlock.tsx — drive picker (State A typewriter + State B compact identity)

import React, { useEffect, useState } from "react";
import { SectionCard } from "@/components/self/shared";
import { DRIVES, DRIVE_IDENTITY } from "@/hooks/useSelfState";
import type { DriveType } from "@/types/self";

const DRIVE_PILL: Record<DriveType, string> = {
  learning: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  helping:  "text-rose-400 border-rose-500/40 bg-rose-500/10",
  building: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
  doing:    "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

function DriveGrid({
  drives,
  onToggle,
  visible,
  animated,
}: {
  drives: DriveType[];
  onToggle: (d: DriveType) => void;
  visible: boolean;
  animated: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {DRIVES.map((d, idx) => {
        const selected = drives.includes(d.id);
        const atLimit  = !selected && drives.length >= 2;
        return (
          <button key={d.id} type="button" onClick={() => onToggle(d.id)} disabled={atLimit}
            className={`rounded-xl border px-4 py-4 text-left transition-all ${
              selected ? "border-indigo-500 bg-indigo-500/10"
                : atLimit ? "border-gray-800 bg-gray-950/20 opacity-40 cursor-not-allowed"
                : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
            }${animated ? " drive-card" : ""}`}
            style={animated ? {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
              transitionDelay: `${idx * 120}ms`,
            } : undefined}>
            <div className={`text-sm font-semibold mb-1 ${selected ? "text-indigo-300" : "text-white"}`}>
              {selected && <span className="mr-1.5 text-indigo-400">✓</span>}{d.label}
            </div>
            <div className="text-xs text-gray-500">{d.description}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── State A: typewriter greeting + full drive grid ───────────────────────────

export function DrivePickerStateA({
  typedLine1, typedLine2, line2Started, typingDone, drivesVisible,
  drives, isGuest, saveState, onToggle,
}: {
  typedLine1: string; typedLine2: string; line2Started: boolean;
  typingDone: boolean; drivesVisible: boolean;
  drives: DriveType[]; isGuest: boolean; saveState: string;
  onToggle: (d: DriveType) => void;
}) {
  return (
    <SectionCard>
      <style>{`
        @keyframes tw-blink{0%,100%{opacity:1}50%{opacity:0}}
        .tw-cursor{animation:tw-blink 0.8s step-start infinite;color:#818cf8}
        @keyframes tw-cursor-fade{to{opacity:0}}
        .tw-cursor-done{animation:tw-cursor-fade 0.4s ease 0.4s forwards;color:#818cf8}
        .drive-card{transition:opacity 300ms ease-out,transform 300ms ease-out}
      `}</style>
      <div className="px-6 pt-8 pb-4 flex items-start justify-between">
        <div className="flex-1 min-h-[6rem]">
          <p className="text-base text-gray-400 tracking-wide">
            {typedLine1}
            {typedLine1 && !line2Started && (
              <span className={typingDone ? "tw-cursor-done" : "tw-cursor"}>|</span>
            )}
          </p>
          {line2Started && (
            <h2 className="text-3xl font-bold text-white mt-2 leading-snug">
              {typedLine2}
              <span className={typingDone ? "tw-cursor-done" : "tw-cursor"}>|</span>
            </h2>
          )}
          {isGuest && (
            <p className="text-sm text-yellow-600 mt-2">
              Guest mode — saved locally for 7 days.{" "}
              <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
            </p>
          )}
        </div>
        <span className={`text-xs mt-1 transition-opacity ${
          saveState === "idle"   ? "opacity-0"                  :
          saveState === "saving" ? "opacity-100 text-gray-500"  :
          saveState === "saved"  ? "opacity-100 text-green-500" :
                                   "opacity-100 text-red-400"
        }`}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
        </span>
      </div>
      <div className="px-6 pb-7">
        <DriveGrid drives={drives} onToggle={onToggle} visible={drivesVisible} animated />
      </div>
    </SectionCard>
  );
}

// ─── State B: compact identity + optional inline picker ───────────────────────

const DRIVE_LINE_COLOR: Record<DriveType, string> = {
  learning: "text-sky-300",
  helping:  "text-rose-300",
  building: "text-indigo-300",
  doing:    "text-amber-300",
};

const LINE1 = "Keep moving";
const LINE2 = "चरैवेति चरैवेति";

export function DrivePickerStateB({
  drives, isGuest, saveState, pickerOpen, onToggle, onOpenPicker,
}: {
  drives: DriveType[]; isGuest: boolean; saveState: string;
  pickerOpen: boolean;
  onToggle: (d: DriveType) => void;
  onOpenPicker: () => void;
}) {
  const [km, setKm] = useState("");
  const [ch, setCh] = useState("");
  const [activeLine, setActiveLine] = useState<1 | 2 | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    async function loop() {
      while (!cancelled) {
        // type line 1
        setActiveLine(1);
        for (let i = 1; i <= LINE1.length; i++) {
          if (cancelled) return;
          setKm(LINE1.slice(0, i));
          await wait(90);
        }
        await wait(500);
        // type line 2
        setActiveLine(2);
        for (let i = 1; i <= LINE2.length; i++) {
          if (cancelled) return;
          setCh(LINE2.slice(0, i));
          await wait(75);
        }
        setActiveLine(null);
        await wait(2800);
        // reset
        setKm(""); setCh("");
        await wait(350);
      }
    }

    loop();
    return () => { cancelled = true; };
  }, []);

  return (
    <SectionCard className="px-5 py-2.5 sm:py-4">
      <style>{`
        @keyframes drive-glow {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.4) drop-shadow(0 0 8px currentColor); }
        }
        @keyframes tw-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .drive-line-1 { animation: drive-glow 3.2s ease-in-out infinite; }
        .drive-line-2 { animation: drive-glow 3.2s ease-in-out infinite 1.6s; }
        .tw-cursor-b  { animation: tw-blink 0.75s step-start infinite; }
      `}</style>

      {/* Content row — minHeight on the ROW forces all children to stretch to it */}
      <div
        className="flex flex-row items-stretch gap-3 sm:gap-4"
        style={{ minHeight: drives.length === 2 ? "4.2rem" : "3.6rem" }}
      >

        {/* Drives */}
        <div
          className="flex-1 min-w-0 space-y-0.5 overflow-hidden flex flex-col justify-center"
        >
          {drives.map((driveId, index) => (
            <p
              key={driveId}
              className={`font-bold leading-tight truncate ${DRIVE_LINE_COLOR[driveId]} ${index === 0 ? "drive-line-1" : "drive-line-2"}`}
              style={{ fontSize: "clamp(1rem, 4vw, 1.6rem)" }}
            >
              {index === 0
                ? `You are ${DRIVE_IDENTITY[driveId]}.`
                : `And ${DRIVE_IDENTITY[driveId]}.`}
            </p>
          ))}
        </div>

        {/* ── MOBILE right block: pencil · divider · compact tagline ── */}
        <div className="sm:hidden flex items-stretch gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPicker}
            title={pickerOpen ? "Close editor" : "Edit drives"}
            className={`self-center p-1.5 rounded-md transition-colors shrink-0 ${
              pickerOpen ? "text-indigo-400 bg-indigo-500/10" : "text-gray-700 hover:text-indigo-400 hover:bg-gray-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.982 9.543A1.75 1.75 0 0 0 3.5 10.78v1.47c0 .414.336.75.75.75h1.47a1.75 1.75 0 0 0 1.237-.513l7.031-7.03a1.75 1.75 0 0 0 0-2.475ZM11.719 3.22a.25.25 0 0 1 .354 0l.707.707a.25.25 0 0 1 0 .354L11.5 5.56l-1.06-1.061 1.279-1.28ZM9.38 5.56l1.06 1.06-5.323 5.323a.25.25 0 0 1-.177.073H4v-.94a.25.25 0 0 1 .073-.177L9.38 5.56Z" />
            </svg>
          </button>
          <div className="w-[3px] rounded-full bg-gradient-to-b from-transparent via-gray-500/50 to-transparent shrink-0" />
          <div style={{ width: "62px", minWidth: "62px", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
            <div style={{ height: "1.1rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <span className="text-gray-300 font-medium" style={{ fontSize: "0.5rem", lineHeight: 1 }}>
                {km}{activeLine === 1 && <span className="tw-cursor-b text-gray-400">|</span>}
              </span>
            </div>
            <div style={{ height: "0.9rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <span className="text-gray-500" style={{ fontSize: "0.42rem", lineHeight: 1 }}>
                {ch}{activeLine === 2 && <span className="tw-cursor-b text-gray-600">|</span>}
              </span>
            </div>
          </div>
        </div>

        {/* ── DESKTOP right block: fixed at 30% width → divider always sits at 70% ── */}
        <div className="hidden sm:flex items-stretch gap-3 flex-none w-[30%]">
          <button
            type="button"
            onClick={onOpenPicker}
            title={pickerOpen ? "Close editor" : "Edit drives"}
            className={`self-center p-1.5 rounded-md transition-colors shrink-0 ${
              pickerOpen ? "text-indigo-400 bg-indigo-500/10" : "text-gray-700 hover:text-indigo-400 hover:bg-gray-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.982 9.543A1.75 1.75 0 0 0 3.5 10.78v1.47c0 .414.336.75.75.75h1.47a1.75 1.75 0 0 0 1.237-.513l7.031-7.03a1.75 1.75 0 0 0 0-2.475ZM11.719 3.22a.25.25 0 0 1 .354 0l.707.707a.25.25 0 0 1 0 .354L11.5 5.56l-1.06-1.061 1.279-1.28ZM9.38 5.56l1.06 1.06-5.323 5.323a.25.25 0 0 1-.177.073H4v-.94a.25.25 0 0 1 .073-.177L9.38 5.56Z" />
            </svg>
          </button>
          <div className="self-stretch w-[3px] rounded-full bg-gradient-to-b from-transparent via-gray-500/25 to-transparent shrink-0" />
          <div className="flex-1 min-w-0" style={{ textAlign: "right", overflow: "hidden" }}>
            <p style={{ fontSize: "clamp(0.9rem, 2.8vw, 1.12rem)", lineHeight: "1.9rem", height: "1.9rem", overflow: "hidden", whiteSpace: "nowrap", color: "rgb(209 213 219)", fontWeight: 500 }}>
              {km}{activeLine === 1 && <span className="tw-cursor-b" style={{ color: "rgb(156 163 175)" }}>|</span>}
            </p>
            <p style={{ fontSize: "clamp(0.75rem, 2.4vw, 0.95rem)", lineHeight: "1.6rem", height: "1.6rem", overflow: "hidden", whiteSpace: "nowrap", color: "rgb(107 114 128)" }}>
              {ch}{activeLine === 2 && <span className="tw-cursor-b" style={{ color: "rgb(75 85 99)" }}>|</span>}
            </p>
          </div>
        </div>

      </div>{/* end content row */}

      {/* Save state + guest notice */}
      <div className="mt-1 flex items-center justify-between">
        <span>
          {isGuest && (
            <p className="text-xs text-yellow-600/80">
              Guest mode —{" "}
              <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
            </p>
          )}
        </span>
        <span className={`text-xs transition-opacity ${
          saveState === "idle"   ? "opacity-0"                  :
          saveState === "saving" ? "opacity-100 text-gray-500"  :
          saveState === "saved"  ? "opacity-100 text-green-500" :
                                   "opacity-100 text-red-400"
        }`}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
        </span>
      </div>

      {/* Inline drive picker (edit mode) */}
      {pickerOpen && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-3">
            {drives.length < 2 ? "Add a second drive, or remove your current one." : "Remove a drive to swap it. Max 2."}
          </p>
          <DriveGrid drives={drives} onToggle={onToggle} visible animated={false} />
        </div>
      )}
    </SectionCard>
  );
}
