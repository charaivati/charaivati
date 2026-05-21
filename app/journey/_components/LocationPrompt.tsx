"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const COUNTRIES = [
  { code: "IN", name: "India" }, { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" }, { code: "CN", name: "China" },
  { code: "BR", name: "Brazil" }, { code: "RU", name: "Russia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "JP", name: "Japan" }, { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" }, { code: "ID", name: "Indonesia" },
  { code: "PK", name: "Pakistan" }, { code: "BD", name: "Bangladesh" },
  { code: "NG", name: "Nigeria" }, { code: "MX", name: "Mexico" },
  { code: "ET", name: "Ethiopia" }, { code: "PH", name: "Philippines" },
  { code: "EG", name: "Egypt" }, { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" }, { code: "ZA", name: "South Africa" },
  { code: "AR", name: "Argentina" }, { code: "CO", name: "Colombia" },
  { code: "DZ", name: "Algeria" }, { code: "SA", name: "Saudi Arabia" },
  { code: "UG", name: "Uganda" }, { code: "IQ", name: "Iraq" },
  { code: "UA", name: "Ukraine" }, { code: "IR", name: "Iran" },
  { code: "TH", name: "Thailand" }, { code: "KR", name: "South Korea" },
  { code: "VN", name: "Vietnam" }, { code: "TR", name: "Turkey" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" },
  { code: "PL", name: "Poland" }, { code: "MY", name: "Malaysia" },
  { code: "NP", name: "Nepal" }, { code: "LK", name: "Sri Lanka" },
  { code: "MM", name: "Myanmar" }, { code: "AE", name: "UAE" },
  { code: "IL", name: "Israel" }, { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "NL", name: "Netherlands" },
  { code: "SG", name: "Singapore" }, { code: "HK", name: "Hong Kong" },
];

interface Props {
  onConfirm: (
    country: string,
    countryName: string,
    coords: { lat: number; lng: number } | null
  ) => void;
}

export default function LocationPrompt({ onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");

  async function detect() {
    setLoading(true);
    setError("");
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await resp.json();
      const code = (data.address?.country_code ?? "").toUpperCase();
      const name = data.address?.country ?? "Unknown";
      onConfirm(code, name, { lat, lng });
    } catch {
      setError("Could not detect location. Try manually.");
      setLoading(false);
    }
  }

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 7);

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 22,
    padding: "28px 22px",
    width: "92vw",
    maxWidth: 340,
    display: "flex",
    flexDirection: "column",
    gap: 13,
    fontFamily: "system-ui, sans-serif",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 1.5 }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        pointerEvents: "auto",
      }}
    >
      <div style={card}>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", margin: 0, textAlign: "center" }}>
          Where are you?
        </p>

        {!manual ? (
          <>
            <button
              onClick={detect}
              disabled={loading}
              style={{
                background: "rgba(245,200,66,0.12)",
                border: "1px solid rgba(245,200,66,0.28)",
                borderRadius: 13,
                padding: "15px 20px",
                color: "#f5c842",
                fontSize: 15,
                cursor: loading ? "wait" : "pointer",
                fontFamily: "system-ui, sans-serif",
                transition: "background 0.18s",
              }}
            >
              {loading ? "Detecting…" : "📍 Detect my location"}
            </button>

            {error && (
              <p style={{ color: "rgba(255,110,110,0.85)", fontSize: 12, margin: 0, textAlign: "center" }}>
                {error}
              </p>
            )}

            <button
              onClick={() => setManual(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Enter manually →
            </button>
          </>
        ) : (
          <>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country…"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.11)",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#fff",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                outline: "none",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 210, overflowY: "auto" }}>
              {filtered.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSelected(c.code)}
                  style={{
                    background: selected === c.code ? "rgba(245,200,66,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selected === c.code ? "rgba(245,200,66,0.3)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 9,
                    padding: "9px 14px",
                    color: selected === c.code ? "#f5c842" : "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {selected && (
              <button
                onClick={() => {
                  const c = COUNTRIES.find((x) => x.code === selected)!;
                  onConfirm(c.code, c.name, null);
                }}
                style={{
                  background: "rgba(245,200,66,0.18)",
                  border: "1px solid rgba(245,200,66,0.38)",
                  borderRadius: 13,
                  padding: "13px",
                  color: "#f5c842",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Confirm →
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
