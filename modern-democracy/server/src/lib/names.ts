/**
 * Constituency name normalization. The legacy SVG uses 2010-era names with
 * underscores ("South_East_Cornwall"); the Members API returns current
 * boundary names ("Aberafan Maesteg"). Normalize both sides before matching
 * so that punctuation, diacritics, ampersands, and comma forms don't block
 * genuine matches. Boundary renames remain unmatched by design.
 */
export function normalizeConstituencyName(raw: string) {
  return raw
    .replace(/_/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[,.'’()-]/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bupon\b/g, "on")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Birmingham, Ladywood" and "Ladywood, Birmingham" style flips. */
export function commaFlip(original: string) {
  const parts = original.replace(/_/g, " ").split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;
  return normalizeConstituencyName(`${parts[1]} ${parts[0]}`);
}
