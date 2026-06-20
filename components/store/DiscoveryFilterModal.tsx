"use client";

import { useEffect, useState } from "react";
import AddressForm, { type AddressFormData } from "@/components/shared/AddressForm";
import { FilterPill } from "./FilterPill";
import { useTranslations } from "@/hooks/useTranslations";
import { useLanguage } from "@/components/LanguageProvider";

const SLUGS =
  "app-discover-near-heading,app-discover-add-address," +
  "store-categories-label,store-tags-label," +
  "app-saved-apply-filters,app-saved-clear-filters,app-saved-filter-modal-title";

const A = {
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type TaxonomyOption = { id: string; slug: string; title: string };

type DiscoveryAddress = {
  id: string;
  name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
};

export interface DiscoveryFilters {
  categoryIds: string[];
  tagIds: string[];
  addressLat: number | null;
  addressLng: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (filters: DiscoveryFilters) => void;
}

export default function DiscoveryFilterModal({ open, onClose, onApply }: Props) {
  const { locale } = useLanguage();
  const t = useTranslations(SLUGS);

  // Fetched data — persists across opens (lazy, load once)
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [tags, setTags] = useState<TaxonomyOption[]>([]);
  const [addresses, setAddresses] = useState<DiscoveryAddress[]>([]);

  // Draft state — filter selections reset on close; address persists
  const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);
  const [pendingTagIds, setPendingTagIds] = useState<string[]>([]);
  const [pendingAddressId, setPendingAddressId] = useState<string>("");

  // Inline address form
  const [addingAddress, setAddingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addrError, setAddrError] = useState("");

  // Lazy-fetch taxonomy + addresses on first open
  useEffect(() => {
    if (!open || loaded) return;
    Promise.all([
      fetch(`/api/store/taxonomy?locale=${encodeURIComponent(locale || "en")}`).then((r) =>
        r.ok ? r.json() : { categories: [], tags: [] }
      ),
      fetch("/api/store/address", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([taxJson, addrJson]) => {
        setCategories(taxJson.categories ?? []);
        setTags(taxJson.tags ?? []);
        const addrs: DiscoveryAddress[] = Array.isArray(addrJson) ? addrJson : [];
        setAddresses(addrs);
        // Set default address if none selected yet
        if (!pendingAddressId) {
          const def = addrs.find((a) => a.isDefault) ?? addrs[0];
          if (def) setPendingAddressId(def.id);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, locale, pendingAddressId]);

  // Reset filter selections (not address) when modal closes without Apply
  useEffect(() => {
    if (!open) {
      setPendingCategoryIds([]);
      setPendingTagIds([]);
      setAddingAddress(false);
      setAddrError("");
    }
  }, [open]);

  function toggleCategory(id: string) {
    setPendingCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleTag(id: string) {
    setPendingTagIds((prev) =>
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
      setPendingAddressId(json.id);
      setAddingAddress(false);
    } catch {
      setAddrError("Could not save address.");
    } finally {
      setSavingAddress(false);
    }
  }

  function handleApply() {
    const addr = addresses.find((a) => a.id === pendingAddressId) ?? null;
    onApply({
      categoryIds: pendingCategoryIds,
      tagIds: pendingTagIds,
      addressLat: addr?.lat ?? null,
      addressLng: addr?.lng ?? null,
    });
    onClose();
  }

  function handleClear() {
    setPendingCategoryIds([]);
    setPendingTagIds([]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center pb-16 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: A.surface, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: A.border }}
        >
          <h2 className="text-sm font-bold" style={{ color: A.text }}>
            {t("app-saved-filter-modal-title", "Find stores near you")}
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: A.textMuted }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!loaded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{ height: 36, borderRadius: 8, background: "#E2E8F0" }}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Address selector */}
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: A.textMuted,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  {t("app-discover-near-heading", "Stores near")}
                </label>
                <select
                  value={pendingAddressId}
                  onChange={(e) => {
                    if (e.target.value === "__add__") {
                      setAddingAddress(true);
                      return;
                    }
                    setPendingAddressId(e.target.value);
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
                  <option value="__add__">
                    {t("app-discover-add-address", "Add new address")}
                  </option>
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
                  {addrError && (
                    <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>
                      {addrError}
                    </p>
                  )}
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
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: A.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    {t("store-categories-label", "Categories")}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {categories.map((c) => (
                      <FilterPill
                        key={c.id}
                        active={pendingCategoryIds.includes(c.id)}
                        onClick={() => toggleCategory(c.id)}
                      >
                        {c.title}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag filter pills */}
              {tags.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: A.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    {t("store-tags-label", "Tags")}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tags.map((tg) => (
                      <FilterPill
                        key={tg.id}
                        active={pendingTagIds.includes(tg.id)}
                        onClick={() => toggleTag(tg.id)}
                      >
                        {tg.title}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="flex gap-3 px-5 py-4 border-t shrink-0"
          style={{ borderColor: A.border }}
        >
          <button
            onClick={handleClear}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${A.border}`,
              background: A.surface,
              color: A.textMuted,
            }}
          >
            {t("app-saved-clear-filters", "Clear")}
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 2,
              padding: "10px 0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: A.accent,
              color: "#fff",
            }}
          >
            {t("app-saved-apply-filters", "Apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
