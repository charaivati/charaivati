import { prisma } from "@/lib/prisma";
import { fetchImages } from "@/lib/imageSearch";

function detectProvider(url: string): { provider: string; quality: number } {
  if (url.includes("unsplash.com")) return { provider: "unsplash", quality: 3 };
  if (url.includes("pexels.com"))   return { provider: "pexels",   quality: 2 };
  if (url.includes("pixabay.com"))  return { provider: "pixabay",  quality: 1 };
  return                                   { provider: "picsum",   quality: 0 };
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

export async function resolveImage(
  query: string,
  opts: { allowUnsplash?: boolean } = {}
): Promise<{
  url: string;
  provider: string;
  quality: number;
}> {
  const key = normalizeQuery(query);

  const cached = await prisma.imageCache.findUnique({ where: { query: key } });
  if (cached) {
    await prisma.imageCache.update({
      where: { query: key },
      data: { usageCount: { increment: 1 } },
    });
    return { url: cached.imageUrl, provider: cached.provider, quality: cached.quality };
  }

  const [url] = await fetchImages([query], opts);
  const resolved = url ?? `https://picsum.photos/seed/${encodeURIComponent(key)}/800/400`;
  const { provider, quality } = detectProvider(resolved);

  await prisma.imageCache.upsert({
    where:  { query: key },
    create: { query: key, imageUrl: resolved, provider, quality, usageCount: 1 },
    update: { imageUrl: resolved, provider, quality, usageCount: { increment: 1 } },
  });

  return { url: resolved, provider, quality };
}

export async function resolveImageFresh(query: string): Promise<{
  url: string;
  provider: string;
  quality: number;
}> {
  const key = normalizeQuery(query);
  const [url] = await fetchImages([query]);
  const resolved = url ?? `https://picsum.photos/seed/${encodeURIComponent(key)}/800/400`;
  const { provider, quality } = detectProvider(resolved);

  await prisma.imageCache.upsert({
    where:  { query: key },
    create: { query: key, imageUrl: resolved, provider, quality, usageCount: 1 },
    update: { imageUrl: resolved, provider, quality },
  });

  return { url: resolved, provider, quality };
}
