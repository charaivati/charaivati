// app/auth/login/page.tsx
import { redirect } from "next/navigation";

export default function AuthLoginRedirect({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const r = searchParams?.redirect;
  const redirectTo = Array.isArray(r) ? r[0] : typeof r === "string" ? r : undefined;
  const target = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login";
  redirect(target);
}
