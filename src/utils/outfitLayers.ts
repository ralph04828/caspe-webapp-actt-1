import { Outfit } from '../types';

export const MAX_TOP_LAYERS = 5;
export const MAX_OUTFIT_ACCESSORIES = 8;

export function getOutfitTopIds(
  outfit: Pick<Outfit, 'topId' | 'topIds'> | null | undefined
): string[] {
  if (!outfit) return [];
  if (Array.isArray(outfit.topIds) && outfit.topIds.length > 0) {
    return Array.from(new Set(outfit.topIds.filter(Boolean))).slice(0, MAX_TOP_LAYERS);
  }
  return outfit.topId ? [outfit.topId] : [];
}

export function getOutfitAccessoryIds(
  outfit: Pick<Outfit, 'accessoryIds'> | null | undefined
): string[] {
  if (!outfit || !Array.isArray(outfit.accessoryIds)) return [];
  return Array.from(new Set(outfit.accessoryIds.filter(Boolean))).slice(0, MAX_OUTFIT_ACCESSORIES);
}

export function getTopLayerLabels(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return ['Top'];
  if (count === 2) return ['Inner layer', 'Outer layer'];
  if (count === 3) return ['Inner layer', 'Middle layer', 'Outer layer'];
  return Array.from({ length: count }, (_, idx) => {
    if (idx === 0) return 'Inner layer';
    if (idx === count - 1) return 'Outer layer';
    return `Middle layer ${idx}`;
  });
}

export function getOutfitAllItemIds(
  outfit: Pick<Outfit, 'topId' | 'topIds' | 'bottomId' | 'shoesId' | 'accessoryIds'> | null | undefined
): string[] {
  if (!outfit) return [];
  const ids = [
    ...getOutfitTopIds(outfit),
    outfit.bottomId || '',
    outfit.shoesId || '',
    ...getOutfitAccessoryIds(outfit),
  ].filter(Boolean);
  return Array.from(new Set(ids));
}
