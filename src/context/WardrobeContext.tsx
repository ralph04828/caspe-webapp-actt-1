import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClothingItem,
  LaundryStatus,
  Outfit,
  OutfitSchedule,
  WearLog,
  WishlistItem,
} from '../types';
import { useAuth } from './AuthContext';
import {
  DEMO_OUTFITS,
  DEMO_WARDROBE,
  DEMO_WISHLIST,
  getInitialDemoSchedules,
  getInitialDemoWearLogs,
  getTodayISO,
} from '../data/demoData';
import {
  subscribeWardrobe,
  subscribeOutfits,
  subscribeWishlist,
  subscribeSchedules,
  subscribeWearLogs,
  saveClothingItem,
  updateClothingItem,
  batchMarkWardrobeClean,
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
  saveWearLog,
} from '../services/firestoreService';
import { deleteImageAsset, updateMediaVisibility } from '../services/storageService';
import { cleanData } from '../utils/cleanData';
import { getDefaultSizeForCategory, getSavedShoeSystem } from '../utils/sizing';
import { getOutfitAllItemIds } from '../utils/outfitLayers';

interface DemoStorageState {
  wardrobe: ClothingItem[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  schedules: OutfitSchedule[];
  wearLogs: WearLog[];
}

const DEMO_DATA_KEY = 'swooosh_demo_data_v2';

interface WardrobeContextType {
  wardrobe: ClothingItem[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  schedules: OutfitSchedule[];
  wearLogs: WearLog[];
  loading: boolean;
  isOnline: boolean;

  // Wardrobe & Laundry Actions
  addClothing: (item: Omit<ClothingItem, 'id' | 'userId' | 'createdAt'>) => Promise<ClothingItem>;
  editClothing: (id: string, updates: Partial<ClothingItem>) => Promise<void>;
  removeClothing: (item: ClothingItem) => Promise<void>;
  setLaundryStatus: (id: string, status: LaundryStatus) => Promise<void>;
  markManyClean: (ids: string[]) => Promise<void>;
  logWearForItems: (itemIds: string[], outfitId?: string, date?: string) => Promise<void>;

  // Outfit / Lookbook Actions
  addOutfit: (outfit: Omit<Outfit, 'id' | 'userId' | 'createdAt'>) => Promise<Outfit>;
  editOutfit: (id: string, updates: Partial<Outfit>) => Promise<void>;
  removeOutfit: (outfit: Outfit) => Promise<void>;
  toggleFavoriteOutfit: (outfit: Outfit) => Promise<void>;

  // Wishlist Actions (no prices)
  addWishlist: (item: Omit<WishlistItem, 'id' | 'userId' | 'createdAt'>) => Promise<WishlistItem>;
  editWishlist: (id: string, updates: Partial<WishlistItem>) => Promise<void>;
  removeWishlist: (item: WishlistItem) => Promise<void>;
  markWishlistGotItAndMove: (item: WishlistItem) => Promise<ClothingItem>;

  // Schedule Actions
  assignSchedule: (date: string, outfitId: string, notes?: string) => Promise<void>;
  markScheduleWornToday: (schedule: OutfitSchedule, outfit?: Outfit) => Promise<void>;
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
  const [wearLogs, setWearLogs] = useState<WearLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

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
      setWearLogs([]);
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
          setWearLogs(parsed.wearLogs || getInitialDemoWearLogs());
          setLoading(false);
          return;
        } catch {
          // fall through
        }
      }
      const initial: DemoStorageState = {
        wardrobe: DEMO_WARDROBE,
        outfits: DEMO_OUTFITS,
        wishlist: DEMO_WISHLIST,
        schedules: getInitialDemoSchedules(),
        wearLogs: getInitialDemoWearLogs(),
      };
      setWardrobe(initial.wardrobe);
      setOutfits(initial.outfits);
      setWishlist(initial.wishlist);
      setSchedules(initial.schedules);
      setWearLogs(initial.wearLogs);
      persistDemo(initial);
      setLoading(false);
      return;
    }

    setLoading(true);
    let loadedCount = 0;
    const checkDone = () => {
      loadedCount += 1;
      if (loadedCount >= 5) setLoading(false);
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
    const unsubLogs = subscribeWearLogs(
      userProfile.uid,
      (logs) => {
        setWearLogs(logs);
        checkDone();
      },
      () => checkDone()
    );

    return () => {
      unsubW();
      unsubO();
      unsubWish();
      unsubS();
      unsubLogs();
    };
  }, [userProfile?.uid, isDemoMode]);

  const resetDemoData = () => {
    if (!isDemoMode) return;
    const initial: DemoStorageState = {
      wardrobe: DEMO_WARDROBE,
      outfits: DEMO_OUTFITS,
      wishlist: DEMO_WISHLIST,
      schedules: getInitialDemoSchedules(),
      wearLogs: getInitialDemoWearLogs(),
    };
    setWardrobe(initial.wardrobe);
    setOutfits(initial.outfits);
    setWishlist(initial.wishlist);
    setSchedules(initial.schedules);
    setWearLogs(initial.wearLogs);
    persistDemo(initial);
  };

  // Wardrobe CRUD
  const addClothing = async (input: Omit<ClothingItem, 'id' | 'userId' | 'createdAt'>) => {
    if (!userProfile) throw new Error('Not authenticated');
    const newItem: ClothingItem = cleanData({
      ...input,
      id: createId('item'),
      userId: userProfile.uid,
      wearCount: input.wearCount ?? 0,
      laundryStatus: input.laundryStatus ?? 'clean',
      visibility: input.visibility ?? userProfile.defaultItemVisibility ?? 'public',
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const nextW = [newItem, ...wardrobe];
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules, wearLogs });
    } else {
      await saveClothingItem(newItem);
    }
    return newItem;
  };

  const editClothing = async (id: string, updates: Partial<ClothingItem>) => {
    const existing = wardrobe.find((item) => item.id === id);
    const targetMediaId = updates.mediaId ?? existing?.mediaId;
    if (updates.visibility && targetMediaId) {
      await updateMediaVisibility(targetMediaId, updates.visibility);
    }
    if (updates.mediaId && existing?.mediaId && updates.mediaId !== existing.mediaId) {
      deleteImageAsset(existing.mediaId).catch(() => {});
    }

    if (isDemoMode) {
      const nextW = wardrobe.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules, wearLogs });
    } else {
      await updateClothingItem(id, updates);
    }
  };

  const removeClothing = async (item: ClothingItem) => {
    await deleteImageAsset(item.mediaId);
    if (isDemoMode) {
      const nextW = wardrobe.filter((w) => w.id !== item.id);
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules, wearLogs });
    } else {
      await deleteClothingItem(item.id);
    }
  };

  const setLaundryStatus = async (id: string, status: LaundryStatus) => {
    await editClothing(id, { laundryStatus: status });
  };

  const markManyClean = async (ids: string[]) => {
    if (ids.length === 0) return;
    const setIds = new Set(ids);
    if (isDemoMode) {
      const nextW = wardrobe.map((item) =>
        setIds.has(item.id)
          ? { ...item, laundryStatus: 'clean' as LaundryStatus, updatedAt: new Date().toISOString() }
          : item
      );
      setWardrobe(nextW);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules, wearLogs });
    } else {
      await batchMarkWardrobeClean(ids);
    }
  };

  const logWearForItems = async (itemIds: string[], outfitId?: string, date = getTodayISO()) => {
    if (!userProfile || itemIds.length === 0) return;
    const uniqueIds = Array.from(new Set(itemIds));
    const autoDirty = Boolean(userProfile.autoDirtyOnWear);
    const log: WearLog = cleanData({
      id: createId('wear'),
      userId: userProfile.uid,
      date,
      itemIds: uniqueIds,
      outfitId,
      createdAt: new Date().toISOString(),
    });

    if (isDemoMode) {
      const setIds = new Set(uniqueIds);
      const nextW = wardrobe.map((w) =>
        setIds.has(w.id)
          ? {
              ...w,
              wearCount: (w.wearCount || 0) + 1,
              lastWornAt: date,
              laundryStatus: autoDirty ? ('dirty' as LaundryStatus) : w.laundryStatus,
            }
          : w
      );
      const nextLogs = [log, ...wearLogs];
      setWardrobe(nextW);
      setWearLogs(nextLogs);
      persistDemo({ wardrobe: nextW, outfits, wishlist, schedules, wearLogs: nextLogs });
    } else {
      await saveWearLog(log);
      for (const id of uniqueIds) {
        const item = wardrobe.find((w) => w.id === id);
        if (item) {
          await updateClothingItem(id, {
            wearCount: (item.wearCount || 0) + 1,
            lastWornAt: date,
            ...(autoDirty ? { laundryStatus: 'dirty' } : {}),
          });
        }
      }
    }
  };

  // Outfit / Lookbook CRUD
  const addOutfit = async (input: Omit<Outfit, 'id' | 'userId' | 'createdAt'>) => {
    if (!userProfile) throw new Error('Not authenticated');
    const newOutfit: Outfit = cleanData({
      ...input,
      id: createId('outfit'),
      userId: userProfile.uid,
      visibility: input.visibility ?? userProfile.defaultOutfitVisibility ?? 'public',
      allowRemix: input.allowRemix !== false,
      createdAt: new Date().toISOString(),
    });
    if (isDemoMode) {
      const nextO = [newOutfit, ...outfits];
      setOutfits(nextO);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules, wearLogs });
    } else {
      await saveOutfit(newOutfit);
    }
    return newOutfit;
  };

  const editOutfit = async (id: string, updates: Partial<Outfit>) => {
    const existing = outfits.find((o) => o.id === id);
    const targetMediaId = updates.mediaId ?? existing?.mediaId;
    if (updates.visibility && targetMediaId) {
      await updateMediaVisibility(targetMediaId, updates.visibility);
    }

    if (isDemoMode) {
      const nextO = outfits.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      );
      setOutfits(nextO);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules, wearLogs });
    } else {
      await updateOutfit(id, updates);
    }
  };

  const removeOutfit = async (outfit: Outfit) => {
    if (outfit.mediaId && !wardrobe.some((w) => w.mediaId === outfit.mediaId)) {
      await deleteImageAsset(outfit.mediaId);
    }
    if (isDemoMode) {
      const nextO = outfits.filter((o) => o.id !== outfit.id);
      const nextS = schedules.filter((s) => s.outfitId !== outfit.id);
      setOutfits(nextO);
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits: nextO, wishlist, schedules: nextS, wearLogs });
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
    const newItem: WishlistItem = cleanData({
      ...input,
      id: createId('wish'),
      userId: userProfile.uid,
      visibility: input.visibility ?? 'private',
      status: input.status ?? 'wanted',
      createdAt: new Date().toISOString(),
    });
    if (isDemoMode) {
      const nextWish = [newItem, ...wishlist];
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules, wearLogs });
    } else {
      await saveWishlistItem(newItem);
    }
    return newItem;
  };

  const editWishlist = async (id: string, updates: Partial<WishlistItem>) => {
    const existing = wishlist.find((w) => w.id === id);
    const targetMediaId = updates.mediaId ?? existing?.mediaId;
    if (updates.visibility && targetMediaId) {
      await updateMediaVisibility(targetMediaId, updates.visibility);
    }

    if (isDemoMode) {
      const nextWish = wishlist.map((w) =>
        w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      );
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules, wearLogs });
    } else {
      await updateWishlistItem(id, updates);
    }
  };

  const removeWishlist = async (item: WishlistItem) => {
    await deleteImageAsset(item.mediaId);
    if (isDemoMode) {
      const nextWish = wishlist.filter((w) => w.id !== item.id);
      setWishlist(nextWish);
      persistDemo({ wardrobe, outfits, wishlist: nextWish, schedules, wearLogs });
    } else {
      await deleteWishlistItem(item.id);
    }
  };

  const markWishlistGotItAndMove = async (item: WishlistItem) => {
    const targetVisibility = userProfile?.defaultItemVisibility ?? 'public';
    if (item.mediaId && item.visibility !== targetVisibility) {
      await updateMediaVisibility(item.mediaId, targetVisibility);
    }

    // Transfer ownership of mediaId to the new wardrobe garment so deleting the wishlist entry later never deletes the wardrobe photo
    await editWishlist(item.id, { status: 'got_it', mediaId: '' });
    const targetCategory = (item.category as any) || 'Other';
    const shoeSys = getSavedShoeSystem(userProfile?.uid);
    const { size: defaultSizeVal, sizeSystem: defaultSizeSystem } = getDefaultSizeForCategory(
      targetCategory,
      shoeSys
    );
    const created = await addClothing({
      name: item.name,
      category: targetCategory,
      brand: item.brand,
      color: item.colorTags[0] || 'Neutral',
      size: defaultSizeVal,
      ...(defaultSizeSystem ? { sizeSystem: defaultSizeSystem } : {}),
      seasons: ['All-Season'],
      styleTags: item.styleTags || [],
      description: item.notes,
      altText: `${item.colorTags[0] || ''} ${item.brand} ${item.name}`.trim(),
      visibility: targetVisibility,
      laundryStatus: 'clean',
      imageUrl: item.imageUrl,
      thumbUrl: item.thumbUrl,
      mediaId: item.mediaId,
      wearCount: 0,
    });
    return created;
  };

  // Schedule CRUD
  const assignSchedule = async (date: string, outfitId: string, notes = '') => {
    if (!userProfile) throw new Error('Not authenticated');
    const existing = schedules.find((s) => s.date === date);
    if (existing) {
      if (isDemoMode) {
        const nextS = schedules.map((s) =>
          s.id === existing.id
            ? { ...s, outfitId, notes, wornConfirmed: false, updatedAt: new Date().toISOString() }
            : s
        );
        setSchedules(nextS);
        persistDemo({ wardrobe, outfits, wishlist, schedules: nextS, wearLogs });
      } else {
        await updateSchedule(existing.id, { outfitId, notes, wornConfirmed: false });
      }
      return;
    }

    const newSched: OutfitSchedule = {
      id: createId('sched'),
      userId: userProfile.uid,
      date,
      outfitId,
      notes,
      wornConfirmed: false,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      const nextS = [newSched, ...schedules];
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits, wishlist, schedules: nextS, wearLogs });
    } else {
      await saveSchedule(newSched);
    }
  };

  const markScheduleWornToday = async (schedule: OutfitSchedule, outfit?: Outfit) => {
    const ids = outfit ? getOutfitAllItemIds(outfit) : [];
    if (ids.length > 0) {
      await logWearForItems(ids, outfit?.id, schedule.date);
    }
    if (isDemoMode) {
      const nextS = schedules.map((s) =>
        s.id === schedule.id ? { ...s, wornConfirmed: true, wornAt: new Date().toISOString() } : s
      );
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits, wishlist, schedules: nextS, wearLogs });
    } else {
      await updateSchedule(schedule.id, { wornConfirmed: true, wornAt: new Date().toISOString() });
    }
  };

  const removeSchedule = async (scheduleId: string) => {
    if (isDemoMode) {
      const nextS = schedules.filter((s) => s.id !== scheduleId);
      setSchedules(nextS);
      persistDemo({ wardrobe, outfits, wishlist, schedules: nextS, wearLogs });
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
        wearLogs,
        loading,
        isOnline,
        addClothing,
        editClothing,
        removeClothing,
        setLaundryStatus,
        markManyClean,
        logWearForItems,
        addOutfit,
        editOutfit,
        removeOutfit,
        toggleFavoriteOutfit,
        addWishlist,
        editWishlist,
        removeWishlist,
        markWishlistGotItAndMove,
        assignSchedule,
        markScheduleWornToday,
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
