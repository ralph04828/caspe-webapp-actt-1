export type ThemeMode = 'dark' | 'light';

export type NavSection =
  | 'home'
  | 'explore'
  | 'wardrobe'
  | 'builder'
  | 'lookbook'
  | 'wishlist'
  | 'planner'
  | 'ai'
  | 'notifications'
  | 'profile'
  | 'settings';

export type Visibility = 'public' | 'followers' | 'private';
export type ShareVisibility = 'public' | 'unlisted' | 'revoked';
export type LaundryStatus = 'clean' | 'dirty' | 'washing';
export type CommentPolicy = 'everyone' | 'followers' | 'off';

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
  'Techwear',
  'Workwear',
] as const;

export const SEASON_TAGS = ['Spring', 'Summer', 'Fall', 'Winter', 'All-Season'] as const;
export type SeasonTag = (typeof SEASON_TAGS)[number];

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface NotificationPrefs {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  remixes: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  usernameLower: string;
  bio: string;
  photoURL?: string;
  mediaId?: string;
  theme?: ThemeMode;
  stylePreference?: string;
  styleTags: string[];
  isPublic: boolean;
  defaultItemVisibility: Visibility;
  defaultOutfitVisibility: Visibility;
  autoDirtyOnWear: boolean;
  isAdultConfirmed: boolean;
  weatherLocation?: WeatherLocation;
  notificationPrefs?: NotificationPrefs;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MediaAsset {
  id: string;
  ownerId: string;
  visibility: Visibility;
  fullDataUrl: string;
  thumbDataUrl: string;
  byteSize: number;
  createdAt: string;
}

export interface ClothingItem {
  id: string;
  userId: string;
  name: string;
  category: ClothingCategory;
  brand: string;
  color: string;
  size: string;
  seasons: SeasonTag[];
  styleTags: string[];
  description?: string;
  altText: string;
  visibility: Visibility;
  laundryStatus: LaundryStatus;
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  isCutout?: boolean;
  wearCount: number;
  lastWornAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OutfitPieceSnapshot {
  id: string;
  slot: 'top' | 'bottom' | 'shoes' | 'accessory';
  name: string;
  category: string;
  brand: string;
  color: string;
  imageUrl?: string;
  thumbUrl?: string;
  visibility: Visibility;
  isPrivatePlaceholder?: boolean;
}

export interface Outfit {
  id: string;
  userId: string;
  name: string;
  styleCategory: string;
  occasion?: string;
  seasons: SeasonTag[];
  tags: string[];
  description?: string;
  topId?: string;
  bottomId?: string;
  shoesId?: string;
  accessoryIds?: string[];
  pieceSnapshots?: OutfitPieceSnapshot[];
  coverImageUrl?: string;
  mediaId?: string;
  visibility: Visibility;
  allowRemix: boolean;
  remixedFrom?: {
    postId?: string;
    outfitId?: string;
    userId?: string;
    username: string;
    displayName: string;
  };
  isFavorite: boolean;
  source?: 'builder' | 'ai' | 'remix';
  createdAt: string;
  updatedAt?: string;
}

export type PostType = 'outfit' | 'piece' | 'ootd';

export interface SocialPost {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoUrl?: string;
  postType: PostType;
  caption: string;
  hashtags: string[];
  mentions: string[];
  outfitId?: string;
  itemId?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  altText?: string;
  piecesPreview?: OutfitPieceSnapshot[];
  styleTags: string[];
  occasion?: string;
  visibility: Visibility;
  allowRemix: boolean;
  commentPolicy: CommentPolicy;
  remixedFrom?: {
    postId?: string;
    outfitId?: string;
    userId?: string;
    username: string;
    displayName: string;
  };
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  remixesCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  postAuthorId: string;
  userId: string;
  authorUsername: string;
  authorName: string;
  authorPhotoUrl?: string;
  text: string;
  mentions: string[];
  createdAt: string;
}

export interface FollowEdge {
  id: string; // `${followerId}_${targetId}`
  followerId: string;
  followerUsername: string;
  followerName: string;
  followerPhotoUrl?: string;
  targetId: string;
  targetUsername: string;
  targetName: string;
  status: 'accepted' | 'pending';
  createdAt: string;
  updatedAt?: string;
}

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'mention'
  | 'remix';

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorName: string;
  actorPhotoUrl?: string;
  type: NotificationType;
  targetId?: string;
  targetPreview?: string;
  read: boolean;
  createdAt: string;
}

export interface UserSafetyEdge {
  id: string;
  userId: string;
  targetId: string;
  targetUsername: string;
  targetName?: string;
  createdAt: string;
}

export interface ContentReport {
  id: string;
  reporterId: string;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  targetOwnerId?: string;
  reason: string;
  details?: string;
  status: 'submitted';
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  name: string;
  brand: string;
  category: string;
  colorTags: string[];
  styleTags: string[];
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'wanted' | 'got_it';
  visibility: Visibility;
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OutfitSchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  outfitId: string;
  notes?: string;
  wornConfirmed?: boolean;
  wornAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WearLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  itemIds: string[];
  outfitId?: string;
  createdAt: string;
}

export interface ShareLink {
  token: string;
  userId: string;
  targetType: 'lookbook' | 'outfit';
  targetId?: string;
  title: string;
  description: string;
  previewImageUrl?: string;
  authorUsername: string;
  authorName: string;
  visibility: ShareVisibility;
  outfitsSnapshot: {
    id: string;
    name: string;
    styleCategory: string;
    occasion?: string;
    description?: string;
    coverImageUrl?: string;
    pieces: OutfitPieceSnapshot[];
  }[];
  createdAt: string;
  updatedAt?: string;
}

export interface WeatherForecast {
  locationName: string;
  currentTempC: number;
  feelsLikeC: number;
  conditionCode: number;
  conditionLabel: string;
  precipitationMm: number;
  windKmh: number;
  clothingAdvice: string;
  daily: {
    date: string;
    tempMaxC: number;
    tempMinC: number;
    conditionCode: number;
    conditionLabel: string;
    precipitationProb: number;
  }[];
  fetchedAt: string;
}

// AI Types
export interface AIQuotaStatus {
  configured: boolean;
  killSwitch?: boolean;
  used: number;
  limit: number;
  remaining: number;
  isDemo: boolean;
}

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
  quota?: AIQuotaStatus;
}

export interface AIStyleRecommendationResponse {
  aestheticSummary: string;
  combinations: {
    title: string;
    itemIds: string[];
    howToWear: string;
  }[];
  gapsToConsider: string;
  quota?: AIQuotaStatus;
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
  quota?: AIQuotaStatus;
}

export interface AIOutfitFeedbackResponse {
  overallImpression: string;
  colorCoordination: string;
  proportionsAndSilhouette: string;
  outfitBalance: string;
  styleConsistency: string;
  improvements: string[];
  quota?: AIQuotaStatus;
}

export interface AIMissingPiecesResponse {
  wardrobeSummary: string;
  suggestions: {
    pieceName: string;
    category: string;
    recommendedColor: string;
    impactReason: string;
  }[];
  quota?: AIQuotaStatus;
}

export interface AIAutoTagResponse {
  name: string;
  category: ClothingCategory;
  color: string;
  styleTags: string[];
  seasons: SeasonTag[];
  altText: string;
  description: string;
  quota?: AIQuotaStatus;
}

export interface AIRemixResponse {
  slotToSwap: 'top' | 'bottom' | 'shoes' | 'accessory';
  replacementItemId: string;
  replacementSummary: string;
  rationale: string;
  quota?: AIQuotaStatus;
}
