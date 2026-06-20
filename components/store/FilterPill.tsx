"use client";

const A = {
  border: "#E5E7EB",
  accent: "#6366f1",
  textMuted: "#6B7280",
  surface: "#FFFFFF",
};

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${active ? A.accent : A.border}`,
        background: active ? "#EEF2FF" : A.surface,
        color: active ? A.accent : A.textMuted,
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}
