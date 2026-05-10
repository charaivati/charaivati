// components/ClientProviders.tsx
"use client";

import React from "react";
import LanguageProvider from "@/components/LanguageProvider";
import { LayerProvider } from "@/components/LayerContext";
import WriteQueueBanner from "@/components/WriteQueueBanner";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LayerProvider>
        {children}
        <WriteQueueBanner />
      </LayerProvider>
    </LanguageProvider>
  );
}
