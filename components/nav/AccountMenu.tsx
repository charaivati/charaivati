"use client";
// Shared account/profile dropdown — used by app/app/layout.tsx and app/store/[id]/layout.tsx.
// storeContext is optional and only populated by the store layout (delivery address, owner links).

import { useState } from "react";

const A = {
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type AccountMenuUser = { id: string; name: string | null; email?: string | null };

type AccountMenuProps = {
  user: AccountMenuUser | null;
  isGuest: boolean;
  pathname: string | null;
  onSignOut: () => void;
  t?: (slug: string, fallback: string) => string;
  storeContext?: {
    deliveryLabel: string;
    onOpenAddress: () => void;
    isOwner: boolean;
    storeId: string;
  };
};

const itemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 16px",
  fontSize: 13,
  color: A.text,
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
};

export default function AccountMenu({ user, isGuest, pathname, onSignOut, t, storeContext }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const tr = t ?? ((_: string, fallback: string) => fallback);

  if (!user) {
    return (
      <a
        href={`/login?redirect=${encodeURIComponent(pathname ?? "/app/home")}`}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          textDecoration: "none",
          padding: "6px 14px",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 6,
        }}
      >
        {tr("app-layout-sign-in", "Sign in")}
      </a>
    );
  }

  const initial = (user.name ?? user.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: A.accent,
          border: "none",
          cursor: "pointer",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initial}
      </button>

      {open && (
        <>
          <div onClick={() => { setOpen(false); setBusinessOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 40 }} />

          <div
            style={{
              position: "absolute",
              right: 0,
              top: 42,
              zIndex: 50,
              background: A.surface,
              borderRadius: 10,
              border: `1px solid ${A.border}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 210,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${A.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: A.text }}>{user.name ?? "Account"}</div>
              {user.email && <div style={{ fontSize: 11, color: A.textMuted, marginTop: 2 }}>{user.email}</div>}
            </div>

            {storeContext && (
              <button
                onClick={() => { storeContext.onOpenAddress(); setOpen(false); }}
                style={{ ...itemStyle, borderTop: `1px solid ${A.border}` }}
              >
                📍 {storeContext.deliveryLabel}
              </button>
            )}

            {isGuest ? (
              <a
                href={`/login?redirect=${encodeURIComponent(pathname ?? "/app/home")}`}
                style={{ ...itemStyle, color: A.accent, fontWeight: 600, borderTop: `1px solid ${A.border}` }}
              >
                {tr("app-layout-sign-in-up", "Sign in / Sign up")}
              </a>
            ) : (
              <>
                <a href={`/user/${user.id}`} style={{ ...itemStyle, borderTop: `1px solid ${A.border}` }}>
                  {tr("app-layout-my-account", "My Account")}
                </a>

                {storeContext && (
                  <a href="/app/orders" style={itemStyle}>📦 My Orders</a>
                )}

                {storeContext?.isOwner && storeContext.storeId && (
                  <a href={`/store/${storeContext.storeId}/orders`} style={{ ...itemStyle, color: A.accent, fontWeight: 600 }}>
                    📋 Manage Orders →
                  </a>
                )}

                {storeContext?.isOwner && (
                  <div>
                    <button onClick={() => setBusinessOpen((v) => !v)} style={itemStyle}>
                      🏪 My Businesses
                    </button>
                    {businessOpen && (
                      <div>
                        <a href="/self?tab=earn" style={{ ...itemStyle, padding: "10px 16px 10px 36px" }} onClick={() => setOpen(false)}>
                          Open website
                        </a>
                        <a href="/app/initiatives" style={{ ...itemStyle, padding: "10px 16px 10px 36px" }} onClick={() => setOpen(false)}>
                          Open app
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <a href="/apps" style={itemStyle}>📱 {tr("app-layout-get-app", "Get the app")}</a>

                <a href={`/?from=${encodeURIComponent(pathname ?? "/app/home")}`} style={itemStyle}>
                  🌐 {tr("app-layout-language", "Language")}
                </a>

                <div style={{ borderTop: `1px solid ${A.border}`, margin: "4px 0" }} />

                <button onClick={onSignOut} style={{ ...itemStyle, color: "#EF4444" }}>
                  {tr("app-layout-sign-out", "Sign out")}
                </button>

                <div style={{ borderTop: `1px solid ${A.border}`, margin: "4px 0" }} />

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "8px 16px" }}>
                  <a href="/privacy-policy" style={{ fontSize: 11, color: A.textMuted, textDecoration: "none" }}>
                    {tr("app-layout-privacy", "Privacy Policy")}
                  </a>
                  <a href="/terms-of-service" style={{ fontSize: 11, color: A.textMuted, textDecoration: "none" }}>
                    {tr("app-layout-terms", "Terms")}
                  </a>
                  <a href="/about-charaivati" style={{ fontSize: 11, color: A.textMuted, textDecoration: "none" }}>
                    {tr("app-layout-about", "About")}
                  </a>
                </div>
              </>
            )}

            <div style={{ borderTop: `1px solid ${A.border}`, margin: "4px 0" }} />

            <a href="/" style={itemStyle} onClick={() => setOpen(false)}>
              🌍 {tr("app-layout-main-site", "Go to main website")}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
