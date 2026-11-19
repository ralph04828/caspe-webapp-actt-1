import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  onSnapshot,
  increment,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppNotification,
  ClothingItem,
  ContentReport,
  FollowEdge,
  Outfit,
  OutfitSchedule,
  PostComment,
  ShareLink,
  SocialPost,
  UserProfile,
  UserSafetyEdge,
  WearLog,
  WishlistItem,
} from '../types';

// ========================
// USER PROFILES & USERNAMES
// ========================

export async function isUsernameAvailable(usernameLower: string, currentUid?: string): Promise<boolean> {
  if (!usernameLower) return false;
  const path = `usernames/${usernameLower}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', usernameLower));
    if (!snap.exists()) return true;
    const data = snap.data() as { uid?: string };
    return Boolean(currentUid && data?.uid === currentUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function reserveUsername(usernameLower: string, uid: string): Promise<void> {
  const path = `usernames/${usernameLower}`;
  try {
    await setDoc(doc(db, 'usernames', usernameLower), {
      usernameLower,
      uid,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listDiscoverableProfiles(maxResults = 30): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const q = query(collection(db, 'users'), limit(maxResults));
    const snap = await getDocs(q);
    const profiles: UserProfile[] = [];
    snap.forEach((d) => profiles.push(d.data() as UserProfile));
    return profiles;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ========================
// GENERIC USER COLLECTION SUBSCRIPTION
// ========================

function subscribeCollectionByUser<T extends { createdAt: string }>(
  collectionName: string,
  userId: string,
  onUpdate: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as T);
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

// ========================
// WARDROBE CRUD & PUBLIC VIEW
// ========================

export function subscribeWardrobe(
  userId: string,
  onUpdate: (items: ClothingItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<ClothingItem>('wardrobe', userId, onUpdate, onError);
}

export async function getVisibleWardrobeForUser(
  targetUserId: string,
  isFollower: boolean
): Promise<ClothingItem[]> {
  const path = 'wardrobe';
  try {
    const allowedVisibilities = isFollower ? ['public', 'followers'] : ['public'];
    const q = query(
      collection(db, 'wardrobe'),
      where('userId', '==', targetUserId),
      where('visibility', 'in', allowedVisibilities)
    );
    const snap = await getDocs(q);
    const items: ClothingItem[] = [];
    snap.forEach((d) => {
      const item = d.data() as ClothingItem;
      // Strip private-only fields just in case
      items.push({
        ...item,
        laundryStatus: 'clean',
        wearCount: 0,
        lastWornAt: undefined,
      });
    });
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveClothingItem(item: ClothingItem): Promise<void> {
  const path = `wardrobe/${item.id}`;
  try {
    await setDoc(doc(db, 'wardrobe', item.id), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClothingItem(id: string, updates: Partial<ClothingItem>): Promise<void> {
  const path = `wardrobe/${id}`;
  try {
    await updateDoc(doc(db, 'wardrobe', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function batchMarkWardrobeClean(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    itemIds.forEach((id) => {
      batch.update(doc(db, 'wardrobe', id), { laundryStatus: 'clean', updatedAt: now });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'wardrobe');
  }
}

export async function deleteClothingItem(id: string): Promise<void> {
  const path = `wardrobe/${id}`;
  try {
    await deleteDoc(doc(db, 'wardrobe', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ========================
// OUTFITS / LOOKBOOK CRUD
// ========================

export function subscribeOutfits(
  userId: string,
  onUpdate: (items: Outfit[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<Outfit>('outfits', userId, onUpdate, onError);
}

export async function saveOutfit(outfit: Outfit): Promise<void> {
  const path = `outfits/${outfit.id}`;
  try {
    await setDoc(doc(db, 'outfits', outfit.id), outfit);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOutfit(id: string, updates: Partial<Outfit>): Promise<void> {
  const path = `outfits/${id}`;
  try {
    await updateDoc(doc(db, 'outfits', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOutfit(id: string): Promise<void> {
  const path = `outfits/${id}`;
  try {
    await deleteDoc(doc(db, 'outfits', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ========================
// WISHLIST CRUD (NO PRICES)
// ========================

export function subscribeWishlist(
  userId: string,
  onUpdate: (items: WishlistItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<WishlistItem>('wishlist', userId, onUpdate, onError);
}

export async function saveWishlistItem(item: WishlistItem): Promise<void> {
  const path = `wishlist/${item.id}`;
  try {
    await setDoc(doc(db, 'wishlist', item.id), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWishlistItem(id: string, updates: Partial<WishlistItem>): Promise<void> {
  const path = `wishlist/${id}`;
  try {
    await updateDoc(doc(db, 'wishlist', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const path = `wishlist/${id}`;
  try {
    await deleteDoc(doc(db, 'wishlist', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ========================
// SCHEDULES & WEAR LOGS
// ========================

export function subscribeSchedules(
  userId: string,
  onUpdate: (items: OutfitSchedule[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<OutfitSchedule>('schedules', userId, onUpdate, onError);
}

export async function saveSchedule(schedule: OutfitSchedule): Promise<void> {
  const path = `schedules/${schedule.id}`;
  try {
    await setDoc(doc(db, 'schedules', schedule.id), schedule);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSchedule(id: string, updates: Partial<OutfitSchedule>): Promise<void> {
  const path = `schedules/${id}`;
  try {
    await updateDoc(doc(db, 'schedules', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  const path = `schedules/${id}`;
  try {
    await deleteDoc(doc(db, 'schedules', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeWearLogs(
  userId: string,
  onUpdate: (logs: WearLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<WearLog>('wearLogs', userId, onUpdate, onError);
}

export async function saveWearLog(log: WearLog): Promise<void> {
  const path = `wearLogs/${log.id}`;
  try {
    await setDoc(doc(db, 'wearLogs', log.id), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ========================
// SOCIAL POSTS, LIKES, SAVES, COMMENTS
// ========================

export function subscribePublicPosts(
  onUpdate: (posts: SocialPost[]) => void,
  onError?: (err: Error) => void,
  maxItems = 50
): Unsubscribe {
  const q = query(
    collection(db, 'posts'),
    where('visibility', '==', 'public'),
    limit(maxItems)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const posts: SocialPost[] = [];
      snapshot.forEach((d) => posts.push(d.data() as SocialPost));
      posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(posts);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function getUserPosts(targetUserId: string, isOwner: boolean, isFollower: boolean): Promise<SocialPost[]> {
  const path = 'posts';
  try {
    const allowed = isOwner
      ? ['public', 'followers', 'private']
      : isFollower
      ? ['public', 'followers']
      : ['public'];
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', targetUserId),
      where('visibility', 'in', allowed)
    );
    const snap = await getDocs(q);
    const posts: SocialPost[] = [];
    snap.forEach((d) => posts.push(d.data() as SocialPost));
    return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createSocialPost(post: SocialPost): Promise<void> {
  const path = `posts/${post.id}`;
  try {
    await setDoc(doc(db, 'posts', post.id), post);
    await updateDoc(doc(db, 'users', post.userId), { postsCount: increment(1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSocialPost(postId: string, updates: Partial<SocialPost>): Promise<void> {
  const path = `posts/${postId}`;
  try {
    await updateDoc(doc(db, 'posts', postId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSocialPost(postId: string, userId: string): Promise<void> {
  const path = `posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'posts', postId));
    await updateDoc(doc(db, 'users', userId), { postsCount: increment(-1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserLikes(
  userId: string,
  onUpdate: (likedPostIds: Set<string>) => void
): Unsubscribe {
  const q = query(collection(db, 'postLikes'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const ids = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() as { postId: string };
      if (data.postId) ids.add(data.postId);
    });
    onUpdate(ids);
  });
}

export function subscribeUserSaves(
  userId: string,
  onUpdate: (savedPostIds: Set<string>) => void
): Unsubscribe {
  const q = query(collection(db, 'postSaves'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const ids = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() as { postId: string };
      if (data.postId) ids.add(data.postId);
    });
    onUpdate(ids);
  });
}

export async function togglePostLikeFirestore(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  const likeId = `${postId}_${userId}`;
  const path = `postLikes/${likeId}`;
  try {
    if (currentlyLiked) {
      await deleteDoc(doc(db, 'postLikes', likeId));
      await updateDoc(doc(db, 'posts', postId), { likesCount: increment(-1) });
    } else {
      await setDoc(doc(db, 'postLikes', likeId), {
        id: likeId,
        postId,
        userId,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function togglePostSaveFirestore(
  postId: string,
  postAuthorId: string,
  userId: string,
  currentlySaved: boolean
): Promise<void> {
  const saveId = `${postId}_${userId}`;
  const path = `postSaves/${saveId}`;
  try {
    if (currentlySaved) {
      await deleteDoc(doc(db, 'postSaves', saveId));
      await updateDoc(doc(db, 'posts', postId), { savesCount: increment(-1) });
    } else {
      await setDoc(doc(db, 'postSaves', saveId), {
        id: saveId,
        postId,
        postAuthorId,
        userId,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'posts', postId), { savesCount: increment(1) });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getCommentsForPost(postId: string): Promise<PostComment[]> {
  const path = 'comments';
  try {
    const q = query(collection(db, 'comments'), where('postId', '==', postId));
    const snap = await getDocs(q);
    const list: PostComment[] = [];
    snap.forEach((d) => list.push(d.data() as PostComment));
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addCommentFirestore(comment: PostComment): Promise<void> {
  const path = `comments/${comment.id}`;
  try {
    await setDoc(doc(db, 'comments', comment.id), comment);
    await updateDoc(doc(db, 'posts', comment.postId), { commentsCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCommentFirestore(commentId: string, postId: string): Promise<void> {
  const path = `comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ========================
// FOLLOWS & NOTIFICATIONS
// ========================

export function subscribeOutgoingFollows(
  followerId: string,
  onUpdate: (edges: FollowEdge[]) => void
): Unsubscribe {
  const q = query(collection(db, 'follows'), where('followerId', '==', followerId));
  return onSnapshot(q, (snap) => {
    const list: FollowEdge[] = [];
    snap.forEach((d) => list.push(d.data() as FollowEdge));
    onUpdate(list);
  });
}

export function subscribeIncomingFollows(
  targetId: string,
  onUpdate: (edges: FollowEdge[]) => void
): Unsubscribe {
  const q = query(collection(db, 'follows'), where('targetId', '==', targetId));
  return onSnapshot(q, (snap) => {
    const list: FollowEdge[] = [];
    snap.forEach((d) => list.push(d.data() as FollowEdge));
    onUpdate(list);
  });
}

export async function saveFollowEdge(edge: FollowEdge): Promise<void> {
  const path = `follows/${edge.id}`;
  try {
    await setDoc(doc(db, 'follows', edge.id), edge);
    if (edge.status === 'accepted') {
      await updateDoc(doc(db, 'users', edge.followerId), { followingCount: increment(1) }).catch(() => {});
      await updateDoc(doc(db, 'users', edge.targetId), { followersCount: increment(1) }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function acceptFollowEdge(edge: FollowEdge): Promise<void> {
  const path = `follows/${edge.id}`;
  try {
    await updateDoc(doc(db, 'follows', edge.id), {
      status: 'accepted',
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'users', edge.followerId), { followingCount: increment(1) }).catch(() => {});
    await updateDoc(doc(db, 'users', edge.targetId), { followersCount: increment(1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeFollowEdge(edge: FollowEdge): Promise<void> {
  const path = `follows/${edge.id}`;
  try {
    await deleteDoc(doc(db, 'follows', edge.id));
    if (edge.status === 'accepted') {
      await updateDoc(doc(db, 'users', edge.followerId), { followingCount: increment(-1) }).catch(() => {});
      await updateDoc(doc(db, 'users', edge.targetId), { followersCount: increment(-1) }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeNotifications(
  userId: string,
  onUpdate: (items: AppNotification[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  return onSnapshot(q, (snap) => {
    const items: AppNotification[] = [];
    snap.forEach((d) => items.push(d.data() as AppNotification));
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(items);
  });
}

export async function createNotification(notif: AppNotification): Promise<void> {
  if (notif.actorId === notif.recipientId) return;
  const path = `notifications/${notif.id}`;
  try {
    await setDoc(doc(db, 'notifications', notif.id), notif);
  } catch (error) {
    console.warn('Notification write error:', error);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(doc(db, 'notifications', id), { read: true }));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

// ========================
// SAFETY (BLOCKS, MUTES, REPORTS, DELETE ACCOUNT DATA)
// ========================

export function subscribeBlocks(userId: string, onUpdate: (edges: UserSafetyEdge[]) => void): Unsubscribe {
  const q = query(collection(db, 'userBlocks'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const list: UserSafetyEdge[] = [];
    snap.forEach((d) => list.push(d.data() as UserSafetyEdge));
    onUpdate(list);
  });
}

export function subscribeMutes(userId: string, onUpdate: (edges: UserSafetyEdge[]) => void): Unsubscribe {
  const q = query(collection(db, 'userMutes'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const list: UserSafetyEdge[] = [];
    snap.forEach((d) => list.push(d.data() as UserSafetyEdge));
    onUpdate(list);
  });
}

export async function toggleBlockUser(edge: UserSafetyEdge, isBlocked: boolean): Promise<void> {
  const path = `userBlocks/${edge.id}`;
  try {
    if (isBlocked) {
      await deleteDoc(doc(db, 'userBlocks', edge.id));
    } else {
      await setDoc(doc(db, 'userBlocks', edge.id), edge);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleMuteUser(edge: UserSafetyEdge, isMuted: boolean): Promise<void> {
  const path = `userMutes/${edge.id}`;
  try {
    if (isMuted) {
      await deleteDoc(doc(db, 'userMutes', edge.id));
    } else {
      await setDoc(doc(db, 'userMutes', edge.id), edge);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitReport(report: ContentReport): Promise<void> {
  const path = `reports/${report.id}`;
  try {
    await setDoc(doc(db, 'reports', report.id), report);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ========================
// SHARE LINKS
// ========================

export function subscribeUserShareLinks(
  userId: string,
  onUpdate: (links: ShareLink[]) => void
): Unsubscribe {
  const q = query(collection(db, 'shareLinks'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const links: ShareLink[] = [];
    snap.forEach((d) => links.push(d.data() as ShareLink));
    links.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(links);
  });
}

export async function saveShareLink(link: ShareLink): Promise<void> {
  const path = `shareLinks/${link.token}`;
  try {
    await setDoc(doc(db, 'shareLinks', link.token), link);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateShareLink(token: string, updates: Partial<ShareLink>): Promise<void> {
  const path = `shareLinks/${token}`;
  try {
    await updateDoc(doc(db, 'shareLinks', token), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getShareLinkByToken(token: string): Promise<ShareLink | null> {
  const path = `shareLinks/${token}`;
  try {
    const snap = await getDoc(doc(db, 'shareLinks', token));
    if (!snap.exists()) return null;
    const data = snap.data() as ShareLink;
    if (data.visibility === 'revoked') return null;
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Delete all user-owned documents on account deletion
export async function deleteAllUserData(uid: string, usernameLower?: string): Promise<void> {
  const ownedCollections = [
    'wardrobe',
    'outfits',
    'wishlist',
    'schedules',
    'wearLogs',
    'posts',
    'postLikes',
    'postSaves',
    'comments',
    'userBlocks',
    'userMutes',
    'shareLinks',
  ];

  for (const col of ownedCollections) {
    const q = query(collection(db, col), where('userId', '==', uid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }

  const mediaQ = query(collection(db, 'media'), where('ownerId', '==', uid));
  const mediaSnap = await getDocs(mediaQ);
  for (const d of mediaSnap.docs) {
    const data = d.data() as { chunkCount?: number };
    if (data.chunkCount && data.chunkCount > 0) {
      for (let i = 0; i < data.chunkCount; i++) {
        await deleteDoc(doc(db, 'media', d.id, 'chunks', String(i))).catch(() => {});
      }
    }
    await deleteDoc(d.ref);
  }

  if (usernameLower) {
    await deleteDoc(doc(db, 'usernames', usernameLower)).catch(() => {});
  }
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
}
