"use client";

import { useEffect, useState } from "react";
import AddressForm, { type AddressFormData } from "@/components/shared/AddressForm";
import DiscoveryView, { type DiscoveryAddress } from "@/components/store/DiscoveryView";
import { useTranslations } from "@/hooks/useTranslations";

const SLUGS = "app-discover-gate-title,app-discover-gate-button";

const A = {
  bg: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

function DiscoverSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
      <div className="animate-pulse" style={{ height: 38, borderRadius: 8, background: "#E2E8F0" }} />
      <div className="animate-pulse" style={{ height: 28, borderRadius: 8, background: "#F1F5F9", width: "60%" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse" style={{ height: 96, borderRadius: 12, background: "#E2E8F0" }} />
      ))}
    </div>
  );
}

function NoAddressGate({ onAdded }: { onAdded: (a: DiscoveryAddress) => void }) {
  const t = useTranslations(SLUGS);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(data: AddressFormData) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/store/address", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save address.");
        return;
      }
      onAdded(json);
    } catch {
      setError("Could not save address.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 24,
        textAlign: "center",
        gap: 16,
      }}
    >
      {!showForm ? (
        <>
          <div style={{ fontSize: 40 }}>📍</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: A.text, maxWidth: 280 }}>
            {t("app-discover-gate-title", "Add an address to discover stores near you")}
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: A.accent,
              border: "none",
              cursor: "pointer",
            }}
          >
            {t("app-discover-gate-button", "Add address")}
          </button>
        </>
      ) : (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: A.surface,
            border: `1px solid ${A.border}`,
            borderRadius: 12,
            padding: 16,
            textAlign: "left",
          }}
        >
          {error && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{error}</p>}
          <AddressForm onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />
        </div>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  const [addresses, setAddresses] = useState<DiscoveryAddress[] | null>(null);

  useEffect(() => {
    fetch("/api/store/address", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((json) => setAddresses(Array.isArray(json) ? json : []))
      .catch(() => setAddresses([]));
  }, []);

  return (
    <div
      style={{
        background: "#F8FAFC",
        minHeight: "100vh",
        fontFamily: "system-ui,-apple-system,sans-serif",
        paddingBottom: 80,
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        {addresses === null ? (
          <DiscoverSkeleton />
        ) : addresses.length === 0 ? (
          <NoAddressGate onAdded={(a) => setAddresses([a])} />
        ) : (
          <DiscoveryView addresses={addresses} initialAddressId={addresses[0].id} />
        )}
      </div>
    </div>
  );
}
