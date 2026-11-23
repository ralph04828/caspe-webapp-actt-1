import type { CSSProperties } from 'react';

export const MIN_FEED_ASPECT_RATIO = 4 / 5; // 0.8 (tallest)
export const MAX_FEED_ASPECT_RATIO = 1.91; // 1.91:1 (widest)

/**
 * Clamps an image's natural aspect ratio (width / height) to SWOOOSH feed bounds:
 * between 4:5 (0.8) and 1.91:1 (1.91).
 */
export function clampFeedAspectRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_FEED_ASPECT_RATIO, Math.max(MIN_FEED_ASPECT_RATIO, ratio));
}

/**
 * Parses a saved aspectRatio string (e.g. "4:5", "1:1", "3:4", "16:9", "1.91:1", "4 / 5")
 * into a numeric width / height ratio. Returns null if invalid.
 */
export function parseAspectRatioString(value?: string | null): number | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sepMatch = /^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (sepMatch) {
    const w = Number(sepMatch[1]);
    const h = Number(sepMatch[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return w / h;
    }
    return null;
  }

  const num = Number(trimmed);
  if (Number.isFinite(num) && num > 0) {
    return num;
  }
  return null;
}

const KNOWN_RATIOS: Array<{ key: string; ratio: number }> = [
  { key: '3:4', ratio: 3 / 4 },
  { key: '4:5', ratio: 4 / 5 },
  { key: '1:1', ratio: 1 },
  { key: '4:3', ratio: 4 / 3 },
  { key: '16:9', ratio: 16 / 9 },
  { key: '1.91:1', ratio: 1.91 },
];

/**
 * Converts saved pixel dimensions into a normalized aspectRatio label (e.g. "4:5", "1:1", "16:9")
 * or a clamped numeric ratio string when non-standard.
 */
export function formatAspectRatioFromDimensions(
  width?: number | null,
  height?: number | null,
  options?: { clampToFeed?: boolean }
): string | undefined {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }

  const rawRatio = width / height;
  const ratio = options?.clampToFeed ? clampFeedAspectRatio(rawRatio) : rawRatio;

  for (const preset of KNOWN_RATIOS) {
    if (Math.abs(ratio - preset.ratio) <= 0.02) {
      return preset.key;
    }
  }

  return `${Number(ratio.toFixed(3))}:1`;
}

export interface DisplayAspectInput {
  aspectRatio?: string | null;
  width?: number | null;
  height?: number | null;
  mediaDimensions?: Array<{ width?: number; height?: number } | null> | null;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
  fallbackRatio?: number;
  maxHeightCss?: string;
}

export interface ResolvedDisplayAspect {
  ratio: number;
  cssAspectRatio: string;
  frameStyle: CSSProperties;
}

/**
 * Computes CSS aspect-ratio and safe max-height bounding so:
 * 1) Saved posts strictly use their chosen `aspectRatio` (or saved `width`/`height`).
 * 2) Multi-photo carousels share a single ratio (`aspectRatio` or first image).
 * 3) Legacy posts without `aspectRatio` fall back to natural dimensions clamped to [4:5, 1.91:1].
 * 4) Frame width automatically scales down when height reaches `maxHeightCss` (default `80vh`)
 *    so the chosen aspect ratio never stretches or crops vertically.
 */
export function resolveDisplayAspectRatio(input: DisplayAspectInput): ResolvedDisplayAspect {
  const maxHeightCss = input.maxHeightCss || '80vh';
  let ratio: number | null = null;

  const parsedExplicit = parseAspectRatioString(input.aspectRatio);
  if (parsedExplicit && parsedExplicit > 0) {
    ratio = parsedExplicit;
  } else if (
    typeof input.width === 'number' &&
    typeof input.height === 'number' &&
    input.width > 0 &&
    input.height > 0
  ) {
    ratio = input.width / input.height;
  } else if (
    input.mediaDimensions &&
    input.mediaDimensions[0] &&
    typeof input.mediaDimensions[0].width === 'number' &&
    typeof input.mediaDimensions[0].height === 'number' &&
    input.mediaDimensions[0].width > 0 &&
    input.mediaDimensions[0].height > 0
  ) {
    ratio = input.mediaDimensions[0].width / input.mediaDimensions[0].height;
  } else if (
    typeof input.naturalWidth === 'number' &&
    typeof input.naturalHeight === 'number' &&
    input.naturalWidth > 0 &&
    input.naturalHeight > 0
  ) {
    ratio = clampFeedAspectRatio(input.naturalWidth / input.naturalHeight);
  }

  const finalRatio =
    ratio && Number.isFinite(ratio) && ratio > 0
      ? ratio
      : input.fallbackRatio && Number.isFinite(input.fallbackRatio) && input.fallbackRatio > 0
      ? input.fallbackRatio
      : 1;

  const ratioStr = finalRatio.toFixed(4);
  const cssAspectRatio = input.aspectRatio && parsedExplicit
    ? input.aspectRatio.includes(':')
      ? input.aspectRatio.replace(':', ' / ')
      : ratioStr
    : ratioStr;

  return {
    ratio: finalRatio,
    cssAspectRatio,
    frameStyle: {
      aspectRatio: cssAspectRatio,
      maxHeight: maxHeightCss,
      maxWidth: `min(100%, calc(${maxHeightCss} * ${ratioStr}))`,
    },
  };
}
