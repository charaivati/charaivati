// app/layout.tsx
import "./globals.css"; // keep this if you have a global stylesheet
import React from "react";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

/**
 * RootLayout — wraps the entire Next.js app.
 * Must include <html> and <body> tags per Next.js requirements.
 *
 * ⚠️ Do NOT add "use client" here.
 * Client logic goes inside nested layouts or pages (like /app/(with-nav)/layout.tsx).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Optional global meta or font imports */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-black text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
