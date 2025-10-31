// app/layout.tsx
import "./globals.css";
import React from "react";
import { headers, cookies } from "next/headers";
import ClientProviders from "@/components/ClientProviders";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;

  // Read possible server cookie for theme so SSR can match returning user's preference.
  // Note: cookies() is synchronous in next/headers.
  const ck = cookies();
  const serverTheme = ck.get("charaivati.theme")?.value ?? "dark";

  // Build body class so server HTML includes the `dark` class when appropriate
  const bodyClass = `bg-black text-white min-h-screen antialiased${serverTheme === "dark" ? " dark" : ""}`;

  // Inline script uses localStorage fallback and sets the same attribute before React hydrates.
  // Use document.documentElement for the `dark` class (consistent with Tailwind default).
  const inlineScript = `
    (function () {
      try {
        var stored = null;
        try { stored = localStorage.getItem("charaivati.theme"); } catch(e) {}
        var theme = stored || "${serverTheme}" || "dark";
        document.documentElement.setAttribute("data-theme", theme);
        if (theme === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
      } catch (e) { console.warn("theme init failed", e); }
    })();
  `;

  return (
    <html lang="en" data-theme={serverTheme} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={bodyClass}>
        {/* Inline theme initialization with nonce - runs before React hydrates */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: inlineScript }} />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
