// app/layout.tsx
import "./globals.css";
import React from "react";
import { headers, cookies } from "next/headers";
import ClientProviders from "@/components/ClientProviders";
import ChatBotGate from "@/components/chat/ChatBotGate";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";
  const h = isProd ? await headers() : null;
  const nonce = isProd ? h?.get("x-nonce") ?? undefined : undefined;

  const ck = await cookies();
  const rawTheme = ck.get("charaivati.theme")?.value ?? "dark";
  const serverTheme = rawTheme === "light" ? "light" : "dark";

  const sessionToken = ck.get(COOKIE_NAME)?.value;
  const sessionPayload = sessionToken ? await verifySessionToken(sessionToken) : null;
  const isLoggedIn = !!sessionPayload?.userId;

  let chatUserId: string | undefined;
  let chatUserStatus: string | undefined;
  if (sessionPayload?.userId) {
    try {
      const u = await db.user.findUnique({
        where: { id: sessionPayload.userId },
        select: { id: true, status: true },
      });
      chatUserId = u?.id;
      chatUserStatus = u?.status ?? undefined;
    } catch {
      // non-fatal — nudge simply won't show
    }
  }

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

        {/* Leaflet CSS — required for map tiles and markers to render */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />

        {/* Google Identity Services */}
        <script
          src="https://accounts.google.com/gsi/client"
          async
          defer
          {...(nonce ? { nonce } : {})}
        ></script>
      </head>
      <body className={bodyClass} suppressHydrationWarning>
        <script
          {...(isProd && nonce ? { nonce } : {})}
          dangerouslySetInnerHTML={{ __html: inlineScript }}
        />
        <ClientProviders>{children}</ClientProviders>
        <ChatBotGate isLoggedIn={isLoggedIn} userId={chatUserId} userStatus={chatUserStatus} />
      </body>
    </html>
  );
}