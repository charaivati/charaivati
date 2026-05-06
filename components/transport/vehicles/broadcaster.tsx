// app/api/transport/vehicles/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await ensureTable();

    const busFilter  = req.nextUrl.searchParams.get("bus")?.trim()   ?? "";
    const routeFilter = req.nextUrl.searchParams.get("route")?.trim() ?? "";

    const { rows } = await pool.query(
      `SELECT id, bus_number, route, vehicle_type, lat, lng, accuracy, updated_at
       FROM public.vehicles
       WHERE updated_at > NOW() - INTERVAL '2 minutes'
         AND ($1 = '' OR LOWER(bus_number) LIKE '%' || LOWER($1) || '%')
         AND ($2 = '' OR LOWER(route)      LIKE '%' || LOWER($2) || '%')
       ORDER BY updated_at DESC`,
      [busFilter, routeFilter]
    );

    return NextResponse.json({ vehicles: rows });
  } catch (err) {
    console.error("[vehicles] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}