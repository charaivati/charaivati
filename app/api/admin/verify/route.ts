// app/api/admin/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const adminEmail = process.env.EMAIL_USER;

    if (!adminEmail) {
      console.warn("EMAIL_USER not set in environment");
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

    // Check if user email matches admin email
    if (user.email === adminEmail) {
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