"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AddressForm, { type AddressFormData } from "@/components/shared/AddressForm";
import { useTranslations } from "@/hooks/useTranslations";
import { useLanguage } from "@/components/LanguageProvider";

const DiscoveryMap = dynamic(() => import("./DiscoveryMap"), { ssr: false });

const SLUGS =
  "app-discover-map-view,app-discover-list-view,app-discover-near-heading," +
  "app-discover-select-address,app-discover-add-address,app-discover-distance-km," +
  "app-discover-distance-unknown,app-discover-no-stores-found,app-discover-map-missing-count," +
  "store-categories-label,store-tags-label";

const A = {
  bg: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

export interface DiscoveryAddress {
  id: string;
  name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
}

interface TaxonomyOption {
  id: string;
  slug: string;
  title: string;
}

interface DiscoveryStore {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  previewImage: string | null;
  lat: number | null;
  lng: number | null;
  acceptingOrders: boolean;
  categoryIds: string[];
  tagIds: string[];
  distanceKm: number | null;
}

interface DiscoveryViewProps {
  addresses: DiscoveryAddress[];
  initialAddressId: string;
}

function FilterPill({
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

export default function DiscoveryView({ addresses: initialAddresses, initialAddressId }: DiscoveryViewProps) {
  const { locale } = useLanguage();
  const t = useTranslations(SLUGS);

  const [addresses, setAddresses] = useState<DiscoveryAddress[]>(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(initialAddressId);
  const [addingAddress, setAddingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addrError, setAddrError] = useState("");

  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [tags, setTags] = useState<TaxonomyOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [view, setView] = useState<"map" | "list">("list");
  const [stores, setStores] = useState<DiscoveryStore[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // Fetch taxonomy once
  useEffect(() => {
    fetch(`/api/store/taxonomy?locale=${encodeURIComponent(locale || "en")}`)
      .then((r) => r.json())
      .then((json) => {
        setCategories(json.categories ?? []);
        setTags(json.tags ?? []);
      })
      .catch(() => {});
  }, [locale]);

  // Fetch stores when address or filters change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategoryIds.length) params.set("categoryIds", selectedCategoryIds.join(","));
    if (selectedTagIds.length) params.set("tagIds", selectedTagIds.join(","));
    if (selectedAddress?.lat != null && selectedAddress?.lng != null) {
      params.set("addressLat", String(selectedAddress.lat));
      params.set("addressLng", String(selectedAddress.lng));
    }
    fetch(`/api/store/all?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setStores(json.stores ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, [selectedAddressId, selectedCategoryIds, selectedTagIds, selectedAddress?.lat, selectedAddress?.lng]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function saveNewAddress(data: AddressFormData) {
    setSavingAddress(true);
    setAddrError("");
    try {
      const res = await fetch("/api/store/address", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddrError(json.error || "Could not save address.");
        return;
      }
      setAddresses((prev) => [...prev, json]);
      setSelectedAddressId(json.id);
      setAddingAddress(false);
    } catch {
      setAddrError("Could not save address.");
    } finally {
      setSavingAddress(false);
    }
  }

  const mapStores = stores.filter(
    (s): s is DiscoveryStore & { lat: number; lng: number } => s.lat != null && s.lng != null
  );
  const missingCount = stores.length - mapStores.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Address selector */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: A.textMuted, display: "block", marginBottom: 4 }}>
          {t("app-discover-near-heading", "Stores near")}
        </label>
        <select
          value={selectedAddressId}
          onChange={(e) => {
            if (e.target.value === "__add__") {
              setAddingAddress(true);
              return;
            }
            setSelectedAddressId(e.target.value);
          }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${A.border}`,
            background: A.surface,
            color: A.text,
            fontSize: 13,
          }}
        >
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.line1}, {a.city}
            </option>
          ))}
          <option value="__add__">{t("app-discover-add-address", "Add new address")}</option>
        </select>
      </div>

      {addingAddress && (
        <div
          style={{
            background: A.surface,
            border: `1px solid ${A.border}`,
            borderRadius: 12,
            padding: 12,
          }}
        >
          {addrError && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{addrError}</p>}
          <AddressForm
            onSave={saveNewAddress}
            onCancel={() => setAddingAddress(false)}
            saving={savingAddress}
          />
        </div>
      )}

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.textMuted, marginBottom: 6 }}>
            {t("store-categories-label", "Categories")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {categories.map((c) => (
              <FilterPill key={c.id} active={selectedCategoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                {c.title}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* Tag filter pills */}
      {tags.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: A.textMuted, marginBottom: 6 }}>
            {t("store-tags-label", "Tags")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map((tg) => (
              <FilterPill key={tg.id} active={selectedTagIds.includes(tg.id)} onClick={() => toggleTag(tg.id)}>
                {tg.title}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* View toggle */}
      <div style={{ display: "flex", gap: 6 }}>
        <FilterPill active={view === "list"} onClick={() => setView("list")}>
          {t("app-discover-list-view", "List")}
        </FilterPill>
        <FilterPill active={view === "map"} onClick={() => setView("map")}>
          {t("app-discover-map-view", "Map")}
        </FilterPill>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: 96, borderRadius: 12, background: "#E2E8F0" }}
            />
          ))}
        </div>
      ) : view === "map" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 360, borderRadius: 12, overflow: "hidden" }}>
            <DiscoveryMap
              stores={mapStores.map((s) => ({ id: s.id, name: s.name, slug: s.slug, lat: s.lat, lng: s.lng }))}
              selectedAddress={
                selectedAddress?.lat != null && selectedAddress?.lng != null
                  ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
                  : null
              }
            />
          </div>
          {missingCount > 0 && (
            <p style={{ fontSize: 12, color: A.textMuted, textAlign: "center" }}>
              {(t("app-discover-map-missing-count", "{n} stores aren't shown on the map") || "").replace(
                "{n}",
                String(missingCount)
              )}
            </p>
          )}
        </div>
      ) : stores.length === 0 ? (
        <p style={{ fontSize: 13, color: A.textMuted }}>
          {t("app-discover-no-stores-found", "No stores match these filters")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stores.map((store) => (
            <div
              key={store.id}
              style={{
                background: A.surface,
                borderRadius: 12,
                border: "0.5px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
              }}
            >
              {store.previewImage ? (
                <img
                  src={store.previewImage}
                  alt={store.name}
                  style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: "linear-gradient(135deg,#6366f1,#818cf8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  🏪
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: A.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {store.name}
                </div>
                {store.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: A.textMuted,
                      marginTop: 2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {store.description}
                  </div>
                )}
                <div style={{ fontSize: 11, color: A.textMuted, marginTop: 4 }}>
                  {store.distanceKm != null
                    ? (t("app-discover-distance-km", "{km} km away") || "").replace(
                        "{km}",
                        store.distanceKm.toFixed(1)
                      )
                    : t("app-discover-distance-unknown", "Distance unknown")}
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <a
                    href={`/store/${store.slug ?? store.id}`}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: A.accent,
                      textDecoration: "none",
                      border: `1px solid ${A.accent}`,
                      background: A.surface,
                    }}
                  >
                    Visit →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
