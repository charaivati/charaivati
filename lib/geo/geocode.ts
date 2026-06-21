// Pincode → city/state lookup
export async function lookupPincode(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    // SSL cert expired May 2026 — silent fallback
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { city: po.District, state: po.State };
    }
  } catch {}
  return null;
}

// Nominatim free-text search → lat/lng + short label. One-off locations (errands).
export async function geocodeSearch(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Charaivati/1.0" } });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const label = String(data[0].display_name || query).split(",").slice(0, 3).join(",").trim();
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label };
    }
  } catch {}
  return null;
}

// Nominatim reverse geocode → short label for a dropped/dragged pin. India display.
// Falls back to formatted coords so a label is always returned. (REQBCAST-1g2)
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18`;
    const res = await fetch(url, { headers: { "User-Agent": "Charaivati/1.0" } });
    const data = await res.json();
    if (data?.display_name) return String(data.display_name).split(",").slice(0, 3).join(",").trim();
  } catch {}
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Nominatim geocode → lat/lng from pincode
export async function geocodePincode(pin: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pin)}&country=India&format=json&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "Charaivati/1.0" } });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}
