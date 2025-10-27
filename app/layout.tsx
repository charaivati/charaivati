// app/layout.tsx
import "./globals.css";
import React from "react";
import Script from "next/script";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        {/* Load external theme script before hydration — allowed by CSP 'self' */}
        <Script src="/theme.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-black text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
