import { FIT_VIBE_TAGS, STYLE_CATEGORIES } from '../types';

export const MAX_STYLE_TAG_LENGTH = 24;
export const STYLE_TAG_REGEX = /^[a-zA-Z0-9 -]{1,24}$/;

export const ALL_BUILT_IN_STYLES: string[] = Array.from(
  new Set([...STYLE_CATEGORIES, ...FIT_VIBE_TAGS])
);

export function collapseSpaces(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Formats a custom tag cleanly so capitalization is consistent across the app
 * while preserving short uppercase abbreviations like Y2K or OOTD.
 */
export function formatCanonicalTag(raw: string, knownTags: string[] = []): string {
  const cleaned = collapseSpaces(raw);
  if (!cleaned) return '';

  const lookupPool = [...ALL_BUILT_IN_STYLES, ...knownTags];
  const exactKnown = lookupPool.find((k) => k.toLowerCase() === cleaned.toLowerCase());
  if (exactKnown) return exactKnown;

  return cleaned
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (/^[A-Z0-9-]{2,4}$/.test(word)) return word;
      return word
        .split('-')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
        .join('-');
    })
    .join(' ');
}

export function validateCustomStyleTag(
  raw: string
): { ok: true; formatted: string } | { ok: false; error: string } {
  const cleaned = collapseSpaces(raw);
  if (!cleaned) {
    return { ok: false, error: 'Enter a style tag name.' };
  }
  if (cleaned.length > MAX_STYLE_TAG_LENGTH) {
    return {
      ok: false,
      error: `Keep custom styles to ${MAX_STYLE_TAG_LENGTH} characters or less.`,
    };
  }
  if (!STYLE_TAG_REGEX.test(cleaned)) {
    return {
      ok: false,
      error: 'Use only letters, numbers, spaces, or hyphens.',
    };
  }
  return { ok: true, formatted: formatCanonicalTag(cleaned) };
}

/**
 * Deduplicates style tags case-insensitively, normalizing casing against built-in/custom tags
 * so tags like "Streetwear" and "streetwear" never appear twice on a post or card.
 */
export function dedupeStyleTags(
  tags: Array<string | undefined | null>,
  knownTags: string[] = [],
  maxCount?: number
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    if (!raw) continue;
    const formatted = formatCanonicalTag(raw, knownTags);
    if (!formatted) continue;
    const key = formatted.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(formatted);
    if (typeof maxCount === 'number' && result.length >= maxCount) break;
  }

  return result;
}
