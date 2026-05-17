const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? process.env.UPSLASH_KEY ?? "";
const PEXELS_KEY = process.env.PEXELS_KEY ?? "";
const PIXABAY_KEY = process.env.PIXABAY_KEY ?? "";

type ImageResult = { url: string; provider: string } | null;

async function fromUnsplash(query: string): Promise<ImageResult> {
  if (!UNSPLASH_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    const data = await res.json();
    const url = data?.results?.[0]?.urls?.small ?? null;
    return url ? { url, provider: "unsplash" } : null;
  } catch {
    return null;
  }
}

async function fromPexels(query: string): Promise<ImageResult> {
  if (!PEXELS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await res.json();
    const url = data?.photos?.[0]?.src?.large ?? null;
    return url ? { url, provider: "pexels" } : null;
  } catch {
    return null;
  }
}

async function fromPixabay(query: string): Promise<ImageResult> {
  if (!PIXABAY_KEY) return null;
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=3`
    );
    const data = await res.json();
    const url = data?.hits?.[0]?.webformatURL ?? null;
    return url ? { url, provider: "pixabay" } : null;
  } catch {
    return null;
  }
}

function fromPicsum(query: string): ImageResult {
  const seed = query.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return { url: `https://picsum.photos/seed/${seed}/800/400`, provider: "picsum" };
}

let callCount = 0;

function getProviderOrder(): Array<(q: string) => Promise<ImageResult>> {
  const rotation = callCount % 3;
  callCount++;
  if (rotation === 0) return [fromUnsplash, fromPexels, fromPixabay];
  if (rotation === 1) return [fromPexels, fromPixabay, fromUnsplash];
  return [fromPixabay, fromUnsplash, fromPexels];
}

export async function fetchImage(query: string): Promise<string | null> {
  const providers = getProviderOrder();
  for (const provider of providers) {
    const result = await provider(query);
    if (result?.url) {
      console.log(`[imageSearch] "${query}" → ${result.provider}`);
      return result.url;
    }
  }
  const fallback = fromPicsum(query);
  console.log(`[imageSearch] "${query}" → picsum (fallback)`);
  return fallback?.url ?? null;
}

export async function fetchImages(queries: string[]): Promise<(string | null)[]> {
  return Promise.all(queries.map(fetchImage));
}
