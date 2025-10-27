import "./globals.css";
import React from "react";
import { headers } from "next/headers";
import ClientProviders from "@/components/ClientProviders";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-black text-white min-h-screen antialiased">
        {/* Inline theme initialization with nonce - runs before React hydrates */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem("theme") || "dark";
                  document.documentElement.setAttribute("data-theme", theme);
                  document.body.classList.toggle("dark", theme === "dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}