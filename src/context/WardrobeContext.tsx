import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClothingItem,
  Outfit,
  OutfitSchedule,
  WishlistItem,
} from '../types';
import { useAuth } from './AuthContext';
import {
  DEMO_OUTFITS,
  DEMO_WARDROBE,
  DEMO_WISHLIST,
  getInitialDemoSchedules,
} from '../data/demoData';
import {
  subscribeWardrobe,
  subscribeOutfits,
  subscribeWishlist,
  subscribeSchedules,
  saveClothingItem,
  updateClothingItem,
  deleteClothingItem,
  saveOutfit,
  updateOutfit,
  deleteOutfit,
  saveWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  saveSchedule,
  updateSchedule,
  deleteSchedule,
} from '../services/firestoreService';
import { deleteImageAsset } from '../services/storageService';

interface DemoStorageState {
  wardrobe: ClothingItem[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  schedules: OutfitSchedule[];
}

const DEMO_DATA_KEY = 'swooosh_demo_data_v1';

interface WardrobeContextType {
  wardrobe: ClothingItem[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  schedules: OutfitSchedule[];
  loading: boolean;

  // Wardrobe Actions
  addClothing: (item: Omit<ClothingItem, 'id' | 'userId' | 'createdAt'>) => Promise<ClothingItem>;
  editClothing: (id: string, updates: Partial<ClothingItem>) => Promise<void>;
  removeClothing: (item: ClothingItem) => Promise<void>;
  logWear: (id: string) => Promise<void>;

  // Outfit / Lookbook Actions
  addOutfit: (outfit: Omit<Outfit, 'id' | 'userId' | 'createdAt'>) => Promise<Outfit>;
  editOutfit: (id: string, updates: Partial<Outfit>) => Promise<void>;
  removeOutfit: (outfit: Outfit) => Promise<void>;
  toggleFavoriteOutfit: (outfit: Outfit) => Promise<void>;

  // Wishlist Actions
  addWishlist: (item: Omit<WishlistItem, 'id' | 'userId' | 'createdAt'>) => Promise<WishlistItem>;
  editWishlist: (id: string, updates: Partial<WishlistItem>) => Promise<void>;
  removeWishlist: (item: WishlistItem) => Promise<void>;
  togglePurchasedWishlist: (item: WishlistItem) => Promise<void>;

  // Schedule Actions
  assignSchedule: (date: string, outfitId: string, notes?: string) => Promise<void>;
  removeSchedule: (scheduleId: string) => Promise<void>;

  // Demo Utility
  resetDemoData: () => void;
}

const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const WardrobeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isDemoMode } = useAuth();

  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [schedules, setSchedules] = useState<OutfitSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const persistDemo = (next: DemoStorageState) => {
    try {
      localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  useEffect(() => {
    if (!userProfile) {
      setWardrobe([]);
      setOutfits([]);
      setWishlist([]);
      setSchedules([]);
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      setLoading(true);
      const raw = localStorage.getItem(DEMO_DATA_KEY);
      if (raw) {
        try {
          const parsed: DemoStorageState = JSON.parse(raw);
          setWardrobe(parsed.wardrobe || DEMO_WARDROBE);
          setOutfits(parsed.outfits || DEMO_OUTFITS);
          setWishlist(parsed.wishlist || DEMO_WISHLIST);
          setSchedules(parsed.schedules || getInitialDemoSchedules());
          setLoading(false);
          return;
        } catch {
          // fall through to defaults
        }
      }
      const initial: DemoStorageState = {
        wardrobe: DEMO_WARDROBE,
        outfits: DEMO_OUTFITS,
        wishlist: DEMO_WISHLIST,
        schedules: getInitialDemoSchedules(),
      };
      setWardrobe(initial.wardrobe);
      setOutfits(initial.outfits);
      setWishlist(initial.wishlist);
      setSchedules(initial.schedules);
      persistDemo(initial);
      setLoading(false);
      return;
    }

    // Real Firebase Firestore Subscriptions
    setLoading(true);
    let loadedCount = 0;
    const checkDone = () => {
      loadedCount += 1;
      if (loadedCount >= 4) setLoading(false);
    };

    const unsubW = subscribeWardrobe(
      userProfile.uid,
      (items) => {
        setWardrobe(items);
        checkDone();
      },
      () => checkDone()
    );
    const unsubO = subscribeOutfits(
      userProfile.uid,
      (items) => {
        setOutfits(items);
        checkDone();
      },
      () => checkDone()
    );
    const unsubWish = subscribeWishlist(
      userProfile.uid,
      (items) => {
        setWishlist(items);
        checkDone();
      },
      () => checkDone()
    );
    const unsubS = subscribeSchedules(
      userProfile.uid,
      (items) => {
        setSchedules(items);
        checkDone();
      },
      () => checkDone()
    );

    return () => {
      unsubW();
      unsubO();
      unsubWish();
      unsubS();
    };
  }, [userProfile?.uid, isDemoMode]);

  const resetDemoData = () => {
    if (!isDemoMode) return;
    const initial: DemoStorageState = {
      wardrobe: DEMO_WARDROBE,
      outfits: DEMO_OUTFITS,
      wishlist: DEMO_WISHLIST,
      schedules: getInitialDemoSchedules(),
    };
    setWardrobe(initial.wardrobe);
    setOutfits(initial.outfits);
    setWishlist(initial.wishlist);
    setSchedules(initial.schedules);
    persistDemo(initial);
  };

  // Wardrobe CRUD
  const addClothing = async (input: Omit<ClothingItem, 'id' | 'userId' | 'createdAt'>) => {
    if (!userProfile) throw new Error('Not authenticated');
    const newItem: ClothingItem = {
      ...input,
      id: createId('item'),
      userId: userProfile.uid,
      wearCount: input.wearCount ?? 0,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextW = [newItem, ...wardrobe];
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules });
    } else {
      await saveClothingItem(newItem);
    }
    return newItem;
  };

  const editClothing = async (id: string, updates: Partial<ClothingItem>) => {
    if (isDemoMode) {
      const nextW = wardrobe.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules });
    } else {
      await updateClothingItem(id, updates);
    }
  };

  const removeClothing = async (item: ClothingItem) => {
    await deleteImageAsset(item.storagePath);
    if (isDemoMode) {
      const nextW = wardrobe.filter((w) => w.id !== item.id);
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules });
    } else {
      await deleteClothingItem(item.id);
    }
  };

  const logWear = async (id: string) => {
    const existing = wardrobe.find((w) => w.id === id);
    if (!existing) return;
    await editClothing(id, {
      wearCount: (existing.wearCount || 0) + 1,
      lastWornAt: new Date().toISOString().split('T')[0],
    });
  };

  // Outfit / Lookbook CRUD
  const addOutfit = async (input: Omit<Outfit, 'id' | 'userId' | 'createdAt'>) => {
    if (!userProfile) throw new Error('Not authenticated');
    const newOutfit: Outfit = {
      ...input,
      id: createId('outfit'),
      userId: userProfile.uid,
      createdAt: new Date().toISOString(),
    };
    if (isDemoMode) {
      const nextO = [newOutfit, ...outfits];
      setOutfits(nextO);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules });
    } else {
      await saveOutfit(newOutfit);
    }
    return newOutfit;
  };

  const editOutfit = async (id: string, updates: Partial<Outfit>) => {
    if (isDemoMode) {
      const nextO = outfits.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      );
      setOutfits(nextO);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules });
    } else {
      await updateOutfit(id, updates);
    }
  };

  const removeOutfit = async (outfit: Outfit) => {
    await deleteImageAsset(outfit.storagePath);
    if (isDemoMode) {
      const nextO = outfits.filter((o) => o.id !== outfit.id);
      const nextS = schedules.filter((s) => s.outfitId !== outfit.id);
      setOutfits(nextO);
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules: nextS });
    } else {
      await deleteOutfit(outfit.id);
    }
  };

  const toggleFavoriteOutfit = async (outfit: Outfit) => {
    await editOutfit(outfit.id, { isFavorite: !outfit.isFavorite });
  };

  // Wishlist CRUD
  const addWishlist = async (input: Omit<WishlistItem, 'id' | 'userId' | 'createdAt'>) => {
    if (!userProfile) throw new Error('Not authenticated');
    const newItem: WishlistItem = {
      ...input,
      id: createId('wish'),
      userId: userProfile.uid,
      createdAt: new Date().toISOString(),
    };
    if (isDemoMode) {
      const nextWish = [newItem, ...wishlist];
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules });
    } else {
      await saveWishlistItem(newItem);
    }
    return newItem;
  };

  const editWishlist = async (id: string, updates: Partial<WishlistItem>) => {
    if (isDemoMode) {
      const nextWish = wishlist.map((w) =>
        w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      );
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules });
    } else {
      await updateWishlistItem(id, updates);
    }
  };

  const removeWishlist = async (item: WishlistItem) => {
    await deleteImageAsset(item.storagePath);
    if (isDemoMode) {
      const nextWish = wishlist.filter((w) => w.id !== item.id);
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules });
    } else {
      await deleteWishlistItem(item.id);
    }
  };

  const togglePurchasedWishlist = async (item: WishlistItem) => {
    await editWishlist(item.id, { isPurchased: !item.isPurchased });
  };

  // Schedule CRUD
  const assignSchedule = async (date: string, outfitId: string, notes = '') => {
    if (!userProfile) throw new Error('Not authenticated');
    const existing = schedules.find((s) => s.date === date);
    if (existing) {
      if (isDemoMode) {
        const nextS = schedules.map((s) =>
          s.id === existing.id ? { ...s, outfitId, notes, updatedAt: new Date().toISOString() } : s
        );
        setSchedules(nextS);
        persistDemo({ wardrobe, outfits, wishlist, schedules: nextS });
      } else {
        await updateSchedule(existing.id, { outfitId, notes });
      }
      return;
    }

    const newSched: OutfitSchedule = {
      id: createId('sched'),
      userId: userProfile.uid,
      date,
      outfitId,
      notes,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextS = [newSched, ...schedules];
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits, wishlist, schedules: nextS });
    } else {
      await saveSchedule(newSched);
    }
  };

  const removeSchedule = async (scheduleId: string) => {
    if (isDemoMode) {
      const nextS = schedules.filter((s) => s.id !== scheduleId);
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits, wishlist, schedules: nextS });
    } else {
      await deleteSchedule(scheduleId);
    }
  };

  return (
    <WardrobeContext.Provider
      value={{
        wardrobe,
        outfits,
        wishlist,
        schedules,
        loading,
        addClothing,
        editClothing,
        removeClothing,
        logWear,
        addOutfit,
        editOutfit,
        removeOutfit,
        toggleFavoriteOutfit,
        addWishlist,
        editWishlist,
        removeWishlist,
        togglePurchasedWishlist,
        assignSchedule,
        removeSchedule,
        resetDemoData,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
};

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error('useWardrobe must be used within WardrobeProvider');
  return ctx;
}
