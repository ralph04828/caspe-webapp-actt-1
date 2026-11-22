import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppNotification,
  ChatConversation,
  ChatMessage,
  ChatParticipantProfile,
  ClothingItem,
  CommentPolicy,
  FollowEdge,
  FriendshipEdge,
  MyDayStory,
  MyDayVisibility,
  Outfit,
  OutfitPieceSnapshot,
  PostComment,
  PostType,
  SeasonTag,
  ShareLink,
  ShareVisibility,
  SocialPost,
  StoryView,
  UserProfile,
  UserSafetyEdge,
  Visibility,
} from '../types';
import { useAuth } from './AuthContext';
import {
  DEMO_COMMENTS,
  DEMO_COMMUNITY_PROFILES,
  DEMO_FOLLOWS,
  DEMO_NOTIFICATIONS,
  DEMO_POSTS,
  getDemoConversations,
  getDemoFriendships,
  getDemoMessages,
  getDemoStories,
} from '../data/demoData';
import {
  acceptFollowEdge,
  acceptFriendRequestFirestore,
  addCommentFirestore,
  createGroupConversation,
  createMyDayStory,
  createNotification,
  createSocialPost,
  deleteCommentFirestore,
  deleteMyDayStory,
  deleteSocialPost,
  fetchFriendStories,
  fetchFriendsAndFollowedPosts,
  getCommentsForPost,
  getOrCreateDmConversation,
  getShareLinkByToken,
  getStoryViewers,
  getUserActiveStories,
  getUserPosts,
  getVisibleOutfitsForUser,
  getVisibleWardrobeForUser,
  leaveConversationFirestore,
  listDiscoverableProfiles,
  markAllNotificationsRead,
  markConversationReadFirestore,
  markNotificationRead,
  recordStoryViewFirestore,
  removeFollowEdge,
  removeFriendshipFirestore,
  saveFollowEdge,
  saveShareLink,
  sendConversationMessageFirestore,
  sendFriendRequestFirestore,
  submitReport,
  subscribeBlocks,
  subscribeIncomingFollows,
  subscribeMutes,
  subscribeMyPosts,
  subscribeMyStories,
  subscribeMyStoryViews,
  subscribeNotifications,
  subscribeOutgoingFollows,
  subscribePublicPosts,
  subscribePublicStories,
  subscribeUserConversations,
  subscribeUserFriendships,
  subscribeUserLikes,
  subscribeUserSaves,
  subscribeUserShareLinks,
  toggleBlockUser,
  toggleMuteUser,
  togglePostLikeFirestore,
  togglePostSaveFirestore,
  updateGroupConversation,
  updateShareLink,
  updateSocialPost,
} from '../services/firestoreService';
import {
  checkMessageRateLimit,
  checkTextSafety,
  extractHashtags,
  extractMentions,
  isStoryActive,
  makeDmConversationId,
  makeFriendshipId,
} from '../utils/formatters';
import { deleteImageAsset } from '../services/storageService';
import { cleanData } from '../utils/cleanData';

const DEMO_SOCIAL_KEY = 'swooosh_demo_social_v3';

interface DemoSocialState {
  posts: SocialPost[];
  comments: PostComment[];
  likedIds: string[];
  savedIds: string[];
  follows: FollowEdge[];
  friendships: FriendshipEdge[];
  stories: MyDayStory[];
  viewedStoryIds: string[];
  conversations: ChatConversation[];
  demoMessagesByConv: Record<string, ChatMessage[]>;
  notifications: AppNotification[];
  blocks: UserSafetyEdge[];
  mutes: UserSafetyEdge[];
  shareLinks: ShareLink[];
}

interface SocialContextType {
  publicPosts: SocialPost[];
  friendsPosts: SocialPost[];
  myPosts: SocialPost[];
  discoverProfiles: UserProfile[];
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;
  outgoingFollows: FollowEdge[];
  incomingFollows: FollowEdge[];
  friendships: FriendshipEdge[];
  friendIds: string[];
  incomingFriendRequests: FriendshipEdge[];
  outgoingFriendRequests: FriendshipEdge[];
  storiesForFeed: MyDayStory[];
  viewedStoryIds: Set<string>;
  conversations: ChatConversation[];
  unreadMessagesCount: number;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  blockedEdges: UserSafetyEdge[];
  mutedEdges: UserSafetyEdge[];
  shareLinks: ShareLink[];
  loadingFeed: boolean;
  feedLimit: number;
  hasMorePublicPosts: boolean;

  // Demo chat helpers exposed for MessagesPage
  demoMessagesByConv: Record<string, ChatMessage[]>;
  setDemoMessagesForConv: (convId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => void;

  // Derived helpers
  isFollowing: (targetUid: string) => 'none' | 'pending' | 'accepted';
  getFriendshipState: (targetUid: string) => 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends';
  isFriend: (targetUid: string) => boolean;
  isBlocked: (targetUid: string) => boolean;
  isMuted: (targetUid: string) => boolean;
  visiblePostsForFeed: SocialPost[];
  visibleFriendsPosts: SocialPost[];

  // Feed Actions
  loadMorePublicPosts: () => void;
  refreshFeedAndProfiles: () => Promise<void>;

  // Post Actions
  publishPost: (params: {
    postType: PostType;
    caption: string;
    visibility: Visibility;
    allowRemix: boolean;
    commentPolicy: CommentPolicy;
    outfit?: Outfit;
    item?: ClothingItem;
    plannedPieces?: OutfitPieceSnapshot[];
    wardrobe: ClothingItem[];
    mediaUrl?: string;
    thumbUrl?: string;
    mediaId?: string;
    mediaUrls?: string[];
    thumbUrls?: string[];
    mediaIds?: string[];
    altText?: string;
    altTexts?: string[];
    seasons?: SeasonTag[];
    styleTags?: string[];
    occasion?: string;
    remixedFrom?: SocialPost['remixedFrom'];
  }) => Promise<SocialPost>;
  editPost: (post: SocialPost, updates: { caption: string; visibility: Visibility }) => Promise<void>;
  deletePost: (post: SocialPost) => Promise<void>;
  toggleLike: (post: SocialPost) => Promise<void>;
  toggleSave: (post: SocialPost) => Promise<void>;
  loadComments: (postId: string) => Promise<PostComment[]>;
  addComment: (
    post: SocialPost,
    text: string,
    attachment?: {
      imageUrl: string;
      thumbUrl: string;
      mediaId: string;
      altText?: string;
    },
    replyTo?: {
      id: string;
      username: string;
    }
  ) => Promise<PostComment>;
  deleteComment: (comment: PostComment) => Promise<void>;

  // Friend & Follow Actions
  sendFriendRequest: (target: UserProfile) => Promise<void>;
  acceptFriendRequest: (edge: FriendshipEdge) => Promise<void>;
  removeOrCancelFriend: (edgeOrUid: FriendshipEdge | string) => Promise<void>;
  toggleFollow: (target: UserProfile) => Promise<void>;
  approveFollowRequest: (edge: FollowEdge) => Promise<void>;
  declineFollowRequest: (edge: FollowEdge) => Promise<void>;

  // MyDay Story Actions
  createStory: (params: {
    mediaUrl: string;
    thumbUrl: string;
    mediaId?: string;
    altText: string;
    caption?: string;
    styleTag?: string;
    visibility: MyDayVisibility;
    closeFriendIds?: string[];
  }) => Promise<MyDayStory>;
  deleteStory: (story: MyDayStory) => Promise<void>;
  markStoryViewed: (story: MyDayStory) => Promise<void>;
  fetchStoryViewers: (storyId: string) => Promise<StoryView[]>;
  replyToStory: (story: MyDayStory, messageText: string) => Promise<void>;

  // Chat Actions
  startDmWithFriend: (target: UserProfile) => Promise<ChatConversation>;
  createGroupChat: (params: {
    name: string;
    memberProfiles: UserProfile[];
    photoUrl?: string;
    mediaId?: string;
  }) => Promise<ChatConversation>;
  updateGroupChat: (convId: string, updates: Partial<ChatConversation>) => Promise<void>;
  leaveConversation: (convId: string) => Promise<void>;
  sharePostToChat: (convId: string, post: SocialPost, note?: string) => Promise<void>;
  markConvRead: (convId: string) => Promise<void>;

  // Profile & Visible Data Fetching
  fetchProfileData: (target: UserProfile) => Promise<{
    posts: SocialPost[];
    wardrobe: ClothingItem[];
    outfits: Outfit[];
    stories: MyDayStory[];
  }>;

  // Notifications
  markNotifRead: (id: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;

  // Safety
  toggleBlock: (target: { uid: string; username: string; displayName?: string }) => Promise<void>;
  toggleMute: (target: { uid: string; username: string; displayName?: string }) => Promise<void>;
  reportItem: (params: {
    targetType: 'post' | 'comment' | 'user' | 'message' | 'story';
    targetId: string;
    targetOwnerId?: string;
    reason: string;
    details?: string;
  }) => Promise<void>;

  // Share Links
  createOrUpdateShareLink: (params: {
    targetType: 'lookbook' | 'outfit';
    targetId?: string;
    title: string;
    description: string;
    visibility: ShareVisibility;
    outfits: Outfit[];
    wardrobe: ClothingItem[];
  }) => Promise<ShareLink>;
  revokeShareLink: (token: string) => Promise<void>;
  fetchShareByToken: (token: string) => Promise<ShareLink | null>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export const SocialContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isDemoMode } = useAuth();

  const [publicPosts, setPublicPosts] = useState<SocialPost[]>([]);
  const [myPosts, setMyPosts] = useState<SocialPost[]>([]);
  const [friendsPosts, setFriendsPosts] = useState<SocialPost[]>([]);
  const [feedLimit, setFeedLimit] = useState(25);
  const [discoverProfiles, setDiscoverProfiles] = useState<UserProfile[]>([]);
  const [demoComments, setDemoComments] = useState<PostComment[]>(DEMO_COMMENTS);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [outgoingFollows, setOutgoingFollows] = useState<FollowEdge[]>([]);
  const [incomingFollows, setIncomingFollows] = useState<FollowEdge[]>([]);
  const [friendships, setFriendships] = useState<FriendshipEdge[]>([]);
  const [publicStories, setPublicStories] = useState<MyDayStory[]>([]);
  const [friendStories, setFriendStories] = useState<MyDayStory[]>([]);
  const [myStories, setMyStories] = useState<MyDayStory[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [blockedEdges, setBlockedEdges] = useState<UserSafetyEdge[]>([]);
  const [mutedEdges, setMutedEdges] = useState<UserSafetyEdge[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Demo chat state
  const [demoMessagesByConv, setDemoMessagesByConv] = useState<Record<string, ChatMessage[]>>({});

  const persistDemoSocial = (next: Partial<DemoSocialState>) => {
    try {
      const current: DemoSocialState = {
        posts: publicPosts,
        comments: demoComments,
        likedIds: Array.from(likedPostIds),
        savedIds: Array.from(savedPostIds),
        follows: [...outgoingFollows, ...incomingFollows],
        friendships,
        stories: [...myStories, ...publicStories],
        viewedStoryIds: Array.from(viewedStoryIds),
        conversations,
        demoMessagesByConv,
        notifications,
        blocks: blockedEdges,
        mutes: mutedEdges,
        shareLinks,
        ...next,
      };
      localStorage.setItem(DEMO_SOCIAL_KEY, JSON.stringify(current));
    } catch {
      // ignore quota
    }
  };

  useEffect(() => {
    if (!userProfile) {
      setPublicPosts([]);
      setMyPosts([]);
      setFriendsPosts([]);
      setDiscoverProfiles([]);
      setLikedPostIds(new Set());
      setSavedPostIds(new Set());
      setOutgoingFollows([]);
      setIncomingFollows([]);
      setFriendships([]);
      setPublicStories([]);
      setFriendStories([]);
      setMyStories([]);
      setViewedStoryIds(new Set());
      setConversations([]);
      setNotifications([]);
      setBlockedEdges([]);
      setMutedEdges([]);
      setShareLinks([]);
      setLoadingFeed(false);
      return;
    }

    if (isDemoMode) {
      setLoadingFeed(true);
      setDiscoverProfiles([userProfile, ...DEMO_COMMUNITY_PROFILES]);
      const raw = localStorage.getItem(DEMO_SOCIAL_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DemoSocialState;
          const allP = parsed.posts || DEMO_POSTS;
          setPublicPosts(allP);
          setMyPosts(allP.filter((p) => p.userId === userProfile.uid));
          setDemoComments(parsed.comments || DEMO_COMMENTS);
          setLikedPostIds(new Set(parsed.likedIds || []));
          setSavedPostIds(new Set(parsed.savedIds || []));
          const allF = parsed.follows || DEMO_FOLLOWS;
          setOutgoingFollows(allF.filter((f) => f.followerId === userProfile.uid));
          setIncomingFollows(allF.filter((f) => f.targetId === userProfile.uid));
          setFriendships(parsed.friendships || getDemoFriendships());
          const allS = (parsed.stories || getDemoStories()).filter((s) => isStoryActive(s.expiresAt));
          setMyStories(allS.filter((s) => s.userId === userProfile.uid));
          setPublicStories(allS.filter((s) => s.userId !== userProfile.uid));
          setViewedStoryIds(new Set(parsed.viewedStoryIds || []));
          setConversations(parsed.conversations || getDemoConversations());
          setDemoMessagesByConv(
            parsed.demoMessagesByConv || { [`dm_creator_kenji_${userProfile.uid}`]: getDemoMessages() }
          );
          setNotifications(parsed.notifications || DEMO_NOTIFICATIONS);
          setBlockedEdges(parsed.blocks || []);
          setMutedEdges(parsed.mutes || []);
          setShareLinks(parsed.shareLinks || []);
          setLoadingFeed(false);
          return;
        } catch {
          // fall through
        }
      }
      setPublicPosts(DEMO_POSTS);
      setMyPosts(DEMO_POSTS.filter((p) => p.userId === userProfile.uid));
      setDemoComments(DEMO_COMMENTS);
      setLikedPostIds(new Set());
      setSavedPostIds(new Set());
      setOutgoingFollows(DEMO_FOLLOWS.filter((f) => f.followerId === userProfile.uid));
      setIncomingFollows(DEMO_FOLLOWS.filter((f) => f.targetId === userProfile.uid));
      setFriendships(getDemoFriendships());
      const initStories = getDemoStories();
      setMyStories([]);
      setPublicStories(initStories);
      setViewedStoryIds(new Set());
      setConversations(getDemoConversations());
      setDemoMessagesByConv({ [`dm_creator_kenji_${userProfile.uid}`]: getDemoMessages() });
      setNotifications(DEMO_NOTIFICATIONS);
      setBlockedEdges([]);
      setMutedEdges([]);
      setShareLinks([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);
    const unsubPosts = subscribePublicPosts(
      (posts) => {
        setPublicPosts(posts);
        setLoadingFeed(false);
      },
      () => setLoadingFeed(false),
      feedLimit
    );
    const unsubMyPosts = subscribeMyPosts(userProfile.uid, setMyPosts);
    const unsubLikes = subscribeUserLikes(userProfile.uid, setLikedPostIds);
    const unsubSaves = subscribeUserSaves(userProfile.uid, setSavedPostIds);
    const unsubOutFollows = subscribeOutgoingFollows(userProfile.uid, setOutgoingFollows);
    const unsubInFollows = subscribeIncomingFollows(userProfile.uid, setIncomingFollows);
    const unsubFriendships = subscribeUserFriendships(userProfile.uid, setFriendships);
    const unsubPublicStories = subscribePublicStories(setPublicStories);
    const unsubMyStories = subscribeMyStories(userProfile.uid, setMyStories);
    const unsubStoryViews = subscribeMyStoryViews(userProfile.uid, setViewedStoryIds);
    const unsubConvs = subscribeUserConversations(userProfile.uid, setConversations);
    const unsubNotifs = subscribeNotifications(userProfile.uid, setNotifications);
    const unsubBlocks = subscribeBlocks(userProfile.uid, setBlockedEdges);
    const unsubMutes = subscribeMutes(userProfile.uid, setMutedEdges);
    const unsubShares = subscribeUserShareLinks(userProfile.uid, setShareLinks);

    listDiscoverableProfiles(60)
      .then((list) => setDiscoverProfiles(list))
      .catch(() => {});

    return () => {
      unsubPosts();
      unsubMyPosts();
      unsubLikes();
      unsubSaves();
      unsubOutFollows();
      unsubInFollows();
      unsubFriendships();
      unsubPublicStories();
      unsubMyStories();
      unsubStoryViews();
      unsubConvs();
      unsubNotifs();
      unsubBlocks();
      unsubMutes();
      unsubShares();
    };
  }, [userProfile?.uid, isDemoMode, feedLimit]);

  const friendIds = useMemo(() => {
    if (!userProfile) return [];
    return friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => (f.requesterId === userProfile.uid ? f.recipientId : f.requesterId));
  }, [friendships, userProfile]);

  const incomingFriendRequests = useMemo(
    () =>
      userProfile
        ? friendships.filter((f) => f.status === 'pending' && f.recipientId === userProfile.uid)
        : [],
    [friendships, userProfile]
  );

  const outgoingFriendRequests = useMemo(
    () =>
      userProfile
        ? friendships.filter((f) => f.status === 'pending' && f.requesterId === userProfile.uid)
        : [],
    [friendships, userProfile]
  );

  const acceptedFollowingIds = useMemo(
    () => outgoingFollows.filter((f) => f.status === 'accepted').map((f) => f.targetId),
    [outgoingFollows]
  );

  const loadFriendsPostsAndStories = useCallback(async () => {
    if (!userProfile) return;
    if (isDemoMode) {
      const fSet = new Set([...friendIds, ...acceptedFollowingIds, userProfile.uid]);
      setFriendsPosts(publicPosts.filter((p) => fSet.has(p.userId)));
      return;
    }
    const [fPosts, fStories] = await Promise.all([
      fetchFriendsAndFollowedPosts(friendIds, acceptedFollowingIds),
      fetchFriendStories(friendIds, userProfile.uid),
    ]);
    setFriendsPosts(fPosts);
    setFriendStories(fStories);
  }, [userProfile, isDemoMode, friendIds, acceptedFollowingIds, publicPosts]);

  useEffect(() => {
    loadFriendsPostsAndStories();
  }, [loadFriendsPostsAndStories]);

  const blockedSet = useMemo(() => new Set(blockedEdges.map((b) => b.targetId)), [blockedEdges]);
  const mutedSet = useMemo(() => new Set(mutedEdges.map((m) => m.targetId)), [mutedEdges]);

  const isFollowing = (targetUid: string): 'none' | 'pending' | 'accepted' => {
    const edge = outgoingFollows.find((f) => f.targetId === targetUid);
    return edge ? edge.status : 'none';
  };

  const getFriendshipState = (
    targetUid: string
  ): 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends' => {
    if (!userProfile) return 'none';
    const id = makeFriendshipId(userProfile.uid, targetUid);
    const edge = friendships.find((f) => f.id === id);
    if (!edge) return 'none';
    if (edge.status === 'accepted') return 'friends';
    return edge.requesterId === userProfile.uid ? 'outgoing_pending' : 'incoming_pending';
  };

  const isFriend = (targetUid: string) => getFriendshipState(targetUid) === 'friends';
  const isBlocked = (targetUid: string) => blockedSet.has(targetUid);
  const isMuted = (targetUid: string) => mutedSet.has(targetUid);

  const visiblePostsForFeed = useMemo(
    () =>
      publicPosts.filter(
        (p) => p.visibility === 'public' && !blockedSet.has(p.userId) && !mutedSet.has(p.userId)
      ),
    [publicPosts, blockedSet, mutedSet]
  );

  const visibleFriendsPosts = useMemo(() => {
    const map = new Map<string, SocialPost>();
    [...friendsPosts, ...myPosts].forEach((p) => {
      if (!blockedSet.has(p.userId) && !mutedSet.has(p.userId)) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [friendsPosts, myPosts, blockedSet, mutedSet]);

  const storiesForFeed = useMemo(() => {
    const map = new Map<string, MyDayStory>();
    const fSet = new Set([...friendIds, ...acceptedFollowingIds]);
    [...myStories, ...friendStories, ...publicStories].forEach((s) => {
      if (!isStoryActive(s.expiresAt)) return;
      if (blockedSet.has(s.userId) || mutedSet.has(s.userId)) return;
      if (s.visibility === 'friends' && s.userId !== userProfile?.uid && !friendIds.includes(s.userId)) {
        return;
      }
      if (
        s.visibility === 'close_friends' &&
        s.userId !== userProfile?.uid &&
        !(s.closeFriendIds || []).includes(userProfile?.uid || '')
      ) {
        return;
      }
      if (
        s.userId === userProfile?.uid ||
        fSet.has(s.userId) ||
        s.visibility === 'public'
      ) {
        map.set(s.id, s);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [myStories, friendStories, publicStories, blockedSet, mutedSet, friendIds, acceptedFollowingIds, userProfile?.uid]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read && n.type !== 'message').length,
    [notifications]
  );

  const unreadMessagesCount = useMemo(() => {
    if (!userProfile) return 0;
    return conversations.reduce((sum, conv) => {
      const otherIds = conv.participantIds.filter((id) => id !== userProfile.uid);
      if (conv.type === 'dm' && otherIds.some((id) => blockedSet.has(id) || mutedSet.has(id))) {
        return sum;
      }
      return sum + (conv.unreadBy?.[userProfile.uid] || 0);
    }, 0);
  }, [conversations, userProfile, blockedSet, mutedSet]);

  const loadMorePublicPosts = () => {
    setFeedLimit((prev) => prev + 25);
  };

  const refreshFeedAndProfiles = async () => {
    if (isDemoMode) return;
    const [profiles] = await Promise.all([
      listDiscoverableProfiles(60),
      loadFriendsPostsAndStories(),
    ]);
    setDiscoverProfiles(profiles);
  };

  // Build sanitized piece snapshots (respecting private piece rule!)
  const buildOutfitSnapshots = (outfit: Outfit, wardrobe: ClothingItem[]): OutfitPieceSnapshot[] => {
    const snaps: OutfitPieceSnapshot[] = [];
    const addSlot = (slot: OutfitPieceSnapshot['slot'], id?: string) => {
      if (!id) return;
      const item = wardrobe.find((w) => w.id === id);
      if (!item) return;
      const isPrivate = item.visibility === 'private';
      snaps.push({
        id: item.id,
        slot,
        name: isPrivate ? 'Private piece' : item.name,
        category: item.category,
        brand: isPrivate ? '' : item.brand || '',
        color: isPrivate ? '' : item.color || '',
        imageUrl: isPrivate ? undefined : item.thumbUrl || item.imageUrl,
        thumbUrl: isPrivate ? undefined : item.thumbUrl,
        mediaId: isPrivate ? undefined : item.mediaId,
        visibility: item.visibility,
        isPrivatePlaceholder: isPrivate,
      });
    };
    addSlot('top', outfit.topId);
    addSlot('bottom', outfit.bottomId);
    addSlot('shoes', outfit.shoesId);
    (outfit.accessoryIds || []).forEach((aid) => addSlot('accessory', aid));
    return snaps;
  };

  const notifyMentions = async (mentions: string[], targetId: string, preview: string) => {
    if (!userProfile || isDemoMode || mentions.length === 0) return;
    for (const uname of mentions.slice(0, 5)) {
      const target = discoverProfiles.find((p) => p.usernameLower === uname.toLowerCase());
      if (target && target.uid !== userProfile.uid && !blockedSet.has(target.uid)) {
        await createNotification(
          cleanData({
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            recipientId: target.uid,
            actorId: userProfile.uid,
            actorUsername: userProfile.username,
            actorName: userProfile.displayName,
            actorPhotoUrl: userProfile.photoURL,
            type: 'mention',
            targetId,
            targetPreview: preview.slice(0, 80),
            read: false,
            createdAt: new Date().toISOString(),
          })
        );
      }
    }
  };

  const publishPost: SocialContextType['publishPost'] = async (params) => {
    if (!userProfile) throw new Error('Sign in to publish posts.');
    const safety = checkTextSafety(params.caption);
    if (!safety.ok) throw new Error(safety.reason || 'Post text failed safety check.');

    let piecesPreview: OutfitPieceSnapshot[] | undefined = params.plannedPieces;
    let mediaUrl = params.mediaUrl;
    let thumbUrl = params.thumbUrl;
    let mediaId = params.mediaId;
    let altText = params.altText;

    if (params.outfit) {
      piecesPreview = buildOutfitSnapshots(params.outfit, params.wardrobe);
      if (!mediaUrl) {
        const firstVisible = piecesPreview.find((p) => !p.isPrivatePlaceholder && p.imageUrl);
        mediaUrl = params.outfit.coverImageUrl || firstVisible?.imageUrl;
        thumbUrl = firstVisible?.thumbUrl || mediaUrl;
        mediaId = params.outfit.mediaId || firstVisible?.mediaId;
      }
      if (!altText) {
        altText = `${params.outfit.name} — ${params.outfit.styleCategory} outfit`;
      }
    } else if (params.item) {
      const isPriv = params.item.visibility === 'private';
      piecesPreview = [
        {
          id: params.item.id,
          slot: 'top',
          name: isPriv ? 'Private piece' : params.item.name,
          category: params.item.category,
          brand: isPriv ? '' : params.item.brand || '',
          color: isPriv ? '' : params.item.color || '',
          imageUrl: isPriv ? undefined : params.item.thumbUrl || params.item.imageUrl,
          thumbUrl: isPriv ? undefined : params.item.thumbUrl,
          mediaId: isPriv ? undefined : params.item.mediaId,
          visibility: params.item.visibility,
          isPrivatePlaceholder: isPriv,
        },
      ];
      if (!mediaUrl && !isPriv) {
        mediaUrl = params.item.imageUrl;
        thumbUrl = params.item.thumbUrl || params.item.imageUrl;
        mediaId = params.item.mediaId;
      }
      if (!altText) altText = params.item.altText;
    }

    const mediaUrls = params.mediaUrls?.length ? params.mediaUrls.slice(0, 4) : mediaUrl ? [mediaUrl] : undefined;
    const thumbUrls = params.thumbUrls?.length ? params.thumbUrls.slice(0, 4) : thumbUrl ? [thumbUrl] : undefined;
    const mediaIds = params.mediaIds?.length ? params.mediaIds.slice(0, 4) : mediaId ? [mediaId] : undefined;
    const mentions = extractMentions(params.caption);

    const post: SocialPost = cleanData({
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: userProfile.uid,
      authorName: userProfile.displayName,
      authorUsername: userProfile.username,
      authorPhotoUrl: userProfile.photoURL,
      postType: params.postType,
      caption: params.caption.trim(),
      hashtags: extractHashtags(params.caption),
      mentions,
      outfitId: params.outfit?.id,
      itemId: params.item?.id,
      mediaUrl: mediaUrls?.[0] || mediaUrl,
      thumbUrl: thumbUrls?.[0] || thumbUrl,
      mediaId: mediaIds?.[0] || mediaId,
      mediaUrls,
      thumbUrls,
      mediaIds,
      altText: altText || 'Fashion fit post',
      altTexts: params.altTexts,
      seasons: params.seasons || params.outfit?.seasons,
      piecesPreview,
      styleTags: params.styleTags || (params.outfit ? [params.outfit.styleCategory] : ['Streetwear']),
      occasion: params.occasion || params.outfit?.occasion,
      visibility: params.visibility,
      allowRemix: params.allowRemix,
      commentPolicy: params.commentPolicy,
      remixedFrom: params.remixedFrom,
      likesCount: 0,
      commentsCount: 0,
      savesCount: 0,
      remixesCount: 0,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextPosts = [post, ...publicPosts];
      setPublicPosts(nextPosts);
      setMyPosts(nextPosts.filter((p) => p.userId === userProfile.uid));
      persistDemoSocial({ posts: nextPosts });
    } else {
      await createSocialPost(post);
      if (params.remixedFrom?.userId && params.remixedFrom.userId !== userProfile.uid) {
        await createNotification(
          cleanData({
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            recipientId: params.remixedFrom.userId,
            actorId: userProfile.uid,
            actorUsername: userProfile.username,
            actorName: userProfile.displayName,
            actorPhotoUrl: userProfile.photoURL,
            type: 'remix',
            targetId: post.id,
            targetPreview: (post.caption || '').slice(0, 80),
            read: false,
            createdAt: new Date().toISOString(),
          })
        );
      }
      await notifyMentions(mentions, post.id, post.caption || '');
    }
    return post;
  };

  const editPost: SocialContextType['editPost'] = async (post, updates) => {
    if (!userProfile || post.userId !== userProfile.uid) return;
    const safety = checkTextSafety(updates.caption);
    if (!safety.ok) throw new Error(safety.reason || 'Caption blocked.');
    const now = new Date().toISOString();
    const patch = {
      caption: updates.caption.trim(),
      visibility: updates.visibility,
      hashtags: extractHashtags(updates.caption),
      mentions: extractMentions(updates.caption),
      editedAt: now,
    };
    if (isDemoMode) {
      const next = publicPosts.map((p) => (p.id === post.id ? { ...p, ...patch } : p));
      setPublicPosts(next);
      setMyPosts(next.filter((p) => p.userId === userProfile.uid));
      persistDemoSocial({ posts: next });
      return;
    }
    await updateSocialPost(post.id, patch);
    setFriendsPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...patch } : p)));
  };

  const deletePost = async (post: SocialPost) => {
    if (!userProfile || post.userId !== userProfile.uid) return;
    const idsToDelete = post.mediaIds || (post.mediaId ? [post.mediaId] : []);
    if (!post.itemId && !post.outfitId) {
      idsToDelete.forEach((mid) => deleteImageAsset(mid).catch(() => {}));
    }
    if (isDemoMode) {
      const nextPosts = publicPosts.filter((p) => p.id !== post.id);
      setPublicPosts(nextPosts);
      setMyPosts(nextPosts.filter((p) => p.userId === userProfile.uid));
      persistDemoSocial({ posts: nextPosts });
    } else {
      await deleteSocialPost(post.id, userProfile.uid);
      setFriendsPosts((prev) => prev.filter((p) => p.id !== post.id));
    }
  };

  const toggleLike = async (post: SocialPost) => {
    if (!userProfile) return;
    const currentlyLiked = likedPostIds.has(post.id);
    if (isDemoMode) {
      const nextLiked = new Set(likedPostIds);
      if (currentlyLiked) nextLiked.delete(post.id);
      else nextLiked.add(post.id);
      const nextPosts = publicPosts.map((p) =>
        p.id === post.id
          ? { ...p, likesCount: Math.max(0, p.likesCount + (currentlyLiked ? -1 : 1)) }
          : p
      );
      setLikedPostIds(nextLiked);
      setPublicPosts(nextPosts);
      persistDemoSocial({ likedIds: Array.from(nextLiked), posts: nextPosts });
      return;
    }

    await togglePostLikeFirestore(post.id, userProfile.uid, currentlyLiked);
    if (!currentlyLiked && post.userId !== userProfile.uid) {
      await createNotification(
        cleanData({
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipientId: post.userId,
          actorId: userProfile.uid,
          actorUsername: userProfile.username,
          actorName: userProfile.displayName,
          actorPhotoUrl: userProfile.photoURL,
          type: 'like',
          targetId: post.id,
          targetPreview: (post.caption || '').slice(0, 70),
          read: false,
          createdAt: new Date().toISOString(),
        })
      );
    }
  };

  const toggleSave = async (post: SocialPost) => {
    if (!userProfile) return;
    const currentlySaved = savedPostIds.has(post.id);
    if (isDemoMode) {
      const nextSaved = new Set(savedPostIds);
      if (currentlySaved) nextSaved.delete(post.id);
      else nextSaved.add(post.id);
      const nextPosts = publicPosts.map((p) =>
        p.id === post.id
          ? { ...p, savesCount: Math.max(0, p.savesCount + (currentlySaved ? -1 : 1)) }
          : p
      );
      setSavedPostIds(nextSaved);
      setPublicPosts(nextPosts);
      persistDemoSocial({ savedIds: Array.from(nextSaved), posts: nextPosts });
      return;
    }

    await togglePostSaveFirestore(post.id, post.userId, userProfile.uid, currentlySaved);
  };

  const loadComments = async (postId: string): Promise<PostComment[]> => {
    if (isDemoMode) {
      return demoComments
        .filter((c) => c.postId === postId && !blockedSet.has(c.userId))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    const list = await getCommentsForPost(postId);
    return list.filter((c) => !blockedSet.has(c.userId));
  };

  const addComment: SocialContextType['addComment'] = async (
    post,
    text,
    attachment,
    replyTo
  ) => {
    if (!userProfile) throw new Error('Sign in to comment.');
    if (post.commentPolicy === 'off' && post.userId !== userProfile.uid) {
      throw new Error('Comments are turned off for this post.');
    }
    if (
      (post.commentPolicy === 'followers' || post.commentPolicy === 'friends') &&
      post.userId !== userProfile.uid &&
      !isFriend(post.userId) &&
      isFollowing(post.userId) !== 'accepted'
    ) {
      throw new Error('Only friends or followers can comment on this post.');
    }
    const trimmed = text.trim() || (attachment ? 'Shared a style photo' : '');
    if (!trimmed) throw new Error('Comment cannot be empty.');
    const safety = checkTextSafety(trimmed);
    if (!safety.ok) throw new Error(safety.reason || 'Comment blocked.');
    const mentions = extractMentions(trimmed);

    const comment: PostComment = cleanData({
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      postId: post.id,
      postAuthorId: post.userId,
      userId: userProfile.uid,
      authorUsername: userProfile.username,
      authorName: userProfile.displayName,
      authorPhotoUrl: userProfile.photoURL,
      text: trimmed,
      ...(replyTo ? { replyToId: replyTo.id, replyToUsername: replyTo.username } : {}),
      ...(attachment
        ? {
            imageUrl: attachment.imageUrl,
            thumbUrl: attachment.thumbUrl,
            mediaId: attachment.mediaId,
            altText: attachment.altText || 'Comment image attachment',
          }
        : {}),
      mentions,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextComments = [...demoComments, comment];
      const nextPosts = publicPosts.map((p) =>
        p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p
      );
      setDemoComments(nextComments);
      setPublicPosts(nextPosts);
      persistDemoSocial({ comments: nextComments, posts: nextPosts });
      return comment;
    }

    await addCommentFirestore(comment);
    if (post.userId !== userProfile.uid) {
      await createNotification(
        cleanData({
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipientId: post.userId,
          actorId: userProfile.uid,
          actorUsername: userProfile.username,
          actorName: userProfile.displayName,
          actorPhotoUrl: userProfile.photoURL,
          type: 'comment',
          targetId: post.id,
          targetPreview: trimmed.slice(0, 80),
          read: false,
          createdAt: new Date().toISOString(),
        })
      );
    }
    await notifyMentions(mentions, post.id, trimmed);
    return comment;
  };

  const deleteComment = async (comment: PostComment) => {
    if (!userProfile) return;
    if (comment.userId !== userProfile.uid && comment.postAuthorId !== userProfile.uid) return;
    if (comment.mediaId) {
      deleteImageAsset(comment.mediaId).catch(() => {});
    }
    if (isDemoMode) {
      const nextComments = demoComments.filter((c) => c.id !== comment.id);
      const nextPosts = publicPosts.map((p) =>
        p.id === comment.postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
      );
      setDemoComments(nextComments);
      setPublicPosts(nextPosts);
      persistDemoSocial({ comments: nextComments, posts: nextPosts });
      return;
    }
    await deleteCommentFirestore(comment.id, comment.postId);
  };

  // ========================
  // FRIENDSHIPS
  // ========================

  const sendFriendRequest = async (target: UserProfile) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    if (blockedSet.has(target.uid)) throw new Error('Unblock this user first to add them as a friend.');
    const edgeId = makeFriendshipId(userProfile.uid, target.uid);
    const existing = friendships.find((f) => f.id === edgeId);
    if (existing) {
      if (existing.status === 'pending' && existing.recipientId === userProfile.uid) {
        await acceptFriendRequest(existing);
      }
      return;
    }
    const usersPair: [string, string] =
      userProfile.uid < target.uid ? [userProfile.uid, target.uid] : [target.uid, userProfile.uid];

    const edge: FriendshipEdge = cleanData({
      id: edgeId,
      users: usersPair,
      requesterId: userProfile.uid,
      requesterUsername: userProfile.username,
      requesterName: userProfile.displayName,
      requesterPhotoUrl: userProfile.photoURL,
      recipientId: target.uid,
      recipientUsername: target.username,
      recipientName: target.displayName,
      recipientPhotoUrl: target.photoURL,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const next = [edge, ...friendships];
      setFriendships(next);
      persistDemoSocial({ friendships: next });
      return;
    }

    await sendFriendRequestFirestore(edge);
    await createNotification(
      cleanData({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientId: target.uid,
        actorId: userProfile.uid,
        actorUsername: userProfile.username,
        actorName: userProfile.displayName,
        actorPhotoUrl: userProfile.photoURL,
        type: 'friend_request',
        targetId: userProfile.uid,
        targetPreview: 'Sent you a friend request',
        read: false,
        createdAt: new Date().toISOString(),
      })
    );
  };

  const acceptFriendRequest = async (edge: FriendshipEdge) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const next = friendships.map((f) =>
        f.id === edge.id ? { ...f, status: 'accepted' as const, updatedAt: new Date().toISOString() } : f
      );
      setFriendships(next);
      persistDemoSocial({ friendships: next });
      return;
    }
    await acceptFriendRequestFirestore(edge);
    await createNotification(
      cleanData({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientId: edge.requesterId,
        actorId: userProfile.uid,
        actorUsername: userProfile.username,
        actorName: userProfile.displayName,
        actorPhotoUrl: userProfile.photoURL,
        type: 'friend_accept',
        targetId: userProfile.uid,
        targetPreview: 'Accepted your friend request',
        read: false,
        createdAt: new Date().toISOString(),
      })
    );
  };

  const removeOrCancelFriend = async (edgeOrUid: FriendshipEdge | string) => {
    if (!userProfile) return;
    const edge =
      typeof edgeOrUid === 'string'
        ? friendships.find((f) => f.id === makeFriendshipId(userProfile.uid, edgeOrUid))
        : edgeOrUid;
    if (!edge) return;
    if (isDemoMode) {
      const next = friendships.filter((f) => f.id !== edge.id);
      setFriendships(next);
      persistDemoSocial({ friendships: next });
      return;
    }
    await removeFriendshipFirestore(edge);
  };

  // ========================
  // FOLLOWS
  // ========================

  const toggleFollow = async (target: UserProfile) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = outgoingFollows.find((f) => f.targetId === target.uid);

    if (existing) {
      if (isDemoMode) {
        const nextOut = outgoingFollows.filter((f) => f.id !== existing.id);
        setOutgoingFollows(nextOut);
        persistDemoSocial({ follows: [...nextOut, ...incomingFollows] });
      } else {
        await removeFollowEdge(existing);
      }
      return;
    }

    const edge: FollowEdge = cleanData({
      id: `${userProfile.uid}_${target.uid}`,
      followerId: userProfile.uid,
      followerUsername: userProfile.username,
      followerName: userProfile.displayName,
      followerPhotoUrl: userProfile.photoURL,
      targetId: target.uid,
      targetUsername: target.username,
      targetName: target.displayName,
      status: target.isPublic ? 'accepted' : 'pending',
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextOut = [...outgoingFollows, edge];
      setOutgoingFollows(nextOut);
      persistDemoSocial({ follows: [...nextOut, ...incomingFollows] });
    } else {
      await saveFollowEdge(edge);
      await createNotification(
        cleanData({
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipientId: target.uid,
          actorId: userProfile.uid,
          actorUsername: userProfile.username,
          actorName: userProfile.displayName,
          actorPhotoUrl: userProfile.photoURL,
          type: edge.status === 'pending' ? 'follow_request' : 'follow',
          targetId: userProfile.uid,
          targetPreview: edge.status === 'pending' ? 'Requested to follow you' : 'Started following you',
          read: false,
          createdAt: new Date().toISOString(),
        })
      );
    }
  };

  const approveFollowRequest = async (edge: FollowEdge) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const nextIn = incomingFollows.map((f) =>
        f.id === edge.id ? { ...f, status: 'accepted' as const } : f
      );
      setIncomingFollows(nextIn);
      persistDemoSocial({ follows: [...outgoingFollows, ...nextIn] });
      return;
    }
    await acceptFollowEdge(edge);
    await createNotification(
      cleanData({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientId: edge.followerId,
        actorId: userProfile.uid,
        actorUsername: userProfile.username,
        actorName: userProfile.displayName,
        actorPhotoUrl: userProfile.photoURL,
        type: 'follow_accept',
        targetId: userProfile.uid,
        targetPreview: 'Accepted your follow request',
        read: false,
        createdAt: new Date().toISOString(),
      })
    );
  };

  const declineFollowRequest = async (edge: FollowEdge) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const nextIn = incomingFollows.filter((f) => f.id !== edge.id);
      setIncomingFollows(nextIn);
      persistDemoSocial({ follows: [...outgoingFollows, ...nextIn] });
      return;
    }
    await removeFollowEdge(edge);
  };

  // ========================
  // MYDAY (24-HOUR STORIES)
  // ========================

  const createStory: SocialContextType['createStory'] = async (params) => {
    if (!userProfile) throw new Error('Sign in to post a MyDay.');
    if (params.caption) {
      const safety = checkTextSafety(params.caption, 220);
      if (!safety.ok) throw new Error(safety.reason || 'Caption failed safety check.');
    }
    const now = Date.now();
    const story: MyDayStory = cleanData({
      id: `story_${now}_${Math.random().toString(36).slice(2, 7)}`,
      userId: userProfile.uid,
      authorName: userProfile.displayName,
      authorUsername: userProfile.username,
      authorPhotoUrl: userProfile.photoURL,
      mediaUrl: params.mediaUrl,
      thumbUrl: params.thumbUrl,
      mediaId: params.mediaId,
      altText: params.altText.trim() || `${userProfile.displayName}'s MyDay fit`,
      caption: params.caption?.trim() || undefined,
      styleTag: params.styleTag,
      visibility: params.visibility,
      closeFriendIds:
        params.visibility === 'close_friends' ? params.closeFriendIds || friendIds : undefined,
      viewCount: 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (isDemoMode) {
      const nextMy = [...myStories, story];
      setMyStories(nextMy);
      persistDemoSocial({ stories: [...nextMy, ...publicStories] });
      return story;
    }

    await createMyDayStory(story);
    return story;
  };

  const deleteStory = async (story: MyDayStory) => {
    if (!userProfile || story.userId !== userProfile.uid) return;
    if (story.mediaId) {
      deleteImageAsset(story.mediaId).catch(() => {});
    }
    if (isDemoMode) {
      const nextMy = myStories.filter((s) => s.id !== story.id);
      setMyStories(nextMy);
      persistDemoSocial({ stories: [...nextMy, ...publicStories] });
      return;
    }
    await deleteMyDayStory(story.id);
  };

  const markStoryViewed = async (story: MyDayStory) => {
    if (!userProfile || story.userId === userProfile.uid) return;
    if (viewedStoryIds.has(story.id)) return;
    const nextViewed = new Set(viewedStoryIds);
    nextViewed.add(story.id);
    setViewedStoryIds(nextViewed);

    if (isDemoMode) {
      persistDemoSocial({ viewedStoryIds: Array.from(nextViewed) });
      return;
    }

    await recordStoryViewFirestore(
      cleanData({
        id: `${story.id}_${userProfile.uid}`,
        storyId: story.id,
        storyOwnerId: story.userId,
        viewerId: userProfile.uid,
        viewerUsername: userProfile.username,
        viewerName: userProfile.displayName,
        viewerPhotoUrl: userProfile.photoURL,
        viewedAt: new Date().toISOString(),
      })
    );
  };

  const fetchStoryViewers = async (storyId: string): Promise<StoryView[]> => {
    if (isDemoMode) {
      return [
        {
          id: `${storyId}_creator_kenji`,
          storyId,
          storyOwnerId: userProfile?.uid || '',
          viewerId: 'creator_kenji',
          viewerUsername: 'kenji.studio',
          viewerName: 'Kenji Takahashi',
          viewedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
        },
      ];
    }
    return getStoryViewers(storyId);
  };

  const replyToStory = async (story: MyDayStory, messageText: string) => {
    if (!userProfile || story.userId === userProfile.uid) return;
    if (blockedSet.has(story.userId)) throw new Error('Cannot message a blocked user.');
    if (!isFriend(story.userId)) {
      throw new Error('Add them as a friend first to send a direct MyDay reply.');
    }
    const safety = checkTextSafety(messageText, 1000);
    if (!safety.ok) throw new Error(safety.reason || 'Reply blocked.');
    const rate = checkMessageRateLimit(userProfile.uid, 20);
    if (!rate.ok) throw new Error(rate.reason);

    const targetProfile = discoverProfiles.find((p) => p.uid === story.userId) || {
      uid: story.userId,
      username: story.authorUsername,
      displayName: story.authorName,
      photoURL: story.authorPhotoUrl,
    };

    const convId = makeDmConversationId(userProfile.uid, story.userId);
    const mePart: ChatParticipantProfile = cleanData({
      uid: userProfile.uid,
      username: userProfile.username,
      displayName: userProfile.displayName,
      photoUrl: userProfile.photoURL,
    });
    const otherPart: ChatParticipantProfile = cleanData({
      uid: targetProfile.uid,
      username: targetProfile.username,
      displayName: targetProfile.displayName,
      photoUrl: targetProfile.photoURL,
    });

    const msg: ChatMessage = cleanData({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId: convId,
      senderId: userProfile.uid,
      senderName: userProfile.displayName,
      senderUsername: userProfile.username,
      senderPhotoUrl: userProfile.photoURL,
      text: messageText.trim(),
      storyReplyId: story.id,
      storyReplyCaption: story.caption || 'MyDay fit',
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      let existingConv = conversations.find((c) => c.id === convId);
      if (!existingConv) {
        existingConv = {
          id: convId,
          type: 'dm',
          participantIds: [userProfile.uid, targetProfile.uid].sort(),
          participantProfiles: { [mePart.uid]: mePart, [otherPart.uid]: otherPart },
          createdBy: userProfile.uid,
          unreadBy: {},
          createdAt: msg.createdAt,
        };
      }
      const nextConvs = [
        {
          ...existingConv,
          lastMessageText: `MyDay reply: ${msg.text}`.slice(0, 90),
          lastMessageAt: msg.createdAt,
          lastSenderId: userProfile.uid,
        },
        ...conversations.filter((c) => c.id !== convId),
      ];
      const nextMsgs = {
        ...demoMessagesByConv,
        [convId]: [...(demoMessagesByConv[convId] || []), msg],
      };
      setConversations(nextConvs);
      setDemoMessagesByConv(nextMsgs);
      persistDemoSocial({ conversations: nextConvs, demoMessagesByConv: nextMsgs });
      return;
    }

    const conv = await getOrCreateDmConversation(convId, mePart, otherPart);
    await sendConversationMessageFirestore(conv, msg);
    await createNotification(
      cleanData({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientId: story.userId,
        actorId: userProfile.uid,
        actorUsername: userProfile.username,
        actorName: userProfile.displayName,
        actorPhotoUrl: userProfile.photoURL,
        type: 'story_reply',
        targetId: convId,
        targetPreview: messageText.trim().slice(0, 80),
        read: false,
        createdAt: new Date().toISOString(),
      })
    );
  };

  // ========================
  // CHAT (DMs, GROUPS & ROOMS)
  // ========================

  const startDmWithFriend = async (target: UserProfile): Promise<ChatConversation> => {
    if (!userProfile) throw new Error('Sign in to message.');
    if (blockedSet.has(target.uid)) throw new Error('Unblock this user before messaging.');
    if (!isFriend(target.uid)) {
      throw new Error('Direct messages are friends-only. Send a friend request first.');
    }

    const convId = makeDmConversationId(userProfile.uid, target.uid);
    const mePart: ChatParticipantProfile = cleanData({
      uid: userProfile.uid,
      username: userProfile.username,
      displayName: userProfile.displayName,
      photoUrl: userProfile.photoURL,
    });
    const otherPart: ChatParticipantProfile = cleanData({
      uid: target.uid,
      username: target.username,
      displayName: target.displayName,
      photoUrl: target.photoURL,
    });

    if (isDemoMode) {
      const existing = conversations.find((c) => c.id === convId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const created: ChatConversation = {
        id: convId,
        type: 'dm',
        participantIds: [userProfile.uid, target.uid].sort(),
        participantProfiles: { [mePart.uid]: mePart, [otherPart.uid]: otherPart },
        createdBy: userProfile.uid,
        unreadBy: { [userProfile.uid]: 0, [target.uid]: 0 },
        lastReadAt: { [userProfile.uid]: now },
        createdAt: now,
        updatedAt: now,
      };
      const next = [created, ...conversations];
      setConversations(next);
      persistDemoSocial({ conversations: next });
      return created;
    }

    return getOrCreateDmConversation(convId, mePart, otherPart);
  };

  const createGroupChat: SocialContextType['createGroupChat'] = async (params) => {
    if (!userProfile) throw new Error('Sign in required.');
    const cleanName = params.name.trim();
    if (!cleanName) throw new Error('Group chat needs a name.');
    const safety = checkTextSafety(cleanName, 60);
    if (!safety.ok) throw new Error(safety.reason || 'Invalid group name.');

    const participants = [
      userProfile,
      ...params.memberProfiles.filter((m) => m.uid !== userProfile.uid && !blockedSet.has(m.uid)),
    ].slice(0, 25);

    const participantProfiles: Record<string, ChatParticipantProfile> = {};
    const unreadBy: Record<string, number> = {};
    participants.forEach((p) => {
      participantProfiles[p.uid] = cleanData({
        uid: p.uid,
        username: p.username,
        displayName: p.displayName,
        photoUrl: p.photoURL,
      });
      unreadBy[p.uid] = 0;
    });

    const now = new Date().toISOString();
    const conv: ChatConversation = cleanData({
      id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'group',
      name: cleanName,
      photoUrl: params.photoUrl,
      mediaId: params.mediaId,
      participantIds: participants.map((p) => p.uid),
      participantProfiles,
      adminIds: [userProfile.uid],
      createdBy: userProfile.uid,
      unreadBy,
      lastReadAt: { [userProfile.uid]: now },
      createdAt: now,
      updatedAt: now,
    });

    if (isDemoMode) {
      const next = [conv, ...conversations];
      setConversations(next);
      persistDemoSocial({ conversations: next });
      return conv;
    }

    await createGroupConversation(conv);
    return conv;
  };

  const updateGroupChat = async (convId: string, updates: Partial<ChatConversation>) => {
    const safeUpdates = cleanData(updates);
    if (isDemoMode) {
      const next = conversations.map((c) => (c.id === convId ? { ...c, ...safeUpdates } : c));
      setConversations(next);
      persistDemoSocial({ conversations: next });
      return;
    }
    await updateGroupConversation(convId, safeUpdates);
  };

  const leaveConversation = async (convId: string) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const next = conversations.filter((c) => c.id !== convId);
      setConversations(next);
      persistDemoSocial({ conversations: next });
      return;
    }
    await leaveConversationFirestore(convId, userProfile.uid);
  };

  const sharePostToChat = async (convId: string, post: SocialPost, note?: string) => {
    if (!userProfile) throw new Error('Sign in required.');
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) throw new Error('Conversation not found.');
    const text = note?.trim() || `Shared @${post.authorUsername}'s fit`;
    const safety = checkTextSafety(text, 1000);
    if (!safety.ok) throw new Error(safety.reason);
    const rate = checkMessageRateLimit(userProfile.uid, 20);
    if (!rate.ok) throw new Error(rate.reason);

    const msg: ChatMessage = cleanData({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId: conv.id,
      senderId: userProfile.uid,
      senderName: userProfile.displayName,
      senderUsername: userProfile.username,
      senderPhotoUrl: userProfile.photoURL,
      text,
      sharedPostId: post.id,
      sharedPostPreview: {
        authorUsername: post.authorUsername,
        caption: (post.caption || '').slice(0, 120),
        mediaUrl: post.thumbUrl || post.mediaUrl,
      },
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextMsgs = {
        ...demoMessagesByConv,
        [conv.id]: [...(demoMessagesByConv[conv.id] || []), msg],
      };
      const nextConvs = conversations.map((c) =>
        c.id === conv.id ? { ...c, lastMessageText: text, lastMessageAt: msg.createdAt } : c
      );
      setDemoMessagesByConv(nextMsgs);
      setConversations(nextConvs);
      persistDemoSocial({ demoMessagesByConv: nextMsgs, conversations: nextConvs });
      return;
    }

    await sendConversationMessageFirestore(conv, msg);
  };

  const markConvRead = async (convId: string) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const next = conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              unreadBy: { ...(c.unreadBy || {}), [userProfile.uid]: 0 },
              lastReadAt: { ...(c.lastReadAt || {}), [userProfile.uid]: new Date().toISOString() },
            }
          : c
      );
      setConversations(next);
      persistDemoSocial({ conversations: next });
      return;
    }
    await markConversationReadFirestore(convId, userProfile.uid);
  };

  // ========================
  // PROFILE VIEW DATA
  // ========================

  const fetchProfileData: SocialContextType['fetchProfileData'] = async (target) => {
    if (!userProfile) return { posts: [], wardrobe: [], outfits: [], stories: [] };
    const isOwner = target.uid === userProfile.uid;
    const friend = isFriend(target.uid);
    const follower = isFollowing(target.uid) === 'accepted';
    if (!target.isPublic && !isOwner && !friend && !follower) {
      return { posts: [], wardrobe: [], outfits: [], stories: [] };
    }
    if (isDemoMode) {
      const posts = publicPosts.filter((p) => p.userId === target.uid);
      const stories = storiesForFeed.filter((s) => s.userId === target.uid);
      return { posts, wardrobe: [], outfits: [], stories };
    }
    const [posts, wardrobe, outfits, stories] = await Promise.all([
      getUserPosts(target.uid, isOwner, friend, follower),
      getVisibleWardrobeForUser(target.uid, friend, follower),
      getVisibleOutfitsForUser(target.uid, friend, follower),
      getUserActiveStories(target.uid, isOwner, friend, userProfile.uid),
    ]);
    return { posts, wardrobe, outfits, stories };
  };

  // ========================
  // NOTIFICATIONS & SAFETY
  // ========================

  const markNotifRead = async (id: string) => {
    if (isDemoMode) {
      const nextN = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      setNotifications(nextN);
      persistDemoSocial({ notifications: nextN });
      return;
    }
    await markNotificationRead(id);
  };

  const markAllNotifsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    if (isDemoMode) {
      const nextN = notifications.map((n) => ({ ...n, read: true }));
      setNotifications(nextN);
      persistDemoSocial({ notifications: nextN });
      return;
    }
    await markAllNotificationsRead(unreadIds);
  };

  const toggleBlock = async (target: { uid: string; username: string; displayName?: string }) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = blockedEdges.find((b) => b.targetId === target.uid);
    const edge: UserSafetyEdge = existing || cleanData({
      id: `${userProfile.uid}_${target.uid}`,
      userId: userProfile.uid,
      targetId: target.uid,
      targetUsername: target.username,
      targetName: target.displayName,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextBlocks = existing
        ? blockedEdges.filter((b) => b.targetId !== target.uid)
        : [...blockedEdges, edge];
      setBlockedEdges(nextBlocks);
      persistDemoSocial({ blocks: nextBlocks });
      return;
    }
    await toggleBlockUser(edge, Boolean(existing));
  };

  const toggleMute = async (target: { uid: string; username: string; displayName?: string }) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = mutedEdges.find((m) => m.targetId === target.uid);
    const edge: UserSafetyEdge = existing || cleanData({
      id: `${userProfile.uid}_${target.uid}`,
      userId: userProfile.uid,
      targetId: target.uid,
      targetUsername: target.username,
      targetName: target.displayName,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextMutes = existing
        ? mutedEdges.filter((m) => m.targetId !== target.uid)
        : [...mutedEdges, edge];
      setMutedEdges(nextMutes);
      persistDemoSocial({ mutes: nextMutes });
      return;
    }
    await toggleMuteUser(edge, Boolean(existing));
  };

  const reportItem: SocialContextType['reportItem'] = async (params) => {
    if (!userProfile) return;
    if (isDemoMode) return;
    await submitReport(
      cleanData({
        id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        reporterId: userProfile.uid,
        targetType: params.targetType,
        targetId: params.targetId,
        targetOwnerId: params.targetOwnerId,
        reason: params.reason,
        details: params.details,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      })
    );
  };

  // ========================
  // SHARE LINKS
  // ========================

  const createOrUpdateShareLink: SocialContextType['createOrUpdateShareLink'] = async (params) => {
    if (!userProfile) throw new Error('Sign in required.');
    const token = `sw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const snapshots = params.outfits
      .filter((o) => o.visibility !== 'private')
      .map((o) => ({
        id: o.id,
        name: o.name,
        styleCategory: o.styleCategory,
        occasion: o.occasion,
        description: o.description,
        coverImageUrl: o.coverImageUrl,
        pieces: buildOutfitSnapshots(o, params.wardrobe),
      }));

    const link: ShareLink = cleanData({
      token,
      userId: userProfile.uid,
      targetType: params.targetType,
      targetId: params.targetId,
      title: params.title,
      description: params.description,
      previewImageUrl:
        snapshots[0]?.coverImageUrl ||
        snapshots[0]?.pieces.find((p) => !p.isPrivatePlaceholder)?.imageUrl,
      authorUsername: userProfile.username,
      authorName: userProfile.displayName,
      visibility: params.visibility,
      outfitsSnapshot: snapshots,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextLinks = [link, ...shareLinks];
      setShareLinks(nextLinks);
      persistDemoSocial({ shareLinks: nextLinks });
      return link;
    }

    await saveShareLink(link);
    return link;
  };

  const revokeShareLink = async (token: string) => {
    if (isDemoMode) {
      const nextLinks = shareLinks.map((s) =>
        s.token === token ? { ...s, visibility: 'revoked' as ShareVisibility } : s
      );
      setShareLinks(nextLinks);
      persistDemoSocial({ shareLinks: nextLinks });
      return;
    }
    await updateShareLink(token, { visibility: 'revoked' });
  };

  const fetchShareByToken = async (token: string): Promise<ShareLink | null> => {
    const localHit = shareLinks.find((s) => s.token === token && s.visibility !== 'revoked');
    if (localHit) return localHit;
    try {
      return await getShareLinkByToken(token);
    } catch {
      return null;
    }
  };

  const setDemoMessagesForConv = (
    convId: string,
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => {
    setDemoMessagesByConv((prev) => {
      const next = { ...prev, [convId]: updater(prev[convId] || []) };
      persistDemoSocial({ demoMessagesByConv: next });
      return next;
    });
  };

  return (
    <SocialContext.Provider
      value={{
        publicPosts,
        friendsPosts,
        myPosts,
        discoverProfiles,
        likedPostIds,
        savedPostIds,
        outgoingFollows,
        incomingFollows,
        friendships,
        friendIds,
        incomingFriendRequests,
        outgoingFriendRequests,
        storiesForFeed,
        viewedStoryIds,
        conversations,
        unreadMessagesCount,
        notifications,
        unreadNotificationsCount,
        blockedEdges,
        mutedEdges,
        shareLinks,
        loadingFeed,
        feedLimit,
        hasMorePublicPosts: publicPosts.length >= feedLimit,
        demoMessagesByConv,
        setDemoMessagesForConv,
        isFollowing,
        getFriendshipState,
        isFriend,
        isBlocked,
        isMuted,
        visiblePostsForFeed,
        visibleFriendsPosts,
        loadMorePublicPosts,
        refreshFeedAndProfiles,
        publishPost,
        editPost,
        deletePost,
        toggleLike,
        toggleSave,
        loadComments,
        addComment,
        deleteComment,
        sendFriendRequest,
        acceptFriendRequest,
        removeOrCancelFriend,
        toggleFollow,
        approveFollowRequest,
        declineFollowRequest,
        createStory,
        deleteStory,
        markStoryViewed,
        fetchStoryViewers,
        replyToStory,
        startDmWithFriend,
        createGroupChat,
        updateGroupChat,
        leaveConversation,
        sharePostToChat,
        markConvRead,
        fetchProfileData,
        markNotifRead,
        markAllNotifsRead,
        toggleBlock,
        toggleMute,
        reportItem,
        createOrUpdateShareLink,
        revokeShareLink,
        fetchShareByToken,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within SocialContextProvider');
  return ctx;
}
