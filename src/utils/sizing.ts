import { ClothingCategory, SizeSystem } from '../types';

export type CategorySizeKind = 'tops' | 'bottoms' | 'footwear' | 'accessories' | 'other';
export type ShoeSizeSystem = 'US' | 'EU' | 'UK' | 'CM';
export type BottomSizeMode = 'Letter' | 'Waist';

export const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const TOP_SIZES = [...LETTER_SIZES, 'One size'] as const;

export const WAIST_SIZES: string[] = Array.from({ length: 17 }, (_, i) => String(26 + i)); // 26..42

export const SHOE_SIZE_SYSTEMS: ShoeSizeSystem[] = ['US', 'EU', 'UK', 'CM'];

export const US_SHOE_SIZES: string[] = Array.from({ length: 21 }, (_, i) =>
  String(5 + i * 0.5)
); // 5..15 in 0.5 steps
export const EU_SHOE_SIZES: string[] = Array.from({ length: 14 }, (_, i) => String(35 + i)); // 35..48
export const UK_SHOE_SIZES: string[] = Array.from({ length: 12 }, (_, i) => String(3 + i)); // 3..14
export const CM_SHOE_SIZES: string[] = Array.from({ length: 19 }, (_, i) =>
  String(22 + i * 0.5)
); // 22..31 in 0.5 steps

export const ACCESSORY_PRESET_SIZES = ['One size', 'S', 'M', 'L'] as const;

export function getCategorySizeKind(category: ClothingCategory | string): CategorySizeKind {
  if (['T-shirts', 'Shirts', 'Hoodies', 'Jackets'].includes(category)) return 'tops';
  if (['Pants', 'Shorts', 'Jorts'].includes(category)) return 'bottoms';
  if (['Shoes', 'Sneakers', 'Slides'].includes(category)) return 'footwear';
  if (category === 'Accessories') return 'accessories';
  return 'other';
}

export function getShoeSizesForSystem(system: ShoeSizeSystem): string[] {
  switch (system) {
    case 'US':
      return US_SHOE_SIZES;
    case 'EU':
      return EU_SHOE_SIZES;
    case 'UK':
      return UK_SHOE_SIZES;
    case 'CM':
      return CM_SHOE_SIZES;
  }
}

export function getShoeSystemStorageKey(uid?: string): string {
  return `swooosh_shoe_size_system_${uid || 'anon'}`;
}

export function getSavedShoeSystem(uid?: string): ShoeSizeSystem {
  try {
    const raw = localStorage.getItem(getShoeSystemStorageKey(uid));
    if (raw === 'US' || raw === 'EU' || raw === 'UK' || raw === 'CM') {
      return raw;
    }
  } catch {
    // ignore storage failures
  }
  return 'US';
}

export function savePreferredShoeSystem(system: ShoeSizeSystem, uid?: string): void {
  try {
    localStorage.setItem(getShoeSystemStorageKey(uid), system);
  } catch {
    // ignore storage failures
  }
}

export function formatShoeSizeValue(system: ShoeSizeSystem, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return '';
  if (/^(US|EU|UK|CM)\s+/i.test(trimmed)) {
    return trimmed.replace(/^(US|EU|UK|CM)\s+/i, (_, sys) => `${sys.toUpperCase()} `);
  }
  return `${system} ${trimmed}`;
}

export function parseShoeSizeValue(
  sizeValue: string,
  fallbackSystem: ShoeSizeSystem = 'US'
): { system: ShoeSizeSystem; value: string } {
  const trimmed = (sizeValue || '').trim();
  const match = trimmed.match(/^(US|EU|UK|CM)\s+(.+)$/i);
  if (match) {
    return {
      system: match[1].toUpperCase() as ShoeSizeSystem,
      value: match[2].trim(),
    };
  }
  return { system: fallbackSystem, value: trimmed };
}

export function getDefaultSizeForCategory(
  category: ClothingCategory | string,
  preferredShoeSystem: ShoeSizeSystem = 'US'
): { size: string; sizeSystem?: SizeSystem } {
  const kind = getCategorySizeKind(category);
  if (kind === 'tops') return { size: 'M', sizeSystem: 'Letter' };
  if (kind === 'bottoms') return { size: 'M', sizeSystem: 'Letter' };
  if (kind === 'footwear') {
    const defaultVal =
      preferredShoeSystem === 'EU'
        ? '42'
        : preferredShoeSystem === 'UK'
        ? '8'
        : preferredShoeSystem === 'CM'
        ? '27'
        : '9';
    return { size: `${preferredShoeSystem} ${defaultVal}`, sizeSystem: preferredShoeSystem };
  }
  if (kind === 'accessories') return { size: 'One size', sizeSystem: 'Other' };
  return { size: '', sizeSystem: 'Other' };
}

export function isSizeValidForCategory(
  size: string,
  category: ClothingCategory | string
): boolean {
  const trimmed = (size || '').trim();
  if (!trimmed) return true; // Empty/unselected is compatible
  const kind = getCategorySizeKind(category);

  if (kind === 'tops') {
    return (TOP_SIZES as readonly string[]).includes(trimmed);
  }

  if (kind === 'bottoms') {
    if (trimmed === 'One size') return true;
    if ((LETTER_SIZES as readonly string[]).includes(trimmed)) return true;
    const strippedWaist = trimmed.replace(/^(W|Waist)\s*/i, '');
    return WAIST_SIZES.includes(strippedWaist);
  }

  if (kind === 'footwear') {
    const parsed = parseShoeSizeValue(trimmed);
    const list = getShoeSizesForSystem(parsed.system);
    if (/^(US|EU|UK|CM)\s+/i.test(trimmed)) {
      return list.includes(parsed.value);
    }
    return SHOE_SIZE_SYSTEMS.some((sys) => getShoeSizesForSystem(sys).includes(trimmed));
  }

  if (kind === 'accessories') {
    // Accessories accept preset sizes OR custom free-text sizes (ring, belt, cap)
    // Reject obvious shoe-only or waist-only formatted strings when switching categories
    if (/^(US|EU|UK|CM)\s+\d+(\.5)?$/i.test(trimmed)) return false;
    return true;
  }

  // 'other' accepts any free text
  return true;
}

export function getSizeFilterOptionsForCategory(
  categoryFilter: 'All' | ClothingCategory,
  items: { size: string; category: ClothingCategory }[]
): string[] {
  if (categoryFilter === 'All') {
    const unique = Array.from(
      new Set(items.map((item) => (item.size || '').trim()).filter(Boolean))
    );
    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  const kind = getCategorySizeKind(categoryFilter);
  const existingForCat = items
    .filter((i) => i.category === categoryFilter)
    .map((i) => (i.size || '').trim())
    .filter(Boolean);

  if (kind === 'tops') {
    return Array.from(new Set([...TOP_SIZES, ...existingForCat]));
  }
  if (kind === 'bottoms') {
    return Array.from(new Set([...LETTER_SIZES, 'One size', ...WAIST_SIZES, ...existingForCat]));
  }
  if (kind === 'footwear') {
    const defaultShoes = [
      ...US_SHOE_SIZES.map((s) => `US ${s}`),
      ...EU_SHOE_SIZES.map((s) => `EU ${s}`),
      ...UK_SHOE_SIZES.map((s) => `UK ${s}`),
      ...CM_SHOE_SIZES.map((s) => `CM ${s}`),
    ];
    // Put sizes the user actually owns first, followed by standard catalog sizes
    return Array.from(new Set([...existingForCat, ...defaultShoes]));
  }
  if (kind === 'accessories') {
    return Array.from(new Set([...ACCESSORY_PRESET_SIZES, ...existingForCat]));
  }
  return Array.from(new Set(existingForCat)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}
