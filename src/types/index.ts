export type ThemeMode = 'dark' | 'light';

export type NavSection =
  | 'overview'
  | 'wardrobe'
  | 'builder'
  | 'lookbook'
  | 'wishlist'
  | 'planner'
  | 'ai'
  | 'settings';

export const CLOTHING_CATEGORIES = [
  'T-shirts',
  'Shirts',
  'Hoodies',
  'Jackets',
  'Pants',
  'Shorts',
  'Jorts',
  'Shoes',
  'Sneakers',
  'Slides',
  'Accessories',
  'Other',
] as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export const TOP_CATEGORIES: ClothingCategory[] = ['T-shirts', 'Shirts', 'Hoodies', 'Jackets'];
export const BOTTOM_CATEGORIES: ClothingCategory[] = ['Pants', 'Shorts', 'Jorts'];
export const SHOE_CATEGORIES: ClothingCategory[] = ['Shoes', 'Sneakers', 'Slides'];
export const ACCESSORY_CATEGORIES: ClothingCategory[] = ['Accessories', 'Other'];

export const STYLE_CATEGORIES = [
  'Streetwear',
  'Minimalist',
  'Casual',
  'Vintage',
  'Oversized',
  'Smart Casual',
  'Old Money',
] as const;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  theme?: ThemeMode;
  stylePreference?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClothingItem {
  id: string;
  userId: string;
  name: string;
  category: ClothingCategory;
  brand: string;
  color: string;
  size: string;
  price: number;
  purchaseDate?: string;
  description?: string;
  imageUrl?: string;
  storagePath?: string;
  wearCount: number;
  lastWornAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Outfit {
  id: string;
  userId: string;
  name: string;
  styleCategory: string;
  description?: string;
  topId?: string;
  bottomId?: string;
  shoesId?: string;
  accessoryIds?: string[];
  coverImageUrl?: string;
  storagePath?: string;
  isFavorite: boolean;
  source?: 'builder' | 'ai';
  createdAt: string;
  updatedAt?: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  productUrl?: string;
  notes?: string;
  imageUrl?: string;
  storagePath?: string;
  isPurchased: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OutfitSchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  outfitId: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// AI Types
export interface AIGeneratedOutfit {
  outfitName: string;
  topId: string;
  bottomId: string;
  shoesId: string;
  accessoryIds: string[];
  explanation: string;
  occasion: string;
  stylingTips: string;
  missingNote: string;
}

export interface AIOutfitGeneratorResponse {
  outfits: AIGeneratedOutfit[];
  wardrobeReadinessNote: string;
}

export interface AIStyleRecommendationResponse {
  aestheticSummary: string;
  combinations: {
    title: string;
    itemIds: string[];
    howToWear: string;
  }[];
  gapsToConsider: string;
}

export interface AIColorMatchResponse {
  colorTheoryNote: string;
  ownedMatches: {
    itemId: string;
    reason: string;
  }[];
  complementaryIdeas: {
    color: string;
    category: string;
    pairingAdvice: string;
  }[];
}

export interface AIOutfitFeedbackResponse {
  overallImpression: string;
  colorCoordination: string;
  proportionsAndSilhouette: string;
  outfitBalance: string;
  styleConsistency: string;
  improvements: string[];
}

export interface AIMissingPiecesResponse {
  wardrobeSummary: string;
  suggestions: {
    pieceName: string;
    category: string;
    recommendedColor: string;
    impactReason: string;
  }[];
}
