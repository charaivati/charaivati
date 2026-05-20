// app/app/layout.tsx
"use client";
import { getLogoutRedirect } from "@/lib/logout";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "@/hooks/useTranslations";

const LAYOUT_SLUGS =
  "app-layout-tab-home,app-layout-tab-initiatives,app-layout-tab-explore," +
  "app-layout-tab-orders,app-layout-my-account,app-layout-sign-out," +
  "app-layout-sign-in-up,app-layout-sign-in";

const TAB_DEFS = [
  { slug: "app-layout-tab-home",        fallback: "Home",        icon: "🏠", href: "/app/home" },
  { slug: "app-layout-tab-initiatives", fallback: "Initiatives", icon: "🌱", href: "/app/initiatives" },
  { slug: "app-layout-tab-explore",     fallback: "Explore",     icon: "🔍", href: "/app/saved" },
  { slug: "app-layout-tab-orders",      fallback: "Orders",      icon: "🛍️", href: "/app/orders" },
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
  email: string | null;
  avatarUrl?: string | null;
  status?: string | null;
};

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations(LAYOUT_SLUGS);

  const tabs = TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.slug, tab.fallback) }));

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  const isGuest = user?.status === "guest";

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

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex gap-8 items-center absolute left-1/2 -translate-x-1/2">
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href) ?? false;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  color: active ? "#A5B4FC" : "rgba(255,255,255,0.65)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: "0.01em",
                }}
              >
                {tab.icon} {tab.label}
              </Link>
            );
          })}
        </div>

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

                        {user.email && (
                          <div
                            style={{
                              fontSize: 11,
                              color: A.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {user.email}
                          </div>
                        )}
                      </div>

                      {isGuest ? (
                        <a
                          href={`/login?redirect=${encodeURIComponent(pathname ?? "/app/home")}`}
                          style={{
                            display: "block",
                            padding: "10px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            color: A.accent,
                            textDecoration: "none",
                          }}
                        >
                          {t("app-layout-sign-in-up", "Sign in / Sign up")}
                        </a>
                      ) : (
                        <>
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
                            {t("app-layout-my-account", "My Account")}
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
                            {t("app-layout-sign-out", "Sign out")}
                          </button>
                        </>
                      )}
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
                {t("app-layout-sign-in", "Sign in")}
              </a>
            ))}
        </div>
      </header>

      {/* Page content */}
      <div className="pb-14 md:pb-0">
        {children}
      </div>

      {/* Bottom navigation — mobile only */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
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