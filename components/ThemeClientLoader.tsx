//ThemeClinetLoader

"use client";

import { useEffect } from "react";

export default function ThemeClientLoader() {
  useEffect(() => {
    try {
      const theme =
        typeof window !== "undefined"
          ? localStorage.getItem("theme") || "dark"
          : "dark";

      document.documentElement.setAttribute("data-theme", theme);
      document.body.classList.toggle("dark", theme === "dark");
    } catch (e) {
      console.warn("Theme loader error:", e);
    }
  }, []);

  return null;
}
