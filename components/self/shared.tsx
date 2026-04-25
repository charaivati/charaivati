"use client";
// components/self/shared.tsx — primitive UI components shared across all Self blocks

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

// ─── Tiny utility ─────────────────────────────────────────────────────────────

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Primitive UI ─────────────────────────────────────────────────────────────

export function PillButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
          : "border-gray-700 bg-transparent text-gray-400 hover:border-gray-500"
      }`}>
      {children}
    </button>
  );
}

export function SectionCard({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-gray-900 ${className}`}
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), " +   /* top-edge highlight — light from above */
          "0 2px 8px rgba(0,0,0,0.8), " +              /* close shadow */
          "0 8px 40px rgba(0,0,0,0.55)",               /* diffuse lift shadow */
      }}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{children}</p>;
}

export function TextInput({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-white
        placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors ${className}`}
    />
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────

export function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  headerExtra,
  collapsedPreview,
  triggerOpen,
  triggerClose,
  onToggle,
  keepMounted = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  /** Shown below title only when collapsed */
  collapsedPreview?: React.ReactNode;
  triggerOpen?: number;
  /** Increment to force-close from parent */
  triggerClose?: number;
  /** Called whenever open state changes */
  onToggle?: (open: boolean) => void;
  /** Keep children mounted (but hidden) when closed — for preloading */
  keepMounted?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  }

  useEffect(() => {
    if (triggerOpen && triggerOpen > 0) { setOpen(true); onToggle?.(true); }
  }, [triggerOpen]);

  useEffect(() => {
    if (triggerClose && triggerClose > 0) { setOpen(false); onToggle?.(false); }
  }, [triggerClose]);

  return (
    <SectionCard>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer select-none">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          {!open && collapsedPreview && (
            <div className="mt-1.5">{collapsedPreview}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
        </div>
      </div>
      {keepMounted ? (
        <div className={open ? "px-5 pb-6" : "hidden"} style={open ? { animation: "sectionOpen 400ms ease both" } : undefined}>
          <style>{`
            @keyframes sectionOpen {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {children}
        </div>
      ) : open ? (
        <div className="px-5 pb-6" style={{ animation: "sectionOpen 400ms ease both" }}>
          <style>{`
            @keyframes sectionOpen {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {children}
        </div>
      ) : null}
    </SectionCard>
  );
}

// ─── AI generate / regenerate button ─────────────────────────────────────────

export function AIGenerateButton({
  loading,
  hasResult,
  onGenerate,
  labels = {},
  className = "",
}: {
  loading: boolean;
  hasResult: boolean;
  onGenerate: () => void;
  labels?: { generate?: string; regenerate?: string; loading?: string };
  className?: string;
}) {
  const {
    generate    = "Generate",
    regenerate  = "↺ Regenerate",
    loading: lbl = "Generating…",
  } = labels;

  return (
    <button type="button" onClick={onGenerate} disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed ${
        hasResult
          ? "border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
          : "bg-indigo-600 hover:bg-indigo-500 text-white"
      } ${className}`}>
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" />{lbl}</>
        : hasResult ? regenerate : generate}
    </button>
  );
}

// ─── AI status badge (success / fallback) ────────────────────────────────────

export function AiStatusBadge({ status }: { status: "ai" | "fallback" | null }) {
  if (!status) return null;
  if (status === "ai") return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-green-400/80 leading-none select-none" title="Generated by AI">
      ✦ AI
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-500/70 leading-none select-none" title="Using estimated defaults — AI unavailable">
      ~ estimated
    </span>
  );
}

// ─── Amber "AI unavailable" fallback banner ───────────────────────────────────

export function FallbackBanner({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 leading-relaxed">
      {message ?? "Our AI suggestions are unavailable right now — we'll get back to you soon."}
      <br />
      <span className="text-amber-400/70 text-xs">
        In the meantime, add your own content below. Hit Regenerate anytime to let AI improve it.
      </span>
    </div>
  );
}
