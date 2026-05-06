// app/api/transport/broadcast/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { VehicleType } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      bus_number,
      route = "",
      vehicle_type = "Bus",
      lat,
      lng,
      accuracy = 0,
    }: {
      bus_number: string;
      route?: string;
      vehicle_type?: VehicleType;
      lat: number;
      lng: number;
      accuracy?: number;
    } = body;

    if (!bus_number || lat == null || lng == null) {
      return NextResponse.json(
        { error: "bus_number, lat and lng are required" },
        { status: 400 }
      );
    }

    const id = bus_number.trim().toLowerCase().replace(/\s+/g, "-");

    await db.vehicle.upsert({
      where: { id },
      update: {
        busNumber: bus_number.trim(),
        route,
        vehicleType: vehicle_type,
        lat,
        lng,
        accuracy: Math.round(accuracy),
        updatedAt: new Date(),
      },
      create: {
        id,
        busNumber: bus_number.trim(),
        route,
        vehicleType: vehicle_type,
        lat,
        lng,
        accuracy: Math.round(accuracy),
      },
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[broadcast] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/transport/broadcast?id=ac-47 — stop broadcasting, remove row
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.vehicle.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[broadcast] delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}