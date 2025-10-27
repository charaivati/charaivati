// app/api/auth/csrf/route.ts
import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/csrf";
import { createToken } from "@/lib/token";

export async function GET() {
  // create a response object to attach headers/cookies to
  const res = NextResponse.json({ ok: true });

  // generate token and set cookie using helper that expects (res, token)
  const token = createToken(24); // adjust length if your helper expects other semantics
  setCsrfCookie(res, token);

  // Optionally return the token in JSON (useful for dev/forms)
  return NextResponse.json({ csrfToken: token }, { headers: res.headers });
}
