import { ClothingCategory, SeasonTag } from '../types';

export function formatShortDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString.includes('T') ? dateString : `${dateString}T12:00:00`);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const ts = new Date(isoString).getTime();
  if (Number.isNaN(ts)) return isoString;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatShortDate(isoString);
}

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 24);
}

export function validateUsername(raw: string): string | null {
  const clean = raw.trim().replace(/^@+/, '');
  if (clean.length < 3) return 'Username must be at least 3 characters.';
  if (clean.length > 24) return 'Username must be 24 characters or fewer.';
  if (!/^[a-zA-Z0-9._]+$/.test(clean)) {
    return 'Username can only use letters, numbers, dots, and underscores.';
  }
  return null;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase()))).slice(0, 12);
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9._]{3,24})/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase()))).slice(0, 12);
}

const BLOCKED_TERMS = [
  'slur',
  'kill yourself',
  'kys',
  'hate speech',
];

export function checkTextSafety(text: string): { ok: boolean; reason?: string } {
  const lower = text.toLowerCase();
  if (text.length > 1000) {
    return { ok: false, reason: 'Text is too long (maximum 1,000 characters).' };
  }
  for (const term of BLOCKED_TERMS) {
    if (lower.includes(term)) {
      return {
        ok: false,
        reason: 'Please keep SWOOOSH supportive and free from harassment or abusive language.',
      };
    }
  }
  return { ok: true };
}

export function buildAutoAltText(params: {
  color?: string;
  brand?: string;
  name?: string;
  category?: ClothingCategory | string;
}): string {
  const parts = [
    params.color?.trim(),
    params.brand?.trim(),
    params.name?.trim() || params.category?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Garment photo';
}

export function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const ts = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
}

export function getSuggestedSeasonsForTemp(tempC?: number): SeasonTag[] {
  if (tempC === undefined) return ['All-Season'];
  if (tempC <= 10) return ['Winter', 'Fall', 'All-Season'];
  if (tempC <= 19) return ['Fall', 'Spring', 'All-Season'];
  if (tempC <= 26) return ['Spring', 'Summer', 'All-Season'];
  return ['Summer', 'All-Season'];
}
