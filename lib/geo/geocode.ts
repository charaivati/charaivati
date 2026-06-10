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
