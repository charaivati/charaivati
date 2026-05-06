// lib/types.ts

export type VehicleType = "Bus" | "Auto" | "Taxi" | "Metro" | "Other";

export interface Vehicle {
  id: string;           // slugified bus_number
  bus_number: string;
  route: string;
  vehicle_type: VehicleType;
  lat: number;
  lng: number;
  accuracy: number;
  updated_at: string;   // ISO string
}