// app/app/layout.tsx
"use client";
import { getLogoutRedirect } from "@/lib/logout";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const tabs = [
  { label: "Home", icon: "🏠", href: "/app/home" },
  { label: "Initiatives", icon: "🌱", href: "/app/initiatives" },
  { label: "Explore", icon: "❤️", href: "/app/saved" },
  { label: "Account", icon: "👤", href: "/store/account" },
];

const A = {
  nav: "#131921",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type User = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
};

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  async function handleSignOut() {
  const redirectTo = getLogoutRedirect(window.location.pathname);

  // Remove stale redirect memory
  try {
    sessionStorage.removeItem("charaivati.redirect");
  } catch {}

  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  window.location.href =
    "/login?redirect=" + encodeURIComponent(redirectTo);
}

  const initial =
    (user?.name ?? user?.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <>
      {/* Top bar */}
      <header
        style={{
          background: A.nav,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 13,
            letterSpacing: "0.1em",
          }}
        >
          <Link
              href="/app/home"
              style={{
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: "0.1em",
                textDecoration: "none",
              }}
          >
            charaivati
          </Link>
        </span>

        <div style={{ position: "relative" }}>
          {!loadingUser &&
            (user ? (
              <>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
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

                {profileOpen && (
                  <>
                    <div
                      onClick={() => setProfileOpen(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 40,
                      }}
                    />

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
                        minWidth: 200,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: `1px solid ${A.border}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: A.text,
                          }}
                        >
                          {user.name ?? "Account"}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: A.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {user.email}
                        </div>
                      </div>

                      <a
                        href="/store/account"
                        style={{
                          display: "block",
                          padding: "10px 16px",
                          fontSize: 13,
                          color: A.text,
                          textDecoration: "none",
                        }}
                      >
                        My Account
                      </a>

                      <button
                        onClick={handleSignOut}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 16px",
                          fontSize: 13,
                          color: "#EF4444",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <a
                href="/login?redirect=/app/home"
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
                Sign in
              </a>
            ))}
        </div>
      </header>

      {/* Page content */}
      <div style={{ paddingBottom: 56 }}>
        {children}
      </div>

      {/* Bottom navigation */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "stretch",
          zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                textDecoration: "none",
                color: active ? "#6366f1" : "#6B7280",
                transition: "color 0.15s",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>
                {tab.icon}
              </span>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}