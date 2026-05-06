// app/api/transport/vehicles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const busFilter   = req.nextUrl.searchParams.get("bus")?.trim()   ?? "";
    const routeFilter = req.nextUrl.searchParams.get("route")?.trim() ?? "";

    // Only return vehicles updated in the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const vehicles = await db.vehicle.findMany({
      where: {
        updatedAt: { gte: twoMinutesAgo },
        ...(busFilter   && { busNumber: { contains: busFilter,   mode: "insensitive" } }),
        ...(routeFilter && { route:     { contains: routeFilter, mode: "insensitive" } }),
      },
      orderBy: { updatedAt: "desc" },
    });

    // Map camelCase Prisma fields back to snake_case so the frontend stays unchanged
    const response = vehicles.map((v) => ({
      id:           v.id,
      bus_number:   v.busNumber,
      route:        v.route ?? "",
      vehicle_type: v.vehicleType,
      lat:          v.lat,
      lng:          v.lng,
      accuracy:     v.accuracy ?? 0,
      updated_at:   v.updatedAt.toISOString(),
    }));

    return NextResponse.json({ vehicles: response });
  } catch (err) {
    console.error("[vehicles] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}