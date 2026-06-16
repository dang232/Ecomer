/**
 * Generate a deterministic background color for an initial-letter avatar.
 *
 * The brand palette is teal (var(--primary)) + orange (#FF6200), so the avatars
 * stay in the same hue family but vary saturation/lightness slightly off
 * the seed string. Result: a row of empty-logo shops looks like a row of
 * different shops, not six identical default icons (pt32 walkthrough
 * finding).
 */
export function initialAvatarColor(seed: string): string {
  // Cheap, stable hash — sums codepoints. Not crypto, just enough to
  // spread one-letter shops across the palette.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Two-tone palette: shops alternate between teal-family and orange-family
  // hues so a row of empty-logo shops reads as visually distinct without
  // drifting outside the brand. Lightness varies in a narrow band so text
  // contrast stays predictable.
  const palette = [
    "var(--primary)",
    "#0D9488",
    "#0F766E",
    "#F97316",
    "#EA580C",
    "#FB923C",
    "#0891B2",
    "#0E7490",
  ];
  return palette[hash % palette.length] ?? palette[0];
}

export function initialFromName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const codePoint = trimmed.codePointAt(0);
  if (codePoint === undefined) return "?";
  return String.fromCodePoint(codePoint).toUpperCase();
}
