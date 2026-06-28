"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Wordmark from "@/components/brand/Wordmark";
import AccountMenu from "@/components/nav/AccountMenu";

const NAV_BG = "#131921";

async function handleSignOut() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  window.location.href = "/login";
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ id: string; name: string | null } | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser({ id: d.user.id, name: d.user.name ?? d.user.email ?? null });
          setIsGuest(d.user.status === "guest");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <header className="w-full sticky top-0 z-50" style={{ background: NAV_BG }}>
        <div className="max-w-7xl mx-auto px-3 h-12 md:h-14 flex items-center gap-3">
          <Wordmark size="sm" href="/app/home" />
          <div className="flex-1" />
          <AccountMenu
            user={user}
            isGuest={isGuest}
            pathname={pathname ?? ""}
            onSignOut={handleSignOut}
          />
        </div>
      </header>
      {children}
    </>
  );
}
