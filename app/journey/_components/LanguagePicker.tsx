"use client";

import { motion } from "framer-motion";
import { LANGUAGES } from "../_constants/languages";

interface Props {
  onSelect: (code: string) => void;
}

export default function LanguagePicker({ onSelect }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 2.5 }}
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
      <div
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 22,
          padding: "28px 20px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          maxWidth: 440,
          width: "92vw",
        }}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onSelect(lang.code)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 13,
              padding: "13px 8px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              transition: "background 0.18s, border-color 0.18s, transform 0.15s",
              color: "#fff",
              fontFamily: "system-ui, sans-serif",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(245,200,66,0.1)";
              el.style.borderColor = "rgba(245,200,66,0.28)";
              el.style.transform = "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.04)";
              el.style.borderColor = "rgba(255,255,255,0.07)";
              el.style.transform = "scale(1)";
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{lang.flag}</span>
            <span
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                textAlign: "center",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {lang.nativeName}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
