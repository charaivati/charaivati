// ============================================================================
// FILE 1: app/layout.tsx
// ============================================================================
import "./globals.css";
import React from "react";
import { headers, cookies } from "next/headers";
import ClientProviders from "@/components/ClientProviders";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";
  const h = isProd ? await headers() : null;
  const nonce = isProd ? h?.get("x-nonce") ?? undefined : undefined;

  // IMPORTANT: cookies() may be async in this Next version -> await it.
  const ck = await cookies();
  const serverTheme = ck.get("charaivati.theme")?.value ?? "dark";

  const bodyClass = `bg-black text-white min-h-screen antialiased${serverTheme === "dark" ? " dark" : ""}`;

  const inlineScript = `
    (function() {
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
        {/* Allow Google Identity Services Script */}
        <script
          src="https://accounts.google.com/gsi/client"
          async
          defer
          crossOrigin="anonymous"
          {...(nonce ? { nonce } : {})}
        ></script>
      </head>
      <body className={bodyClass}>
        {/* Inline theme init — include nonce attribute in production when present */}
        <script
          {...(isProd && nonce ? { nonce } : {})}
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}