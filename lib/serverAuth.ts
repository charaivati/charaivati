// lib/serverAuth.ts
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

type PublicUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  avatarStorageKey?: string | null;
  status?: string | null;
  [k: string]: any;
};

/**
 * getServerUser(req?)
 * - extracts cookie from Request headers
 * - verifies JWT using verifySessionToken
 * - returns user or null
 * - falls back to dev_email and ?email only in dev mode
 */
export default async function getServerUser(req?: Request): Promise<PublicUser | null> {
  try {
    // parse cookies from Request header (safe for route handlers)
    function parseCookiesFromReq(r?: Request) {
      const map: Record<string, string> = {};
      if (!r) return map;
      const header = r.headers.get("cookie") || "";
      header
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((pair) => {
          const [k, ...rest] = pair.split("=");
          map[k] = decodeURIComponent(rest.join("="));
        });
      return map;
    }

    const cookies = parseCookiesFromReq(req);

    // 1) Try cookie by canonical name (COOKIE_NAME)
    const token = cookies[COOKIE_NAME] ?? cookies["session"] ?? null; // also accept 'session' for backward compatibility
    if (token) {
      // verifySessionToken is async -> await it
      const payload = await verifySessionToken(token as string);
      if (payload) {
        // token payload may use userId or sub — handle both
        const userId = (payload as any).userId ?? (payload as any).sub;
        if (userId) {
          const u = await prisma.user.findUnique({
            where: { id: String(userId) },
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              avatarStorageKey: true,
              status: true,
            },
          });
          if (u) return u as PublicUser;
        }
      } else {
        // token present but invalid — helpful debug logging
        console.debug("[getServerUser] token present but verifySessionToken returned false/invalid");
      }
    }

    // DEV fallback: dev_email cookie (only useful for local testing)
    if (process.env.NODE_ENV !== "production") {
      const devEmail = cookies["dev_email"];
      if (devEmail) {
        const u = await prisma.user.findUnique({
          where: { email: devEmail },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            avatarStorageKey: true,
            status: true,
          },
        });
        if (u) return u as PublicUser;
      }

      // Also allow ?email=... query param if provided (handy for curl)
      if (req) {
        try {
          const url = new URL(req.url);
          const q = url.searchParams.get("email");
          if (q) {
            const u = await prisma.user.findUnique({
              where: { email: q },
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                avatarStorageKey: true,
                status: true,
              },
            });
            if (u) return u as PublicUser;
          }
        } catch (err) {
          // ignore parse errors
        }
      }
    }

    return null;
  } catch (err) {
    console.error("getServerUser error", err);
    return null;
  }
}
