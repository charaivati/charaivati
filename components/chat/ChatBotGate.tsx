"use client";

// Suppresses the floating ChatBot bubble on /listen — the Listener page is its
// own full-screen conversation; two chat surfaces would compete. Wrapper only:
// ChatBot internals are untouched.

import React from "react";
import { usePathname } from "next/navigation";
import ChatBot from "./ChatBot";

export default function ChatBotGate(props: React.ComponentProps<typeof ChatBot>) {
  const pathname = usePathname();
  if (pathname === "/listen" || pathname?.startsWith("/listen/")) return null;
  return <ChatBot {...props} />;
}
