// lib/logout.ts

/**
 * Returns the landing page for a container/app section
 * after logout + re-login.
 *
 * Example:
 * /app/saved        -> /app/home
 * /store/abc/item   -> /store
 * /admin/users      -> /admin
 */
export function getLogoutRedirect(pathname: string) {
  // App container
  if (pathname.startsWith("/app")) {
    return "/app/home";
  }

  // Store container
  if (pathname.startsWith("/store")) {
    return "/store";
  }

  // Future admin container
  if (pathname.startsWith("/admin")) {
    return "/admin";
  }

  // Default fallback
  return "/";
}