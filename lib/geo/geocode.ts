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

// Photon (komoot) free-text typeahead → up to 5 candidates. One-off locations (errands/MAP-SEARCH-1b).
// Photon GeoJSON coords are [lon, lat] — do not swap.
export async function geocodeSearch(query: string, bias?: { lat: number; lng: number }): Promise<Array<{ lat: number; lng: number; label: string }>> {
  let url = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=5&lang=en`;
  if (bias) url += `&lat=${bias.lat}&lon=${bias.lng}`;
  const res = await fetch(url);
  const data = await res.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  return features.map((f: any) => {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    const label = [p.name, p.city ?? p.state, p.country].filter(Boolean).join(", ");
    return { lat, lng, label: label || query };
  }).filter((r: any) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
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
