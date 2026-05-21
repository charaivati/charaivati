"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CARDS = [
  { icon: "🔥", title: "Drives", subtitle: "What moves you" },
  { icon: "🎯", title: "Goals", subtitle: "Where you're headed" },
  { icon: "💚", title: "Health", subtitle: "How you're doing" },
];

export default function SelfUI() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          padding: "0 24px",
          zIndex: 20,
          pointerEvents: "auto",
        }}
      >
        {CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => setExpanded(card.title)}
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 18,
              padding: "18px 10px",
              flex: 1,
              maxWidth: 115,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
              color: "#fff",
              fontFamily: "system-ui, sans-serif",
              transition: "background 0.18s, border-color 0.18s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.1)";
              el.style.borderColor = "rgba(255,255,255,0.16)";
              el.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(255,255,255,0.06)";
              el.style.borderColor = "rgba(255,255,255,0.09)";
              el.style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: 26 }}>{card.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{card.title}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.4, textAlign: "center" }}>
              {card.subtitle}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(14px)",
              zIndex: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
            onClick={() => setExpanded(null)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.11)",
                borderRadius: 22,
                padding: "44px 32px",
                width: "82vw",
                maxWidth: 310,
                textAlign: "center",
                color: "#fff",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 14 }}>
                {CARDS.find((c) => c.title === expanded)?.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{expanded}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>
                Coming soon
              </div>
              <button
                onClick={() => setExpanded(null)}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: "9px 24px",
                  color: "rgba(255,255,255,0.55)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
