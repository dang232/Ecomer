export function buildGalleryImages(
  variantImage: string | null | undefined,
  images: readonly (string | null | undefined)[] = [],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of [variantImage, ...images]) {
    const url = value?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  return result;
}
