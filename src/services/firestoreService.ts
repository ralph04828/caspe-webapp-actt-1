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
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  increment,
  arrayRemove,
  writeBatch,
  runTransaction,
  Unsubscribe,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { assertOnlineForWrite, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppNotification,
  ChatConversation,
  ChatMessage,
  ChatParticipantProfile,
  ClothingItem,
  ContentReport,
  FollowEdge,
  FriendshipEdge,
  MyDayStory,
  Outfit,
  OutfitSchedule,
  PostComment,
  ShareLink,
  SocialPost,
  StoryView,
  UserProfile,
  UserSafetyEdge,
  WearLog,
  WishlistItem,
} from '../types';
import { isStoryActive } from '../utils/formatters';
import { cleanData } from '../utils/cleanData';

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
    await setDoc(
      doc(db, 'usernames', usernameLower),
      cleanData({
        usernameLower,
        uid,
        createdAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Atomically verifies username uniqueness in /usernames/{usernameLower} and writes/updates
 * the user's profile in /users/{uid} in a single Firestore transaction so two accounts
 * cannot claim the same username simultaneously.
 */
export async function claimUsernameAndSaveProfile(params: {
  uid: string;
  newUsernameLower: string;
  oldUsernameLower?: string;
  profileCreatePayload?: UserProfile;
  profileUpdatePayload?: Partial<UserProfile>;
}): Promise<void> {
  const { uid, newUsernameLower, oldUsernameLower, profileCreatePayload, profileUpdatePayload } = params;
  const path = `users/${uid}`;
  try {
    await runTransaction(db, async (tx) => {
      const newNameRef = doc(db, 'usernames', newUsernameLower);
      const userRef = doc(db, 'users', uid);

      const newNameSnap = await tx.get(newNameRef);
      if (newNameSnap.exists()) {
        const ownerUid = (newNameSnap.data() as { uid?: string })?.uid;
        if (ownerUid && ownerUid !== uid) {
          throw new Error(`@${newUsernameLower} is already taken. Choose another username.`);
        }
      }

      const existingUserSnap = await tx.get(userRef);

      let oldNameRefToDelete: ReturnType<typeof doc> | null = null;
      if (oldUsernameLower && oldUsernameLower !== newUsernameLower) {
        const candidateOldRef = doc(db, 'usernames', oldUsernameLower);
        const oldSnap = await tx.get(candidateOldRef);
        if (oldSnap.exists() && (oldSnap.data() as { uid?: string })?.uid === uid) {
          oldNameRefToDelete = candidateOldRef;
        }
      }

      const now = new Date().toISOString();

      if (!existingUserSnap.exists()) {
        if (!profileCreatePayload) {
          throw new Error('Missing profile data for account setup.');
        }
        tx.set(
          userRef,
          cleanData({
            ...profileCreatePayload,
            username: newUsernameLower,
            usernameLower: newUsernameLower,
            updatedAt: now,
          })
        );
      } else {
        tx.update(
          userRef,
          cleanData({
            ...(profileUpdatePayload || {}),
            username: newUsernameLower,
            usernameLower: newUsernameLower,
            updatedAt: now,
          })
        );
      }

      if (!newNameSnap.exists()) {
        tx.set(
          newNameRef,
          cleanData({
            usernameLower: newUsernameLower,
            uid,
            createdAt: now,
          })
        );
      }

      if (oldNameRefToDelete) {
        tx.delete(oldNameRefToDelete);
      }
    });
  } catch (error: any) {
    if (error?.message?.includes('is already taken')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePrivateUserBirthday(uid: string, birthday: string): Promise<void> {
  if (!uid || !birthday) return;
  try {
    await setDoc(
      doc(db, 'userPrivate', uid),
      cleanData({
        uid,
        birthday,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch {
    // Non-blocking private birthday record
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

export async function getUserUidByUsername(usernameLower: string): Promise<string | null> {
  if (!usernameLower) return null;
  try {
    const snap = await getDoc(doc(db, 'usernames', usernameLower.toLowerCase()));
    if (!snap.exists()) return null;
    const data = snap.data() as { uid?: string };
    return data.uid || null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), cleanData(profile));
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
    assertOnlineForWrite('update your profile');
    await updateDoc(
      doc(db, 'users', uid),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPresence(
  uid: string,
  onlineStatus: boolean,
  showOnlineStatus = true
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'users', uid),
      cleanData({
        onlineStatus: showOnlineStatus ? onlineStatus : false,
        lastSeenAt: new Date().toISOString(),
      })
    );
  } catch {
    // Non-blocking presence update
  }
}

export async function listDiscoverableProfiles(maxResults = 60): Promise<UserProfile[]> {
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
  isFriend: boolean,
  isFollower: boolean
): Promise<ClothingItem[]> {
  const path = 'wardrobe';
  try {
    const allowedVisibilities: string[] = ['public'];
    if (isFriend) allowedVisibilities.push('friends', 'followers');
    else if (isFollower) allowedVisibilities.push('followers');

    const q = query(
      collection(db, 'wardrobe'),
      where('userId', '==', targetUserId),
      where('visibility', 'in', allowedVisibilities)
    );
    const snap = await getDocs(q);
    const items: ClothingItem[] = [];
    snap.forEach((d) => {
      const item = d.data() as ClothingItem;
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
    assertOnlineForWrite('save this garment');
    await setDoc(doc(db, 'wardrobe', item.id), cleanData(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClothingItem(id: string, updates: Partial<ClothingItem>): Promise<void> {
  const path = `wardrobe/${id}`;
  try {
    assertOnlineForWrite('update this garment');
    await updateDoc(
      doc(db, 'wardrobe', id),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
      batch.update(doc(db, 'wardrobe', id), cleanData({ laundryStatus: 'clean', updatedAt: now }));
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
// OUTFITS / LOOKBOOK CRUD & VISIBLE LOOKBOOK
// ========================

export function subscribeOutfits(
  userId: string,
  onUpdate: (items: Outfit[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<Outfit>('outfits', userId, onUpdate, onError);
}

export async function getVisibleOutfitsForUser(
  targetUserId: string,
  isFriend: boolean,
  isFollower: boolean
): Promise<Outfit[]> {
  const path = 'outfits';
  try {
    const allowed: string[] = ['public'];
    if (isFriend) allowed.push('friends', 'followers');
    else if (isFollower) allowed.push('followers');
    const q = query(
      collection(db, 'outfits'),
      where('userId', '==', targetUserId),
      where('visibility', 'in', allowed)
    );
    const snap = await getDocs(q);
    const outfits: Outfit[] = [];
    snap.forEach((d) => outfits.push(d.data() as Outfit));
    return outfits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveOutfit(outfit: Outfit): Promise<void> {
  const path = `outfits/${outfit.id}`;
  try {
    assertOnlineForWrite('save this outfit');
    await setDoc(doc(db, 'outfits', outfit.id), cleanData(outfit));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOutfit(id: string, updates: Partial<Outfit>): Promise<void> {
  const path = `outfits/${id}`;
  try {
    assertOnlineForWrite('update this outfit');
    await updateDoc(
      doc(db, 'outfits', id),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
    assertOnlineForWrite('save to wishlist');
    await setDoc(doc(db, 'wishlist', item.id), cleanData(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWishlistItem(id: string, updates: Partial<WishlistItem>): Promise<void> {
  const path = `wishlist/${id}`;
  try {
    await updateDoc(
      doc(db, 'wishlist', id),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
// SCHEDULES & WEAR LOGS (STRICTLY PRIVATE)
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
    await setDoc(doc(db, 'schedules', schedule.id), cleanData(schedule));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSchedule(id: string, updates: Partial<OutfitSchedule>): Promise<void> {
  const path = `schedules/${id}`;
  try {
    await updateDoc(
      doc(db, 'schedules', id),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
    await setDoc(doc(db, 'wearLogs', log.id), cleanData(log));
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

export function subscribeMyPosts(
  userId: string,
  onUpdate: (posts: SocialPost[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<SocialPost>('posts', userId, onUpdate, onError);
}

export async function fetchFriendsAndFollowedPosts(
  friendIds: string[],
  followingIds: string[]
): Promise<SocialPost[]> {
  const results = new Map<string, SocialPost>();

  // Friends-only + public posts for accepted friends (batched by 10 for Firestore `in`)
  const uniqueFriends = Array.from(new Set(friendIds));
  for (let i = 0; i < uniqueFriends.length; i += 10) {
    const chunk = uniqueFriends.slice(i, i + 10);
    if (chunk.length === 0) continue;
    try {
      const q = query(
        collection(db, 'posts'),
        where('userId', 'in', chunk),
        where('visibility', 'in', ['public', 'friends', 'followers'])
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const post = d.data() as SocialPost;
        results.set(post.id, post);
      });
    } catch {
      // Fallback: read public posts per chunk
      try {
        const fallbackQ = query(
          collection(db, 'posts'),
          where('userId', 'in', chunk),
          where('visibility', '==', 'public')
        );
        const snap = await getDocs(fallbackQ);
        snap.forEach((d) => {
          const post = d.data() as SocialPost;
          results.set(post.id, post);
        });
      } catch {
        // ignore
      }
    }
  }

  // Followed users (non-friends) public/followers posts
  const friendSet = new Set(uniqueFriends);
  const nonFriendFollows = Array.from(new Set(followingIds)).filter((id) => !friendSet.has(id));
  for (let i = 0; i < nonFriendFollows.length; i += 10) {
    const chunk = nonFriendFollows.slice(i, i + 10);
    if (chunk.length === 0) continue;
    try {
      const q = query(
        collection(db, 'posts'),
        where('userId', 'in', chunk),
        where('visibility', 'in', ['public', 'followers'])
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const post = d.data() as SocialPost;
        results.set(post.id, post);
      });
    } catch {
      // ignore
    }
  }

  return Array.from(results.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getUserPosts(
  targetUserId: string,
  isOwner: boolean,
  isFriend: boolean,
  isFollower: boolean
): Promise<SocialPost[]> {
  const path = 'posts';
  try {
    const allowed = isOwner
      ? ['public', 'friends', 'followers', 'private']
      : isFriend
      ? ['public', 'friends', 'followers']
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
    assertOnlineForWrite('publish this post');
    await setDoc(doc(db, 'posts', post.id), cleanData(post));
    await updateDoc(doc(db, 'users', post.userId), cleanData({ postsCount: increment(1) })).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSocialPost(postId: string, updates: Partial<SocialPost>): Promise<void> {
  const path = `posts/${postId}`;
  try {
    assertOnlineForWrite('update this post');
    await updateDoc(
      doc(db, 'posts', postId),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
      await updateDoc(doc(db, 'posts', postId), { likesCount: increment(-1) }).catch(() => {});
    } else {
      await setDoc(
        doc(db, 'postLikes', likeId),
        cleanData({
          id: likeId,
          postId,
          userId,
          createdAt: new Date().toISOString(),
        })
      );
      await updateDoc(doc(db, 'posts', postId), cleanData({ likesCount: increment(1) })).catch(() => {});
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
      await updateDoc(doc(db, 'posts', postId), cleanData({ savesCount: increment(-1) })).catch(() => {});
    } else {
      await setDoc(
        doc(db, 'postSaves', saveId),
        cleanData({
          id: saveId,
          postId,
          postAuthorId,
          userId,
          createdAt: new Date().toISOString(),
        })
      );
      await updateDoc(doc(db, 'posts', postId), cleanData({ savesCount: increment(1) })).catch(() => {});
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
    assertOnlineForWrite('post this comment');
    await setDoc(doc(db, 'comments', comment.id), cleanData(comment));
    await updateDoc(doc(db, 'posts', comment.postId), cleanData({ commentsCount: increment(1) })).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCommentFirestore(commentId: string, postId: string): Promise<void> {
  const path = `comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ========================
// FRIENDSHIPS
// ========================

export function subscribeUserFriendships(
  userId: string,
  onUpdate: (edges: FriendshipEdge[]) => void
): Unsubscribe {
  const q = query(collection(db, 'friendships'), where('users', 'array-contains', userId));
  return onSnapshot(q, (snap) => {
    const list: FriendshipEdge[] = [];
    snap.forEach((d) => list.push(d.data() as FriendshipEdge));
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(list);
  });
}

export async function sendFriendRequestFirestore(edge: FriendshipEdge): Promise<void> {
  const path = `friendships/${edge.id}`;
  try {
    await setDoc(doc(db, 'friendships', edge.id), cleanData(edge));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function acceptFriendRequestFirestore(edge: FriendshipEdge): Promise<void> {
  const path = `friendships/${edge.id}`;
  try {
    await updateDoc(
      doc(db, 'friendships', edge.id),
      cleanData({
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      })
    );
    await updateDoc(doc(db, 'users', edge.requesterId), { friendsCount: increment(1) }).catch(() => {});
    await updateDoc(doc(db, 'users', edge.recipientId), { friendsCount: increment(1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeFriendshipFirestore(edge: FriendshipEdge): Promise<void> {
  const path = `friendships/${edge.id}`;
  try {
    await deleteDoc(doc(db, 'friendships', edge.id));
    if (edge.status === 'accepted') {
      await updateDoc(doc(db, 'users', edge.requesterId), { friendsCount: increment(-1) }).catch(() => {});
      await updateDoc(doc(db, 'users', edge.recipientId), { friendsCount: increment(-1) }).catch(() => {});
    }
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
    await setDoc(doc(db, 'follows', edge.id), cleanData(edge));
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
    await updateDoc(
      doc(db, 'follows', edge.id),
      cleanData({
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      })
    );
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
  try {
    await setDoc(doc(db, 'notifications', notif.id), cleanData(notif));
  } catch (error) {
    console.warn('Notification write error:', error);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), cleanData({ read: true }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.update(doc(db, 'notifications', id), cleanData({ read: true })));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

// ========================
// MYDAY (24-HOUR STORIES)
// ========================

export function subscribePublicStories(onUpdate: (stories: MyDayStory[]) => void): Unsubscribe {
  const q = query(collection(db, 'stories'), where('visibility', '==', 'public'), limit(60));
  return onSnapshot(q, (snap) => {
    const items: MyDayStory[] = [];
    snap.forEach((d) => {
      const s = d.data() as MyDayStory;
      if (isStoryActive(s.expiresAt)) items.push(s);
    });
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onUpdate(items);
  });
}

export function subscribeMyStories(
  userId: string,
  onUpdate: (stories: MyDayStory[]) => void
): Unsubscribe {
  const q = query(collection(db, 'stories'), where('userId', '==', userId));
  return onSnapshot(q, (snap) => {
    const active: MyDayStory[] = [];
    const expiredIds: string[] = [];
    snap.forEach((d) => {
      const s = d.data() as MyDayStory;
      if (isStoryActive(s.expiresAt)) active.push(s);
      else expiredIds.push(s.id);
    });
    active.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    onUpdate(active);
    // Automatic owner-side expiry cleanup on open (no Cloud Functions needed)
    if (expiredIds.length > 0) {
      expiredIds.forEach((eid) => {
        deleteDoc(doc(db, 'stories', eid)).catch(() => {});
      });
    }
  });
}

export async function fetchFriendStories(friendIds: string[], myUid: string): Promise<MyDayStory[]> {
  const list: MyDayStory[] = [];
  for (let i = 0; i < friendIds.length; i += 10) {
    const chunk = friendIds.slice(i, i + 10);
    if (chunk.length === 0) continue;
    try {
      const q = query(
        collection(db, 'stories'),
        where('userId', 'in', chunk),
        where('visibility', 'in', ['public', 'friends'])
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const s = d.data() as MyDayStory;
        if (isStoryActive(s.expiresAt)) list.push(s);
      });
    } catch {
      // ignore
    }
  }
  try {
    const closeQ = query(
      collection(db, 'stories'),
      where('closeFriendIds', 'array-contains', myUid)
    );
    const closeSnap = await getDocs(closeQ);
    closeSnap.forEach((d) => {
      const s = d.data() as MyDayStory;
      if (isStoryActive(s.expiresAt) && !list.some((x) => x.id === s.id)) {
        list.push(s);
      }
    });
  } catch {
    // ignore
  }
  return list;
}

export async function getUserActiveStories(
  targetUserId: string,
  isOwner: boolean,
  isFriend: boolean,
  viewerUid: string
): Promise<MyDayStory[]> {
  try {
    const allowed = isOwner
      ? ['public', 'friends', 'close_friends']
      : isFriend
      ? ['public', 'friends']
      : ['public'];
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', targetUserId),
      where('visibility', 'in', allowed)
    );
    const snap = await getDocs(q);
    const out: MyDayStory[] = [];
    snap.forEach((d) => {
      const s = d.data() as MyDayStory;
      if (!isStoryActive(s.expiresAt)) return;
      if (s.visibility === 'close_friends' && !isOwner && !(s.closeFriendIds || []).includes(viewerUid)) {
        return;
      }
      out.push(s);
    });
    return out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function createMyDayStory(story: MyDayStory): Promise<void> {
  const path = `stories/${story.id}`;
  try {
    assertOnlineForWrite('share your MyDay');
    await setDoc(doc(db, 'stories', story.id), cleanData(story));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteMyDayStory(storyId: string): Promise<void> {
  const path = `stories/${storyId}`;
  try {
    await deleteDoc(doc(db, 'stories', storyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeMyStoryViews(
  viewerId: string,
  onUpdate: (viewedStoryIds: Set<string>) => void
): Unsubscribe {
  const q = query(collection(db, 'storyViews'), where('viewerId', '==', viewerId));
  return onSnapshot(q, (snap) => {
    const ids = new Set<string>();
    snap.forEach((d) => {
      const v = d.data() as StoryView;
      if (v.storyId) ids.add(v.storyId);
    });
    onUpdate(ids);
  });
}

export async function recordStoryViewFirestore(view: StoryView): Promise<void> {
  try {
    const ref = doc(db, 'storyViews', view.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, cleanData(view));
      await updateDoc(doc(db, 'stories', view.storyId), { viewCount: increment(1) }).catch(() => {});
    }
  } catch {
    // non-blocking view tracking
  }
}

export async function getStoryViewers(storyId: string): Promise<StoryView[]> {
  try {
    const q = query(collection(db, 'storyViews'), where('storyId', '==', storyId));
    const snap = await getDocs(q);
    const list: StoryView[] = [];
    snap.forEach((d) => list.push(d.data() as StoryView));
    return list.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());
  } catch {
    return [];
  }
}

// ========================
// CHAT: DMs & GROUP CHATS
// ========================

export function subscribeUserConversations(
  userId: string,
  onUpdate: (convs: ChatConversation[]) => void
): Unsubscribe {
  const q = query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId));
  return onSnapshot(q, (snap) => {
    const list: ChatConversation[] = [];
    snap.forEach((d) => list.push(d.data() as ChatConversation));
    list.sort(
      (a, b) =>
        new Date(b.lastMessageAt || b.createdAt).getTime() -
        new Date(a.lastMessageAt || a.createdAt).getTime()
    );
    onUpdate(list);
  });
}

export async function getOrCreateDmConversation(
  convId: string,
  me: ChatParticipantProfile,
  other: ChatParticipantProfile
): Promise<ChatConversation> {
  const path = `conversations/${convId}`;
  try {
    const ref = doc(db, 'conversations', convId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as ChatConversation;
    }
    const now = new Date().toISOString();
    const conv: ChatConversation = cleanData({
      id: convId,
      type: 'dm',
      participantIds: [me.uid, other.uid].sort(),
      participantProfiles: {
        [me.uid]: me,
        [other.uid]: other,
      },
      createdBy: me.uid,
      unreadBy: { [me.uid]: 0, [other.uid]: 0 },
      lastReadAt: { [me.uid]: now },
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(ref, conv);
    return conv;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createGroupConversation(conv: ChatConversation): Promise<void> {
  const path = `conversations/${conv.id}`;
  try {
    await setDoc(doc(db, 'conversations', conv.id), cleanData(conv));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateGroupConversation(
  convId: string,
  updates: Partial<ChatConversation>
): Promise<void> {
  const path = `conversations/${convId}`;
  try {
    await updateDoc(
      doc(db, 'conversations', convId),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leaveConversationFirestore(convId: string, uid: string): Promise<void> {
  const path = `conversations/${convId}`;
  try {
    await updateDoc(
      doc(db, 'conversations', convId),
      cleanData({
        participantIds: arrayRemove(uid),
        adminIds: arrayRemove(uid),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeConversationMessages(
  conversationId: string,
  limitCount: number,
  onUpdate: (messages: ChatMessage[], oldestDoc: QueryDocumentSnapshot<DocumentData> | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatMessage[] = [];
      snap.forEach((d) => list.push(d.data() as ChatMessage));
      const oldest = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      onUpdate(list.reverse(), oldest);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function loadOlderConversationMessages(
  conversationId: string,
  cursor: QueryDocumentSnapshot<DocumentData>,
  pageSize = 30
): Promise<{ messages: ChatMessage[]; oldestDoc: QueryDocumentSnapshot<DocumentData> | null }> {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursor),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  const list: ChatMessage[] = [];
  snap.forEach((d) => list.push(d.data() as ChatMessage));
  const oldest = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { messages: list.reverse(), oldestDoc: oldest };
}

export async function sendConversationMessageFirestore(
  conv: ChatConversation,
  message: ChatMessage
): Promise<void> {
  const path = `conversations/${conv.id}/messages/${message.id}`;
  try {
    await setDoc(doc(db, 'conversations', conv.id, 'messages', message.id), cleanData(message));
    const nextUnread: Record<string, number> = { ...(conv.unreadBy || {}) };
    conv.participantIds.forEach((pid) => {
      if (pid === message.senderId) nextUnread[pid] = 0;
      else nextUnread[pid] = (nextUnread[pid] || 0) + 1;
    });
    const previewText = message.text
      ? message.text.slice(0, 90)
      : message.imageUrl
      ? 'Sent a photo'
      : 'Sent a fit';
    await updateDoc(
      doc(db, 'conversations', conv.id),
      cleanData({
        lastMessageText: previewText,
        lastMessageAt: message.createdAt,
        lastSenderId: message.senderId,
        unreadBy: nextUnread,
        [`typingBy.${message.senderId}`]: '',
        updatedAt: message.createdAt,
      })
    ).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteConversationMessageFirestore(
  conversationId: string,
  messageId: string
): Promise<void> {
  const path = `conversations/${conversationId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function markConversationReadFirestore(conversationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'conversations', conversationId),
      cleanData({
        [`unreadBy.${uid}`]: 0,
        [`lastReadAt.${uid}`]: new Date().toISOString(),
      })
    );
  } catch {
    // non-blocking
  }
}

export async function setConversationTypingFirestore(
  conversationId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'conversations', conversationId),
      cleanData({
        [`typingBy.${uid}`]: isTyping ? new Date().toISOString() : '',
      })
    );
  } catch {
    // non-blocking
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
      await setDoc(doc(db, 'userBlocks', edge.id), cleanData(edge));
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
      await setDoc(doc(db, 'userMutes', edge.id), cleanData(edge));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitReport(report: ContentReport): Promise<void> {
  const path = `reports/${report.id}`;
  try {
    await setDoc(doc(db, 'reports', report.id), cleanData(report));
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
    await setDoc(doc(db, 'shareLinks', link.token), cleanData(link));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateShareLink(token: string, updates: Partial<ShareLink>): Promise<void> {
  const path = `shareLinks/${token}`;
  try {
    await updateDoc(
      doc(db, 'shareLinks', token),
      cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
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
    'stories',
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

  const viewsQ = query(collection(db, 'storyViews'), where('viewerId', '==', uid));
  const viewsSnap = await getDocs(viewsQ);
  for (const d of viewsSnap.docs) {
    await deleteDoc(d.ref);
  }

  const friendQ = query(collection(db, 'friendships'), where('users', 'array-contains', uid));
  const friendSnap = await getDocs(friendQ);
  for (const d of friendSnap.docs) {
    await deleteDoc(d.ref);
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
  await deleteDoc(doc(db, 'userPrivate', uid)).catch(() => {});
  await deleteDoc(doc(db, 'users', uid)).catch(() => {});
}
