// app/layout.tsx
import "./globals.css";
import React from "react";
import ThemeClientLoader from "@/components/ThemeClientLoader";
import LanguageProvider from "@/components/LanguageProvider";

export const metadata = {
  title: "Charaivati",
  description: "A unified view of Self, Society, Nation, Earth, and Universe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-black text-white min-h-screen antialiased">
        <ThemeClientLoader />
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}