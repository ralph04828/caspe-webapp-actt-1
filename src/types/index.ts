export type ThemeMode = 'dark' | 'light';

export type NavSection =
  | 'home'
  | 'ootd'
  | 'people'
  | 'explore'
  | 'messages'
  | 'wardrobe'
  | 'builder'
  | 'lookbook'
  | 'wishlist'
  | 'planner'
  | 'notifications'
  | 'profile'
  | 'settings';

export type Visibility = 'public' | 'friends' | 'followers' | 'private';
export type ShareVisibility = 'public' | 'unlisted' | 'revoked';
export type LaundryStatus = 'clean' | 'dirty' | 'washing';
export type CommentPolicy = 'everyone' | 'friends' | 'followers' | 'off';

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

export const FIT_VIBE_TAGS = [
  'Streetwear',
  'Minimalist',
  'Vintage',
  'Old Money',
  'Casual',
  'Oversized',
  'Y2K',
  'Sporty',
  'Techwear',
  'Colorful',
] as const;

export type FitVibeTag = (typeof FIT_VIBE_TAGS)[number];

export const SEASON_TAGS = ['Spring', 'Summer', 'Fall', 'Winter', 'All-Season'] as const;
export type SeasonTag = (typeof SEASON_TAGS)[number];

export type SizeSystem = 'US' | 'EU' | 'UK' | 'CM' | 'Letter' | 'Waist' | 'Other';

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface NotificationPrefs {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  friends?: boolean;
  messages?: boolean;
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
  customStyles?: string[];
  isPublic: boolean;
  defaultItemVisibility: Visibility;
  defaultOutfitVisibility: Visibility;
  autoDirtyOnWear: boolean;
  isAdultConfirmed: boolean;
  onboardingCompleted?: boolean;
  onboardingStep?: 1 | 2 | 3 | 'reaction' | 'friends';
  pronouns?: string;
  location?: string;
  checklistDismissed?: boolean;
  showOnlineStatus?: boolean;
  onlineStatus?: boolean;
  lastSeenAt?: string;
  weatherLocation?: WeatherLocation;
  notificationPrefs?: NotificationPrefs;
  friendsCount?: number;
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
  conversationId?: string;
  contentType: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  fullDataUrl: string;
  thumbDataUrl: string;
  byteSize: number;
  chunkCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MediaChunk {
  index: number;
  data: string;
  byteSize: number;
}

export interface ClothingItem {
  id: string;
  userId: string;
  name: string;
  category: ClothingCategory;
  brand: string;
  color: string;
  size: string;
  sizeSystem?: SizeSystem;
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
  layerLabel?: string;
  layerIndex?: number;
  name: string;
  category: string;
  brand: string;
  color: string;
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
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
  topIds?: string[];
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
  source?: 'builder' | 'remix' | 'planner';
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
  title?: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  outfitId?: string;
  itemId?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  mediaUrls?: string[];
  thumbUrls?: string[];
  mediaIds?: string[];
  altText?: string;
  altTexts?: string[];
  aspectRatio?: string;
  width?: number;
  height?: number;
  mediaDimensions?: { width: number; height: number }[];
  seasons?: SeasonTag[];
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
  editedAt?: string;
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
  replyToId?: string;
  replyToUsername?: string;
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  altText?: string;
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

export interface FriendshipEdge {
  id: string; // sorted `${smallerUid}_${largerUid}`
  users: [string, string];
  requesterId: string;
  requesterUsername: string;
  requesterName: string;
  requesterPhotoUrl?: string;
  recipientId: string;
  recipientUsername: string;
  recipientName: string;
  recipientPhotoUrl?: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  updatedAt?: string;
}

export type MyDayVisibility = 'public' | 'friends' | 'close_friends';

export interface MyDayStory {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoUrl?: string;
  mediaUrl: string;
  thumbUrl?: string;
  mediaId?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  altText: string;
  caption?: string;
  styleTag?: string;
  visibility: MyDayVisibility;
  closeFriendIds?: string[];
  viewCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface StoryView {
  id: string; // `${storyId}_${viewerId}`
  storyId: string;
  storyOwnerId: string;
  viewerId: string;
  viewerUsername: string;
  viewerName: string;
  viewerPhotoUrl?: string;
  viewedAt: string;
}

export interface ChatParticipantProfile {
  uid: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  mediaId?: string;
}

export interface ChatConversation {
  id: string;
  type: 'dm' | 'group';
  participantIds: string[];
  participantProfiles: Record<string, ChatParticipantProfile>;
  name?: string;
  photoUrl?: string;
  mediaId?: string;
  adminIds?: string[];
  createdBy: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadBy?: Record<string, number>;
  lastReadAt?: Record<string, string>;
  typingBy?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderPhotoUrl?: string;
  text: string;
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  altText?: string;
  replyTo?: {
    id: string;
    senderUsername: string;
    text: string;
  };
  sharedPostId?: string;
  sharedPostPreview?: {
    authorUsername: string;
    caption: string;
    mediaUrl?: string;
  };
  storyReplyId?: string;
  storyReplyCaption?: string;
  reactions?: Record<string, string[]>;
  createdAt: string;
}

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'follow_request'
  | 'follow_accept'
  | 'friend_request'
  | 'friend_accept'
  | 'friend_accepted'
  | 'message'
  | 'story_reply'
  | 'myday_reaction'
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
  targetType?: 'post' | 'comment' | 'user' | 'story' | 'conversation';
  targetId?: string;
  commentId?: string;
  commentSnippet?: string;
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
  targetType: 'post' | 'comment' | 'user' | 'message' | 'story';
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

export type CallType = 'voice' | 'video';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed';

export interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callerUsername: string;
  callerPhotoUrl?: string;
  calleeId: string;
  calleeName: string;
  calleeUsername: string;
  calleePhotoUrl?: string;
  callType: CallType;
  status: CallStatus;
  participants: [string, string];
  offerSdp?: string;
  answerSdp?: string;
  createdAt: string;
  answeredAt?: string;
  endedAt?: string;
  endedBy?: string;
  durationSeconds?: number;
}
