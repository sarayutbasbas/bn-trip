// Remove administrative labels only as whole words, never syllables inside
// names (Toyama, Kyoto, Hokkaido and Gifu must remain intact).
export function normalizedMapName(value: string) {
  return value.toLowerCase()
    .replace(/\b(?:province|prefecture|metropolis)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function matchMapBadge<T extends { nameEn: string; slug: string; aliases: readonly string[] }>(name: string, badges: readonly T[]): T | undefined {
  const key = normalizedMapName(name);
  if (!key) return undefined;
  const matches = badges.filter(badge => [badge.nameEn, badge.slug, ...badge.aliases]
    .some(value => normalizedMapName(value) === key));
  // Ambiguous or unknown regions should not silently select another badge.
  return matches.length === 1 ? matches[0] : undefined;
}
