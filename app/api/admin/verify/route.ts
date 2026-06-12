// app/api/admin/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;

    if (!adminEmail) {
      console.warn("ADMIN_EMAIL / ADMIN_ALERT_EMAIL not set in environment");
      return NextResponse.json(
        { error: "Admin access not configured" },
        { status: 403 }
      );
    }

    // Get current user from JWT cookie
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user email matches admin email (case-insensitive, mirrors /admin/security)
    if (user.email?.toLowerCase() === adminEmail.toLowerCase()) {
      return NextResponse.json({ 
        admin: true, 
        user: { id: user.id, email: user.email, name: user.name } 
      });
    }

    return NextResponse.json(
      { error: "Not an admin user" },
      { status: 403 }
    );
  } catch (error) {
    console.error("Admin verify error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}