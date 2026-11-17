import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppNotification,
  ClothingItem,
  CommentPolicy,
  FollowEdge,
  Outfit,
  OutfitPieceSnapshot,
  PostComment,
  PostType,
  ShareLink,
  ShareVisibility,
  SocialPost,
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
} from '../data/demoData';
import {
  acceptFollowEdge,
  addCommentFirestore,
  createNotification,
  createSocialPost,
  deleteCommentFirestore,
  deleteSocialPost,
  getCommentsForPost,
  getShareLinkByToken,
  getUserPosts,
  getVisibleWardrobeForUser,
  listDiscoverableProfiles,
  markAllNotificationsRead,
  markNotificationRead,
  removeFollowEdge,
  saveFollowEdge,
  saveShareLink,
  submitReport,
  subscribeBlocks,
  subscribeIncomingFollows,
  subscribeMutes,
  subscribeNotifications,
  subscribeOutgoingFollows,
  subscribePublicPosts,
  subscribeUserLikes,
  subscribeUserSaves,
  subscribeUserShareLinks,
  toggleBlockUser,
  toggleMuteUser,
  togglePostLikeFirestore,
  togglePostSaveFirestore,
  updateShareLink,
} from '../services/firestoreService';
import { checkTextSafety, extractHashtags, extractMentions } from '../utils/formatters';

const DEMO_SOCIAL_KEY = 'swooosh_demo_social_v2';

interface DemoSocialState {
  posts: SocialPost[];
  comments: PostComment[];
  likedIds: string[];
  savedIds: string[];
  follows: FollowEdge[];
  notifications: AppNotification[];
  blocks: UserSafetyEdge[];
  mutes: UserSafetyEdge[];
  shareLinks: ShareLink[];
}

interface SocialContextType {
  publicPosts: SocialPost[];
  discoverProfiles: UserProfile[];
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;
  outgoingFollows: FollowEdge[];
  incomingFollows: FollowEdge[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  blockedEdges: UserSafetyEdge[];
  mutedEdges: UserSafetyEdge[];
  shareLinks: ShareLink[];
  loadingFeed: boolean;

  // Derived helpers
  isFollowing: (targetUid: string) => 'none' | 'pending' | 'accepted';
  isBlocked: (targetUid: string) => boolean;
  isMuted: (targetUid: string) => boolean;
  visiblePostsForFeed: SocialPost[];

  // Post Actions
  publishPost: (params: {
    postType: PostType;
    caption: string;
    visibility: Visibility;
    allowRemix: boolean;
    commentPolicy: CommentPolicy;
    outfit?: Outfit;
    item?: ClothingItem;
    wardrobe: ClothingItem[];
    mediaUrl?: string;
    thumbUrl?: string;
    mediaId?: string;
    altText?: string;
    styleTags?: string[];
    occasion?: string;
    remixedFrom?: SocialPost['remixedFrom'];
  }) => Promise<SocialPost>;
  deletePost: (post: SocialPost) => Promise<void>;
  toggleLike: (post: SocialPost) => Promise<void>;
  toggleSave: (post: SocialPost) => Promise<void>;
  loadComments: (postId: string) => Promise<PostComment[]>;
  addComment: (post: SocialPost, text: string) => Promise<PostComment>;
  deleteComment: (comment: PostComment) => Promise<void>;

  // Follow Actions
  toggleFollow: (target: UserProfile) => Promise<void>;
  approveFollowRequest: (edge: FollowEdge) => Promise<void>;
  declineFollowRequest: (edge: FollowEdge) => Promise<void>;

  // Profile & Visible Data Fetching
  fetchProfileData: (target: UserProfile) => Promise<{
    posts: SocialPost[];
    wardrobe: ClothingItem[];
  }>;

  // Notifications
  markNotifRead: (id: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;

  // Safety
  toggleBlock: (target: { uid: string; username: string; displayName?: string }) => Promise<void>;
  toggleMute: (target: { uid: string; username: string; displayName?: string }) => Promise<void>;
  reportItem: (params: {
    targetType: 'post' | 'comment' | 'user';
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
  const [discoverProfiles, setDiscoverProfiles] = useState<UserProfile[]>([]);
  const [demoComments, setDemoComments] = useState<PostComment[]>(DEMO_COMMENTS);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [outgoingFollows, setOutgoingFollows] = useState<FollowEdge[]>([]);
  const [incomingFollows, setIncomingFollows] = useState<FollowEdge[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [blockedEdges, setBlockedEdges] = useState<UserSafetyEdge[]>([]);
  const [mutedEdges, setMutedEdges] = useState<UserSafetyEdge[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const persistDemoSocial = (next: DemoSocialState) => {
    try {
      localStorage.setItem(DEMO_SOCIAL_KEY, JSON.stringify(next));
    } catch {
      // ignore quota
    }
  };

  const getDemoSnapshot = (): DemoSocialState => ({
    posts: publicPosts,
    comments: demoComments,
    likedIds: Array.from(likedPostIds),
    savedIds: Array.from(savedPostIds),
    follows: [...outgoingFollows, ...incomingFollows],
    notifications,
    blocks: blockedEdges,
    mutes: mutedEdges,
    shareLinks,
  });

  useEffect(() => {
    if (!userProfile) {
      setPublicPosts([]);
      setDiscoverProfiles([]);
      setLikedPostIds(new Set());
      setSavedPostIds(new Set());
      setOutgoingFollows([]);
      setIncomingFollows([]);
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
          setPublicPosts(parsed.posts || DEMO_POSTS);
          setDemoComments(parsed.comments || DEMO_COMMENTS);
          setLikedPostIds(new Set(parsed.likedIds || []));
          setSavedPostIds(new Set(parsed.savedIds || []));
          const allF = parsed.follows || DEMO_FOLLOWS;
          setOutgoingFollows(allF.filter((f) => f.followerId === userProfile.uid));
          setIncomingFollows(allF.filter((f) => f.targetId === userProfile.uid));
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
      setDemoComments(DEMO_COMMENTS);
      setLikedPostIds(new Set());
      setSavedPostIds(new Set());
      setOutgoingFollows(DEMO_FOLLOWS.filter((f) => f.followerId === userProfile.uid));
      setIncomingFollows(DEMO_FOLLOWS.filter((f) => f.targetId === userProfile.uid));
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
      () => setLoadingFeed(false)
    );
    const unsubLikes = subscribeUserLikes(userProfile.uid, setLikedPostIds);
    const unsubSaves = subscribeUserSaves(userProfile.uid, setSavedPostIds);
    const unsubOutFollows = subscribeOutgoingFollows(userProfile.uid, setOutgoingFollows);
    const unsubInFollows = subscribeIncomingFollows(userProfile.uid, setIncomingFollows);
    const unsubNotifs = subscribeNotifications(userProfile.uid, setNotifications);
    const unsubBlocks = subscribeBlocks(userProfile.uid, setBlockedEdges);
    const unsubMutes = subscribeMutes(userProfile.uid, setMutedEdges);
    const unsubShares = subscribeUserShareLinks(userProfile.uid, setShareLinks);

    listDiscoverableProfiles(35)
      .then((list) => setDiscoverProfiles(list))
      .catch(() => {});

    return () => {
      unsubPosts();
      unsubLikes();
      unsubSaves();
      unsubOutFollows();
      unsubInFollows();
      unsubNotifs();
      unsubBlocks();
      unsubMutes();
      unsubShares();
    };
  }, [userProfile?.uid, isDemoMode]);

  const blockedSet = useMemo(() => new Set(blockedEdges.map((b) => b.targetId)), [blockedEdges]);
  const mutedSet = useMemo(() => new Set(mutedEdges.map((m) => m.targetId)), [mutedEdges]);

  const isFollowing = (targetUid: string): 'none' | 'pending' | 'accepted' => {
    const edge = outgoingFollows.find((f) => f.targetId === targetUid);
    return edge ? edge.status : 'none';
  };

  const isBlocked = (targetUid: string) => blockedSet.has(targetUid);
  const isMuted = (targetUid: string) => mutedSet.has(targetUid);

  const visiblePostsForFeed = useMemo(
    () => publicPosts.filter((p) => !blockedSet.has(p.userId) && !mutedSet.has(p.userId)),
    [publicPosts, blockedSet, mutedSet]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

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
        brand: isPrivate ? '' : item.brand,
        color: isPrivate ? '' : item.color,
        imageUrl: isPrivate ? undefined : item.thumbUrl || item.imageUrl,
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

  const publishPost: SocialContextType['publishPost'] = async (params) => {
    if (!userProfile) throw new Error('Sign in to publish posts.');
    const safety = checkTextSafety(params.caption);
    if (!safety.ok) throw new Error(safety.reason || 'Post text failed safety check.');

    let piecesPreview: OutfitPieceSnapshot[] | undefined;
    let mediaUrl = params.mediaUrl;
    let thumbUrl = params.thumbUrl;
    let altText = params.altText;

    if (params.outfit) {
      piecesPreview = buildOutfitSnapshots(params.outfit, params.wardrobe);
      if (!mediaUrl) {
        const firstVisible = piecesPreview.find((p) => !p.isPrivatePlaceholder && p.imageUrl);
        mediaUrl = params.outfit.coverImageUrl || firstVisible?.imageUrl;
        thumbUrl = mediaUrl;
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
          brand: isPriv ? '' : params.item.brand,
          color: isPriv ? '' : params.item.color,
          imageUrl: isPriv ? undefined : params.item.thumbUrl || params.item.imageUrl,
          visibility: params.item.visibility,
          isPrivatePlaceholder: isPriv,
        },
      ];
      if (!mediaUrl) {
        mediaUrl = params.item.imageUrl;
        thumbUrl = params.item.thumbUrl || params.item.imageUrl;
      }
      if (!altText) altText = params.item.altText;
    }

    const post: SocialPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: userProfile.uid,
      authorName: userProfile.displayName,
      authorUsername: userProfile.username,
      authorPhotoUrl: userProfile.photoURL,
      postType: params.postType,
      caption: params.caption.trim(),
      hashtags: extractHashtags(params.caption),
      mentions: extractMentions(params.caption),
      outfitId: params.outfit?.id,
      itemId: params.item?.id,
      mediaUrl,
      thumbUrl,
      mediaId: params.mediaId,
      altText: altText || 'Fashion fit post',
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
    };

    if (isDemoMode) {
      const nextPosts = [post, ...publicPosts];
      setPublicPosts(nextPosts);
      persistDemoSocial({ ...getDemoSnapshot(), posts: nextPosts });
    } else {
      await createSocialPost(post);
      if (params.remixedFrom?.userId && params.remixedFrom.userId !== userProfile.uid) {
        await createNotification({
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          recipientId: params.remixedFrom.userId,
          actorId: userProfile.uid,
          actorUsername: userProfile.username,
          actorName: userProfile.displayName,
          actorPhotoUrl: userProfile.photoURL,
          type: 'remix',
          targetId: post.id,
          targetPreview: post.caption.slice(0, 80),
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    return post;
  };

  const deletePost = async (post: SocialPost) => {
    if (!userProfile || post.userId !== userProfile.uid) return;
    if (isDemoMode) {
      const nextPosts = publicPosts.filter((p) => p.id !== post.id);
      setPublicPosts(nextPosts);
      persistDemoSocial({ ...getDemoSnapshot(), posts: nextPosts });
    } else {
      await deleteSocialPost(post.id, userProfile.uid);
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
      persistDemoSocial({
        ...getDemoSnapshot(),
        likedIds: Array.from(nextLiked),
        posts: nextPosts,
      });
      return;
    }

    await togglePostLikeFirestore(post.id, userProfile.uid, currentlyLiked);
    if (!currentlyLiked && post.userId !== userProfile.uid) {
      await createNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipientId: post.userId,
        actorId: userProfile.uid,
        actorUsername: userProfile.username,
        actorName: userProfile.displayName,
        actorPhotoUrl: userProfile.photoURL,
        type: 'like',
        targetId: post.id,
        targetPreview: post.caption.slice(0, 70),
        read: false,
        createdAt: new Date().toISOString(),
      });
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
      persistDemoSocial({
        ...getDemoSnapshot(),
        savedIds: Array.from(nextSaved),
        posts: nextPosts,
      });
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

  const addComment = async (post: SocialPost, text: string): Promise<PostComment> => {
    if (!userProfile) throw new Error('Sign in to comment.');
    if (post.commentPolicy === 'off' && post.userId !== userProfile.uid) {
      throw new Error('Comments are turned off for this post.');
    }
    if (post.commentPolicy === 'followers' && post.userId !== userProfile.uid && isFollowing(post.userId) !== 'accepted') {
      throw new Error('Only followers can comment on this post.');
    }
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Comment cannot be empty.');
    const safety = checkTextSafety(trimmed);
    if (!safety.ok) throw new Error(safety.reason || 'Comment blocked.');

    const comment: PostComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      postId: post.id,
      postAuthorId: post.userId,
      userId: userProfile.uid,
      authorUsername: userProfile.username,
      authorName: userProfile.displayName,
      authorPhotoUrl: userProfile.photoURL,
      text: trimmed,
      mentions: extractMentions(trimmed),
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextComments = [...demoComments, comment];
      const nextPosts = publicPosts.map((p) =>
        p.id === post.id ? { ...p, commentsCount: p.commentsCount + 1 } : p
      );
      setDemoComments(nextComments);
      setPublicPosts(nextPosts);
      persistDemoSocial({ ...getDemoSnapshot(), comments: nextComments, posts: nextPosts });
      return comment;
    }

    await addCommentFirestore(comment);
    if (post.userId !== userProfile.uid) {
      await createNotification({
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
      });
    }
    return comment;
  };

  const deleteComment = async (comment: PostComment) => {
    if (!userProfile) return;
    if (comment.userId !== userProfile.uid && comment.postAuthorId !== userProfile.uid) return;
    if (isDemoMode) {
      const nextComments = demoComments.filter((c) => c.id !== comment.id);
      const nextPosts = publicPosts.map((p) =>
        p.id === comment.postId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
      );
      setDemoComments(nextComments);
      setPublicPosts(nextPosts);
      persistDemoSocial({ ...getDemoSnapshot(), comments: nextComments, posts: nextPosts });
      return;
    }
    await deleteCommentFirestore(comment.id, comment.postId);
  };

  const toggleFollow = async (target: UserProfile) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = outgoingFollows.find((f) => f.targetId === target.uid);

    if (existing) {
      if (isDemoMode) {
        const nextOut = outgoingFollows.filter((f) => f.id !== existing.id);
        setOutgoingFollows(nextOut);
        persistDemoSocial({ ...getDemoSnapshot(), follows: [...nextOut, ...incomingFollows] });
      } else {
        await removeFollowEdge(existing);
      }
      return;
    }

    const edge: FollowEdge = {
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
    };

    if (isDemoMode) {
      const nextOut = [...outgoingFollows, edge];
      setOutgoingFollows(nextOut);
      persistDemoSocial({ ...getDemoSnapshot(), follows: [...nextOut, ...incomingFollows] });
    } else {
      await saveFollowEdge(edge);
      await createNotification({
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
      });
    }
  };

  const approveFollowRequest = async (edge: FollowEdge) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const nextIn = incomingFollows.map((f) =>
        f.id === edge.id ? { ...f, status: 'accepted' as const } : f
      );
      setIncomingFollows(nextIn);
      persistDemoSocial({ ...getDemoSnapshot(), follows: [...outgoingFollows, ...nextIn] });
      return;
    }
    await acceptFollowEdge(edge);
    await createNotification({
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
    });
  };

  const declineFollowRequest = async (edge: FollowEdge) => {
    if (!userProfile) return;
    if (isDemoMode) {
      const nextIn = incomingFollows.filter((f) => f.id !== edge.id);
      setIncomingFollows(nextIn);
      persistDemoSocial({ ...getDemoSnapshot(), follows: [...outgoingFollows, ...nextIn] });
      return;
    }
    await removeFollowEdge(edge);
  };

  const fetchProfileData = async (target: UserProfile) => {
    if (!userProfile) return { posts: [], wardrobe: [] };
    const isOwner = target.uid === userProfile.uid;
    const follower = isFollowing(target.uid) === 'accepted';
    if (!target.isPublic && !isOwner && !follower) {
      return { posts: [], wardrobe: [] };
    }
    if (isDemoMode) {
      const posts = publicPosts.filter((p) => p.userId === target.uid);
      return { posts, wardrobe: [] };
    }
    const [posts, wardrobe] = await Promise.all([
      getUserPosts(target.uid, isOwner, follower),
      getVisibleWardrobeForUser(target.uid, follower),
    ]);
    return { posts, wardrobe };
  };

  const markNotifRead = async (id: string) => {
    if (isDemoMode) {
      const nextN = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      setNotifications(nextN);
      persistDemoSocial({ ...getDemoSnapshot(), notifications: nextN });
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
      persistDemoSocial({ ...getDemoSnapshot(), notifications: nextN });
      return;
    }
    await markAllNotificationsRead(unreadIds);
  };

  const toggleBlock = async (target: { uid: string; username: string; displayName?: string }) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = blockedEdges.find((b) => b.targetId === target.uid);
    const edge: UserSafetyEdge = existing || {
      id: `${userProfile.uid}_${target.uid}`,
      userId: userProfile.uid,
      targetId: target.uid,
      targetUsername: target.username,
      targetName: target.displayName,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextBlocks = existing
        ? blockedEdges.filter((b) => b.targetId !== target.uid)
        : [...blockedEdges, edge];
      setBlockedEdges(nextBlocks);
      persistDemoSocial({ ...getDemoSnapshot(), blocks: nextBlocks });
      return;
    }
    await toggleBlockUser(edge, Boolean(existing));
  };

  const toggleMute = async (target: { uid: string; username: string; displayName?: string }) => {
    if (!userProfile || target.uid === userProfile.uid) return;
    const existing = mutedEdges.find((m) => m.targetId === target.uid);
    const edge: UserSafetyEdge = existing || {
      id: `${userProfile.uid}_${target.uid}`,
      userId: userProfile.uid,
      targetId: target.uid,
      targetUsername: target.username,
      targetName: target.displayName,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextMutes = existing
        ? mutedEdges.filter((m) => m.targetId !== target.uid)
        : [...mutedEdges, edge];
      setMutedEdges(nextMutes);
      persistDemoSocial({ ...getDemoSnapshot(), mutes: nextMutes });
      return;
    }
    await toggleMuteUser(edge, Boolean(existing));
  };

  const reportItem: SocialContextType['reportItem'] = async (params) => {
    if (!userProfile) return;
    if (isDemoMode) return;
    await submitReport({
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reporterId: userProfile.uid,
      targetType: params.targetType,
      targetId: params.targetId,
      targetOwnerId: params.targetOwnerId,
      reason: params.reason,
      details: params.details,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    });
  };

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

    const link: ShareLink = {
      token,
      userId: userProfile.uid,
      targetType: params.targetType,
      targetId: params.targetId,
      title: params.title,
      description: params.description,
      previewImageUrl: snapshots[0]?.coverImageUrl || snapshots[0]?.pieces.find((p) => !p.isPrivatePlaceholder)?.imageUrl,
      authorUsername: userProfile.username,
      authorName: userProfile.displayName,
      visibility: params.visibility,
      outfitsSnapshot: snapshots,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextLinks = [link, ...shareLinks];
      setShareLinks(nextLinks);
      persistDemoSocial({ ...getDemoSnapshot(), shareLinks: nextLinks });
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
      persistDemoSocial({ ...getDemoSnapshot(), shareLinks: nextLinks });
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

  return (
    <SocialContext.Provider
      value={{
        publicPosts,
        discoverProfiles,
        likedPostIds,
        savedPostIds,
        outgoingFollows,
        incomingFollows,
        notifications,
        unreadNotificationsCount,
        blockedEdges,
        mutedEdges,
        shareLinks,
        loadingFeed,
        isFollowing,
        isBlocked,
        isMuted,
        visiblePostsForFeed,
        publishPost,
        deletePost,
        toggleLike,
        toggleSave,
        loadComments,
        addComment,
        deleteComment,
        toggleFollow,
        approveFollowRequest,
        declineFollowRequest,
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
