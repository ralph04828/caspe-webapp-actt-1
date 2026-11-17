import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ClothingItem,
  Outfit,
  OutfitSchedule,
  UserProfile,
  WishlistItem,
} from '../types';

// User Profile
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
  updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'theme' | 'stylePreference'>>
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

// Generic User Collection Subscription
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

// Wardrobe CRUD
export function subscribeWardrobe(
  userId: string,
  onUpdate: (items: ClothingItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return subscribeCollectionByUser<ClothingItem>('wardrobe', userId, onUpdate, onError);
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

export async function deleteClothingItem(id: string): Promise<void> {
  const path = `wardrobe/${id}`;
  try {
    await deleteDoc(doc(db, 'wardrobe', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Outfits / Lookbook CRUD
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

// Wishlist CRUD
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

// Schedules CRUD
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
