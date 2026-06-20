// REQBCAST-1e — errand suggested-price HINT (display-only, never enforced).
// This is NOT a fare, floor, or ceiling. The platform never sets the price:
// the requester and the runner agree it directly (the provider's response may
// quote anything). Named *Hint so no future reader mistakes it for authoritative.
//
// ponytail: flat base + per-km constants. There is no Store rate card to read —
// errands are requester-posted with no store at create time. Upgrade path: if a
// real errand rate card is ever added, source these two numbers from it.
import { haversineKm } from "@/lib/geo/haversine";

const ERRAND_BASE_HINT = 30; // ₹ flat
const ERRAND_PER_KM_HINT = 12; // ₹ per km, pickup → drop straight-line

export function suggestErrandPriceHint(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number
): number {
  const km = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
  return Math.round(ERRAND_BASE_HINT + ERRAND_PER_KM_HINT * km);
}
