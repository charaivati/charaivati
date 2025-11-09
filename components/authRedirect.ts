"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Hook to navigate to login/register while remembering current page.
 * - Saves current pathname in sessionStorage
 * - Adds ?redirect= param
 */
export function useAuthRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  function safeEncode(path: string) {
    try {
      return encodeURIComponent(path || "/");
    } catch {
      return "%2F";
    }
  }

  function goToAuth(kind: "login" | "register" = "login") {
    try {
      sessionStorage.setItem("charaivati.redirect", pathname || "/");
    } catch {
      /* ignore */
    }
    const url = `/${kind}?redirect=${safeEncode(pathname || "/")}`;
    router.push(url);
  }

  return { goToAuth };
}
