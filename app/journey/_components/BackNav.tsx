"use client";

import { motion } from "framer-motion";
import { toast } from "sonner";

export default function BackNav() {
  function coming(layer: string) {
    toast(`${layer} layer coming soon`);
  }

  const btn: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 9,
    padding: "6px 13px",
    color: "rgba(255,255,255,0.28)",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "0.04em",
    transition: "color 0.18s, border-color 0.18s",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.4 }}
      style={{
        position: "absolute",
        bottom: 28,
        left: 22,
        display: "flex",
        gap: 8,
        zIndex: 20,
        pointerEvents: "auto",
      }}
    >
      <button style={btn} onClick={() => coming("Local")}>← Local</button>
      <button style={btn} onClick={() => coming("Nation")}>←← Nation</button>
    </motion.div>
  );
}
