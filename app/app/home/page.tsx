"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "@/hooks/useTranslations";
import { kindLabel } from "@/lib/pages/kindLabel";

const HOME_SLUGS = [
  "app-home-cta-btn",
  "app-home-no-gst","app-home-see-details",
  "app-home-gst-modal-title","app-home-gst-no-need","app-home-gst-need",
  "app-home-gst-good-to-know","app-home-gst-register-btn","app-home-gst-disclaimer",
].join(",");

// ── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string | null;
  email: string | null;
  status?: string | null;
};

type SellerOrder = {
  id: string;
  status: string;
  deliveryStatus?: string | null;
  total: number;
  createdAt: string;
  store: { id: string; name: string; slug: string | null };
  user?: { name: string | null; email: string | null } | null;
};

type Page = {
  id: string;
  title: string;
  type: string;
  pageType: string;
  description?: string | null;
  avatarUrl?: string | null;
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "";
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] ?? "?").toUpperCase();
}

function deliveryPill(status: string | null | undefined): { label: string; bg: string; color: string } {
  if (!status || status === "pending") return { label: "New",        bg: "#FDF0EB", color: "#993C1D" };
  if (status === "delivered")          return { label: "Delivered",  bg: "#E1F5EE", color: "#0F6E56" };
  return                                      { label: "In transit", bg: "#E6F1FB", color: "#185FA5" };
}

function initiativeIcon(page: Page): { emoji: string; bg: string; color: string } {
  if (page.type === "health")       return { emoji: "➕", bg: "#F0EDF8", color: "#7B5EA7" };
  if (page.pageType === "helping")  return { emoji: "❤️", bg: "#E1F5EE", color: "#0F6E56" };
  if (page.pageType === "learning") return { emoji: "📖", bg: "#EBF2FA", color: "#185FA5" };
  return                                   { emoji: "🛍️", bg: "#FDF0EB", color: "#D85A30" };
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function HomeSkeleton() {
  const pulse: React.CSSProperties = { background: "#E2E8F0", borderRadius: 4 };
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* topbar */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #e2e8f0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...pulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
            <div>
              <div style={{ ...pulse, width: 80, height: 11, marginBottom: 6 }} />
              <div style={{ ...pulse, width: 60, height: 14 }} />
            </div>
          </div>
          <div style={{ ...pulse, width: 20, height: 20, borderRadius: 4 }} />
        </div>
        {/* stats */}
        <div style={{ display: "flex", gap: 10, margin: "12px 16px 0" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, border: "0.5px solid #e2e8f0" }}>
              <div style={{ ...pulse, width: "60%", height: 11, marginBottom: 6 }} />
              <div style={{ ...pulse, width: "45%", height: 26 }} />
            </div>
          ))}
        </div>
        {/* pending orders card — rows: text + pill badge, no leading icon */}
        <div style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, margin: "12px 16px 0" }}>
          <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between" }}>
            <div style={{ ...pulse, width: 100, height: 13 }} />
            <div style={{ ...pulse, width: 40, height: 11 }} />
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderTop: "0.5px solid #f1f5f9" }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...pulse, width: "70%", height: 13, marginBottom: 2 }} />
                <div style={{ ...pulse, width: "45%", height: 11 }} />
              </div>
              <div style={{ ...pulse, width: 48, height: 20, borderRadius: 99, flexShrink: 0 }} />
            </div>
          ))}
        </div>
        {/* section label */}
        <div style={{ ...pulse, width: 140, height: 11, margin: "16px 16px 8px" }} />
        {/* initiatives card — rows: 32×32 icon + text + 16×16 chevron */}
        <div style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, margin: "0 16px" }}>
          {[0, 1, 2].map((r) => (
            <div key={r} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: r === 0 ? "none" : "0.5px solid #f1f5f9" }}>
              <div style={{ ...pulse, width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...pulse, width: "70%", height: 13, marginBottom: 2 }} />
                <div style={{ ...pulse, width: "45%", height: 11 }} />
              </div>
              <div style={{ ...pulse, width: 16, height: 16, borderRadius: 3, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const [gstModalOpen, setGstModalOpen] = useState(false);
  const t = useTranslations(HOME_SLUGS);

  const [loadState, setLoadState]       = useState<"loading" | "guest" | "returning">("loading");
  const [user, setUser]                 = useState<User | null>(null);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [pages, setPages]               = useState<Page[]>([]);
  const [ordersError, setOrdersError]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/me", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/store/orders?all=true&limit=50", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/user/pages", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([meData, ordersData, pagesData]) => {
      const u: User | null = meData?.user ?? null;
      setUser(u);

      if (!u || u.status === "guest") {
        setLoadState("guest");
        return;
      }

      if (Array.isArray(ordersData)) {
        setSellerOrders(ordersData);
      } else {
        setOrdersError(true);
      }

      if (pagesData?.ok && Array.isArray(pagesData.pages)) {
        setPages(pagesData.pages);
      }

      setLoadState("returning");
    }).catch(() => setLoadState("guest"));
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadState === "loading") return <HomeSkeleton />;

  // ── Returning user dashboard ───────────────────────────────────────────────
  if (loadState === "returning" && user) {
    const todayOrders     = sellerOrders.filter((o) => isToday(o.createdAt));
    const yesterdayOrders = sellerOrders.filter((o) => isYesterday(o.createdAt));

    const totalToday      = todayOrders.length;
    const pendingToday    = todayOrders.filter((o) => !o.deliveryStatus || o.deliveryStatus === "pending").length;
    const deliveredToday  = todayOrders.filter((o) => o.deliveryStatus === "delivered").length;
    const revenueToday    = todayOrders.reduce((s, o) => s + (o.total ?? 0), 0);
    const revenueYesterday = yesterdayOrders.reduce((s, o) => s + (o.total ?? 0), 0);
    const revenueDelta    = revenueToday - revenueYesterday;

    // Non-terminal orders, most recent first, up to 3
    const pendingOrders = sellerOrders
      .filter((o) => o.deliveryStatus !== "delivered" && o.deliveryStatus !== "cancelled")
      .slice(0, 3);

    const initials = getInitials(user.name);
    const greet    = getGreeting();
    const fname    = getFirstName(user.name, user.email);

    return (
      <div style={{
        background: "#F8FAFC", minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
        paddingBottom: 80,
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>

        {/* 1. Topbar */}
        <header style={{
          background: "#fff",
          borderBottom: "0.5px solid #e2e8f0",
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 56, zIndex: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: "#EBF2FA", color: "#185FA5",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.3 }}>{greet}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>{fname}</div>
            </div>
          </div>
          <button
            aria-label="Notifications"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, lineHeight: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>
        </header>

        {/* 2. Stats row */}
        <div style={{ display: "flex", gap: 10, margin: "12px 16px 0" }}>

          {/* Orders today */}
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, border: "0.5px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 6 }}>Orders today</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: pendingToday > 0 ? "#D85A30" : "#111827" }}>
              {ordersError ? "—" : totalToday}
            </div>
            {!ordersError && (
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                {pendingToday > 0 && (
                  <span style={{
                    fontSize: 11, background: "#FDF0EB", color: "#993C1D",
                    padding: "1px 7px", borderRadius: 99,
                  }}>
                    {pendingToday} pending
                  </span>
                )}
                {deliveredToday > 0 && (
                  <span style={{ fontSize: 11, color: "#64748B" }}>{deliveredToday} delivered</span>
                )}
              </div>
            )}
          </div>

          {/* Revenue today */}
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, border: "0.5px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, marginBottom: 6 }}>Revenue today</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              {ordersError ? "—" : `₹${revenueToday.toLocaleString("en-IN")}`}
            </div>
            {!ordersError && revenueYesterday > 0 && revenueDelta !== 0 && (
              <div style={{ fontSize: 11, color: revenueDelta > 0 ? "#0F6E56" : "#DC2626", marginTop: 4 }}>
                {revenueDelta > 0 ? "▲" : "▼"}{" "}
                ₹{Math.abs(revenueDelta).toLocaleString("en-IN")} vs yesterday
              </div>
            )}
          </div>
        </div>

        {/* 3. Pending orders card */}
        <div style={{
          background: "#fff", border: "0.5px solid #e2e8f0",
          borderRadius: 12, margin: "12px 16px 0",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 14px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Pending orders</span>
            <a href="/app/orders" style={{ fontSize: 12, color: "#185FA5", textDecoration: "none" }}>See all</a>
          </div>

          {pendingOrders.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, padding: 16 }}>
              No pending orders
            </div>
          ) : (
            pendingOrders.map((o) => {
              const pill         = deliveryPill(o.deliveryStatus);
              const customerName = o.user?.name ?? o.user?.email ?? "Customer";
              return (
                <div
                  key={o.id}
                  style={{
                    display: "flex", alignItems: "center",
                    padding: "10px 14px", borderTop: "0.5px solid #f1f5f9",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "#111827",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {customerName}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                      {o.store?.name ?? "Store"} · ₹{(o.total ?? 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span style={{
                    marginLeft: 10, flexShrink: 0,
                    fontSize: 11, fontWeight: 500,
                    padding: "2px 8px", borderRadius: 99,
                    background: pill.bg, color: pill.color,
                  }}>
                    {pill.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Your initiatives */}
        <div style={{
          fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
          color: "#64748B", textTransform: "uppercase" as const,
          margin: "16px 16px 8px",
        }}>
          YOUR INITIATIVES
        </div>

        <div style={{
          background: "#fff", border: "0.5px solid #e2e8f0",
          borderRadius: 12, margin: "0 16px",
        }}>
          {pages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 16px" }}>
              <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 8 }}>No initiatives yet</div>
              <a href="/app/initiatives" style={{ fontSize: 12, color: "#185FA5", textDecoration: "none" }}>
                Create your first initiative →
              </a>
            </div>
          ) : (
            pages.map((page, i) => {
              const icon  = initiativeIcon(page);
              const label = kindLabel(page);
              return (
                <Link
                  key={page.id}
                  href={`/earn/initiative/${page.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", textDecoration: "none",
                    borderTop: i === 0 ? "none" : "0.5px solid #f1f5f9",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: icon.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15,
                  }}>
                    {icon.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: "#111827",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {page.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                      {label}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              );
            })
          )}
        </div>
        </div>
      </div>
    );
  }

  // ── Guest / new user state ───────────────────────────────────────────────
  return (
    <div style={{
      background: "#F8FAFC", minHeight: "100vh",
      fontFamily: "system-ui,-apple-system,sans-serif",
      paddingBottom: 80,
    }}>
    <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>

      {/* 1. Topbar */}
      <header style={{
        background: "#fff",
        borderBottom: "0.5px solid #e2e8f0",
        padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 56, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: "#F1F5F9", color: "#64748B",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
          }}>
            G
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
            Welcome
          </div>
        </div>
        <button
          aria-label="Notifications"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, lineHeight: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </button>
      </header>

      {/* 2. Empty state */}
      <div style={{ textAlign: "center", padding: "16px 16px 12px" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 6 }}>
          Start your first initiative
        </div>
        <p style={{
          fontSize: 13, color: "#64748B", lineHeight: 1.6,
          maxWidth: 280, margin: "0 auto",
        }}>
          Create a store, offer a service, teach a skill, or run a cause. Your initiative lives here.
        </p>
      </div>

      {/* 3. CTA */}
      <div style={{ padding: "0 16px 24px" }}>
        <Link
          href="/app/initiatives"
          style={{
            display: "block", textAlign: "center",
            background: "#D85A30", color: "#fff",
            padding: "16px 24px", borderRadius: 12,
            fontSize: 16, fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {t("app-home-cta-btn", "Begin Your Initiative")}
        </Link>
        <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", margin: "12px 0 0" }}>
          {t("app-home-no-gst", "No GST needed to start.")}{" "}
          <button
            onClick={() => setGstModalOpen(true)}
            style={{
              fontSize: 11, color: "#185FA5",
              background: "none", border: "none",
              cursor: "pointer", padding: 0,
              textDecoration: "underline",
            }}
          >
            {t("app-home-see-details", "See full details")}
          </button>
        </p>
      </div>

      {/* 4. Explore section */}
      <div style={{
        fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
        color: "#64748B", textTransform: "uppercase" as const,
        margin: "0 16px 8px",
      }}>
        EXPLORE WHAT OTHERS HAVE BUILT
      </div>

      <div style={{
        background: "#fff", border: "0.5px solid #e2e8f0",
        borderRadius: 12, margin: "0 16px",
      }}>
        <Link
          href="/app/saved"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", textDecoration: "none",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#FDF0EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15,
          }}>
            🛍️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Browse stores</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Find products & services nearby</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

        <Link
          href="/app/saved"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", textDecoration: "none",
            borderTop: "0.5px solid #f1f5f9",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#EBF2FA",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15,
          }}>
            👥
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>Hire services</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Connect with local service providers</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

    </div>{/* /maxWidth wrapper */}

      {/* GST Modal */}
      {gstModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "flex-end",
          }}
          onClick={() => setGstModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxHeight: "80vh",
              background: "#fff", borderRadius: "20px 20px 0 0",
              padding: 24, overflowY: "auto",
            }}
          >
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
                {t("app-home-gst-modal-title", "GST & Selling on Charaivati")}
              </h3>
              <button
                onClick={() => setGstModalOpen(false)}
                style={{
                  fontSize: 22, background: "none", border: "none",
                  cursor: "pointer", color: "#6B7280", lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* TODO: translate legal — paragraph body left in English */}
            <div style={{
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: 10, padding: 12, marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.6, margin: 0 }}>
                Charaivati does not process payments. Buyers pay sellers directly
                (Cash on Delivery). This means we are a listing platform, not an
                e-commerce operator under GST law.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#16A34A", margin: "0 0 8px" }}>
                ✓ {t("app-home-gst-no-need", "You don't need GST if:")}
              </p>
              {/* TODO: translate legal */}
              {[
                "You sell goods only within your state",
                "Yearly turnover under ₹40 lakhs (goods) or ₹20 lakhs (services)",
                "You're just starting out",
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", paddingLeft: 12 }}>
                  • {item}
                </p>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", margin: "0 0 8px" }}>
                ⚠ {t("app-home-gst-need", "You need GST if:")}
              </p>
              {/* TODO: translate legal */}
              {[
                "Your turnover crosses the limits above",
                "You sell to customers in other states",
                "You voluntarily want to claim tax credits",
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 13, color: "#374151", margin: "0 0 4px", paddingLeft: 12 }}>
                  • {item}
                </p>
              ))}
            </div>

            <div style={{
              background: "#F0FDF4", borderRadius: 10,
              padding: 12, marginBottom: 20,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#15803D", margin: "0 0 6px" }}>
                💡 {t("app-home-gst-good-to-know", "Good to know")}
              </p>
              {/* TODO: translate legal */}
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 8px" }}>
                You can start your store now and add GST details later when required.
              </p>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                Voluntary registration lets you claim tax credits and appear more
                credible to larger buyers.
              </p>
            </div>

            <a
              href="https://www.gst.gov.in"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "block", textAlign: "center",
                padding: 12, borderRadius: 10,
                background: "#6366f1", color: "#fff",
                textDecoration: "none", fontSize: 14,
                fontWeight: 600, marginBottom: 12,
              }}
            >
              {t("app-home-gst-register-btn", "Register on GST Portal →")}
            </a>

            <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              {t("app-home-gst-disclaimer", "General information only, not legal advice. Verify at gst.gov.in for your specific case.")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
