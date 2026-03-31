"use client";
// blocks/DriveBlock.tsx — drive picker (State A typewriter + State B compact identity)

import React from "react";
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

export function DrivePickerStateB({
  drives, isGuest, saveState, pickerOpen, onToggle, onOpenPicker,
}: {
  drives: DriveType[]; isGuest: boolean; saveState: string;
  pickerOpen: boolean;
  onToggle: (d: DriveType) => void;
  onOpenPicker: () => void;
}) {
  return (
    <SectionCard className="px-5 py-3">
      <div className="group flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-500 text-xs select-none">◆</span>
            <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
              {drives.length === 1
                ? `You are ${DRIVE_IDENTITY[drives[0]]}.`
                : `You are ${DRIVE_IDENTITY[drives[0]]} · and ${DRIVE_IDENTITY[drives[1]]}.`}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {drives.map(driveId => {
                const driveInfo = DRIVES.find(d => d.id === driveId)!;
                return (
                  <span key={driveId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${DRIVE_PILL[driveId]}`}>
                    {driveInfo.label}
                    <button type="button" onClick={() => onToggle(driveId)}
                      className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5">×</button>
                  </span>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={onOpenPicker}
            className="text-xs text-gray-600 hover:text-indigo-400 transition-colors mt-1.5">
            {drives.length < 2 ? "+ Add a second drive" : "✎ Change drives"}
          </button>
          {isGuest && (
            <p className="text-xs text-yellow-600/80 mt-1">
              Guest mode — saved locally for 7 days.{" "}
              <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
            </p>
          )}
        </div>
        <span className={`text-xs mt-0.5 transition-opacity ${
          saveState === "idle"   ? "opacity-0"                  :
          saveState === "saving" ? "opacity-100 text-gray-500"  :
          saveState === "saved"  ? "opacity-100 text-green-500" :
                                   "opacity-100 text-red-400"
        }`}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
        </span>
      </div>
      {pickerOpen && (
        <div className="mt-3">
          <DriveGrid drives={drives} onToggle={onToggle} visible animated={false} />
        </div>
      )}
    </SectionCard>
  );
}
