import React, { useEffect, useMemo, useState } from 'react';
import {
  ACCESSORY_CATEGORIES,
  BOTTOM_CATEGORIES,
  ClothingItem,
  NavSection,
  Outfit,
  SEASON_TAGS,
  SHOE_CATEGORIES,
  STYLE_CATEGORIES,
  SeasonTag,
  SocialPost,
  TOP_CATEGORIES,
  Visibility,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import {
  MAX_OUTFIT_ACCESSORIES,
  MAX_TOP_LAYERS,
  getOutfitAccessoryIds,
  getOutfitTopIds,
  getTopLayerLabels,
} from '../utils/outfitLayers';
import { dedupeStyleTags } from '../utils/styleTags';
import { GarmentImage } from './GarmentImage';
import { StyleTagSelector } from './StyleTagSelector';
import { ErrorBoundary } from './ErrorBoundary';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Repeat,
  Save,
  Share2,
  X,
} from 'lucide-react';

interface FitBuilderPageProps {
  editingOutfit: Outfit | null;
  remixSourcePost?: SocialPost | null;
  onClearEditingOutfit: () => void;
  onClearRemixSource?: () => void;
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const FitBuilderPage: React.FC<FitBuilderPageProps> = ({
  editingOutfit,
  remixSourcePost,
  onClearEditingOutfit,
  onClearRemixSource,
  onNavigate,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe, addOutfit, editOutfit } = useWardrobe();
  const { publishPost } = useSocial();

  const [name, setName] = useState('');
  const [styleCategory, setStyleCategory] = useState<string>('Streetwear');
  const [occasion, setOccasion] = useState('Studio / Daily');
  const [seasons, setSeasons] = useState<SeasonTag[]>(['All-Season']);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(userProfile?.defaultOutfitVisibility || 'public');
  const [allowRemix, setAllowRemix] = useState(true);

  const [topIds, setTopIds] = useState<string[]>([]);
  const [bottomId, setBottomId] = useState<string>('');
  const [shoesId, setShoesId] = useState<string>('');
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);
  const [dragTopIndex, setDragTopIndex] = useState<number | null>(null);

  const [includeDirty, setIncludeDirty] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSlot, setSwapSlot] = useState<'top' | 'bottom' | 'shoes'>('top');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Save & Share confirmation modal (caption starts completely empty & optional)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [shareVisibility, setShareVisibility] = useState<Visibility>(
    userProfile?.defaultOutfitVisibility || 'public'
  );

  useEffect(() => {
    if (editingOutfit) {
      setName(editingOutfit.name);
      setStyleCategory(editingOutfit.styleCategory);
      setOccasion(editingOutfit.occasion || '');
      setSeasons(editingOutfit.seasons?.length ? editingOutfit.seasons : ['All-Season']);
      setDescription(editingOutfit.description || '');
      setVisibility(editingOutfit.visibility || 'public');
      setAllowRemix(editingOutfit.allowRemix !== false);
      setTopIds(getOutfitTopIds(editingOutfit));
      setBottomId(editingOutfit.bottomId || '');
      setShoesId(editingOutfit.shoesId || '');
      setAccessoryIds(getOutfitAccessoryIds(editingOutfit));
    } else if (remixSourcePost) {
      setName(`Remix: ${remixSourcePost.occasion || remixSourcePost.styleTags?.[0] || 'Daily Fit'}`);
      setStyleCategory(remixSourcePost.styleTags?.[0] || 'Streetwear');
      setOccasion(remixSourcePost.occasion || 'Remixed Fit');
      setDescription(`Remixed from @${remixSourcePost.authorUsername}`);
      const clean = wardrobe.filter((w) => w.laundryStatus === 'clean');
      const pool = clean.length > 0 ? clean : wardrobe;
      const firstTop = pool.find((i) => TOP_CATEGORIES.includes(i.category));
      const firstBot = pool.find((i) => BOTTOM_CATEGORIES.includes(i.category));
      const firstShoe = pool.find((i) => SHOE_CATEGORIES.includes(i.category));
      setTopIds(firstTop ? [firstTop.id] : []);
      setBottomId(firstBot?.id || '');
      setShoesId(firstShoe?.id || '');
      setAccessoryIds([]);
    }
  }, [editingOutfit, remixSourcePost]);

  const availablePool = useMemo(() => {
    return includeDirty ? wardrobe : wardrobe.filter((w) => w.laundryStatus === 'clean');
  }, [wardrobe, includeDirty]);

  const tops = availablePool.filter((i) => TOP_CATEGORIES.includes(i.category));
  const bottoms = availablePool.filter((i) => BOTTOM_CATEGORIES.includes(i.category));
  const shoes = availablePool.filter((i) => SHOE_CATEGORIES.includes(i.category));
  const accessories = availablePool.filter((i) => ACCESSORY_CATEGORIES.includes(i.category));

  const findItem = (id?: string): ClothingItem | undefined => wardrobe.find((w) => w.id === id);
  const selectedTops = topIds.map(findItem).filter(Boolean) as ClothingItem[];
  const topLayerLabels = useMemo(() => getTopLayerLabels(selectedTops.length), [selectedTops.length]);
  const selectedBottom = findItem(bottomId);
  const selectedShoes = findItem(shoesId);
  const selectedAccessories = accessoryIds.map(findItem).filter(Boolean) as ClothingItem[];

  const dirtyWarnings = [...selectedTops, selectedBottom, selectedShoes, ...selectedAccessories]
    .filter((i): i is ClothingItem => Boolean(i && i.laundryStatus !== 'clean'));

  const swapCandidates = swapSlot === 'top' ? tops : swapSlot === 'bottom' ? bottoms : shoes;

  const handleManualSwapPick = (itemId: string) => {
    if (swapSlot === 'top') {
      setTopIds((prev) => {
        if (prev.length === 0) return [itemId];
        if (prev.includes(itemId)) return prev;
        return [...prev.slice(0, -1), itemId];
      });
    } else if (swapSlot === 'bottom') {
      setBottomId(itemId);
    } else {
      setShoesId(itemId);
    }
    setSwapOpen(false);
    onToast(`Swapped ${swapSlot} piece.`);
  };

  const toggleTopLayer = (itemId: string) => {
    setFormError(null);
    setTopIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= MAX_TOP_LAYERS) {
        onToast(`You can layer up to ${MAX_TOP_LAYERS} tops per outfit.`, 'error');
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const moveTopLayer = (fromIndex: number, toIndex: number) => {
    setTopIds((prev) => {
      if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const toggleAccessory = (itemId: string) => {
    setFormError(null);
    setAccessoryIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= MAX_OUTFIT_ACCESSORIES) {
        onToast(`You can select up to ${MAX_OUTFIT_ACCESSORIES} accessories per outfit.`, 'error');
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const validateBuilder = (): boolean => {
    setFormError(null);
    if (!name.trim()) {
      const msg = 'Give this outfit a name first.';
      setFormError(msg);
      onToast(msg, 'error');
      return false;
    }
    if (topIds.length === 0 && !bottomId && !shoesId && accessoryIds.length === 0) {
      const msg = 'Select at least one garment for your fit.';
      setFormError(msg);
      onToast(msg, 'error');
      return false;
    }
    return true;
  };

  const buildOutfitPayload = () => {
    const cleanTops = topIds.slice(0, MAX_TOP_LAYERS);
    const cleanAccs = accessoryIds.slice(0, MAX_OUTFIT_ACCESSORIES);
    const cleanStyle = styleCategory.trim() || 'Streetwear';
    return {
      name: name.trim(),
      styleCategory: cleanStyle,
      occasion: occasion.trim(),
      seasons,
      tags: dedupeStyleTags([cleanStyle]),
      description: description.trim(),
      topIds: cleanTops,
      topId: cleanTops[0] || undefined,
      bottomId: bottomId || undefined,
      shoesId: shoesId || undefined,
      accessoryIds: cleanAccs,
      coverImageUrl:
        selectedTops[selectedTops.length - 1]?.imageUrl ||
        selectedTops[0]?.imageUrl ||
        selectedBottom?.imageUrl ||
        selectedShoes?.imageUrl ||
        selectedAccessories[0]?.imageUrl,
      visibility,
      allowRemix,
      remixedFrom: remixSourcePost
        ? {
            postId: remixSourcePost.id,
            outfitId: remixSourcePost.outfitId,
            userId: remixSourcePost.userId,
            username: remixSourcePost.authorUsername,
            displayName: remixSourcePost.authorName,
          }
        : undefined,
      isFavorite: editingOutfit?.isFavorite || false,
      source: remixSourcePost ? ('remix' as const) : ('builder' as const),
    };
  };

  const persistOutfit = async () => {
    const payload = buildOutfitPayload();
    let saved: Outfit;
    if (editingOutfit) {
      await editOutfit(editingOutfit.id, payload);
      saved = { ...editingOutfit, ...payload };
      onClearEditingOutfit();
    } else {
      saved = await addOutfit(payload);
    }
    return { saved, payload };
  };

  const handleSaveLookbookOnly = async () => {
    if (!validateBuilder()) return;
    setSaving(true);
    try {
      await persistOutfit();
      onToast('Saved to My Lookbook.');
      onClearRemixSource?.();
      onNavigate('lookbook');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save outfit. Your selection is preserved.';
      console.error('FitBuilder save failed:', err);
      setFormError(msg);
      onToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenShareModal = () => {
    if (!validateBuilder()) return;
    setShareCaption('');
    setShareVisibility(visibility);
    setShareModalOpen(true);
  };

  const handleConfirmSaveAndShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const { saved, payload } = await persistOutfit();
      await publishPost({
        postType: 'outfit',
        title: saved.name,
        caption: shareCaption.trim(),
        visibility: shareVisibility,
        allowRemix,
        commentPolicy: 'everyone',
        outfit: saved,
        wardrobe,
        occasion: saved.occasion,
        styleTags: dedupeStyleTags([saved.styleCategory]),
        remixedFrom: payload.remixedFrom,
      });
      setShareModalOpen(false);
      onToast('Saved to My Lookbook and shared to Feed!');
      onClearRemixSource?.();
      onNavigate('home');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save and share outfit. Your draft is preserved.';
      console.error('FitBuilder save & share failed:', err);
      setFormError(msg);
      onToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary title="Fit Builder ran into an issue" onReset={() => setFormError(null)}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Fit Builder</h1>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              Layer up to 5 tops (inner to outer), pair bottoms, footwear, and up to 8 accessories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeDirty}
                onChange={(e) => setIncludeDirty(e.target.checked)}
                className="accent-[#171717] dark:accent-[#e5e1da]"
              />
              <span>Include dirty / washing items</span>
            </label>
            <button
              type="button"
              onClick={() => setSwapOpen((v) => !v)}
              className="px-4 py-2 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Swap One Piece</span>
            </button>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {remixSourcePost && (
          <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <Repeat className="w-4 h-4 shrink-0" />
              <span>
                Remixing <strong>@{remixSourcePost.authorUsername}</strong>&rsquo;s fit with your own wardrobe pieces.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onClearRemixSource?.()}
              aria-label="Clear remix source"
              className="p-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {dirtyWarnings.length > 0 && (
          <div
            role="status"
            className="p-3.5 rounded-control border border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Heads up: {dirtyWarnings.map((d) => `${d.name} (${d.laundryStatus})`).join(', ')} currently marked as needing laundry.
            </span>
          </div>
        )}

        {swapOpen && (
          <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Swap One Piece</p>
                <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">
                  Pick a slot to swap in a piece from your wardrobe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSwapOpen(false)}
                aria-label="Close swap picker"
                className="p-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              {(['top', 'bottom', 'shoes'] as const).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSwapSlot(slot)}
                  className={`px-3 py-1.5 rounded-chip text-xs font-semibold capitalize border cursor-pointer ${
                    swapSlot === slot
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040]'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            {swapCandidates.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                No {swapSlot} items available in your clean wardrobe pool.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                {swapCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleManualSwapPick(cand.id)}
                    className="p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] text-left cursor-pointer"
                  >
                    <div className="aspect-square rounded-chip overflow-hidden bg-[#eae7e0] dark:bg-[#171717] mb-1.5">
                      <GarmentImage
                        src={cand.thumbUrl || cand.imageUrl}
                        mediaId={cand.mediaId}
                        alt={cand.name}
                        isCutout={cand.isCutout}
                      />
                    </div>
                    <p className="text-[11px] font-semibold truncate">{cand.name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Visual Preview Canvas */}
          <section className="lg:col-span-5 p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm uppercase tracking-wider">
                Outfit Canvas
              </h2>
              <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                {selectedTops.length}/{MAX_TOP_LAYERS} top layers · {selectedAccessories.length}/{MAX_OUTFIT_ACCESSORIES} acc
              </span>
            </div>

            {/* Top Layers Stack (Inner to Outer) */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                Top Layers (Inner → Outer)
              </p>
              {selectedTops.length === 0 ? (
                <div className="p-4 rounded-card border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/70 dark:bg-[#171717]/70 text-center text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                  Pick 1 to {MAX_TOP_LAYERS} tops/jackets on the right to layer your look.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedTops.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragTopIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragTopIndex !== null) {
                          moveTopLayer(dragTopIndex, idx);
                          setDragTopIndex(null);
                        }
                      }}
                      onDragEnd={() => setDragTopIndex(null)}
                      className="flex items-center gap-2.5 p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-[#4e4c46] dark:text-[#b0b0b0] shrink-0 cursor-grab" />
                      <div className="w-11 h-11 rounded-chip overflow-hidden bg-white dark:bg-[#242424] shrink-0">
                        <GarmentImage
                          src={item.thumbUrl || item.imageUrl}
                          mediaId={item.mediaId}
                          alt={item.altText || item.name}
                          isCutout={item.isCutout}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                          {topLayerLabels[idx] || `Layer ${idx + 1}`}
                        </p>
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveTopLayer(idx, idx - 1)}
                          aria-label={`Move ${item.name} inward`}
                          className="w-7 h-7 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedTops.length - 1}
                          onClick={() => moveTopLayer(idx, idx + 1)}
                          aria-label={`Move ${item.name} outward`}
                          className="w-7 h-7 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTopLayer(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="w-7 h-7 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center text-red-600 dark:text-red-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom + Footwear + Accessories Preview */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Bottom', item: selectedBottom },
                { label: 'Footwear', item: selectedShoes },
              ].map((slot) => (
                <div
                  key={slot.label}
                  className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] overflow-hidden"
                >
                  <div className="aspect-square">
                    <GarmentImage
                      src={slot.item?.thumbUrl || slot.item?.imageUrl}
                      mediaId={slot.item?.mediaId}
                      alt={slot.item?.altText || slot.label}
                      fallbackLabel={slot.item ? slot.item.name : `No ${slot.label}`}
                      isCutout={slot.item?.isCutout}
                    />
                  </div>
                  <div className="p-2 border-t border-[#d4cfc5] dark:border-[#404040]">
                    <p className="text-[10px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                      {slot.label}
                    </p>
                    <p className="text-xs font-semibold truncate">
                      {slot.item ? slot.item.name : 'Empty slot'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {selectedAccessories.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                  Accessories ({selectedAccessories.length}/{MAX_OUTFIT_ACCESSORIES})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAccessories.map((acc) => (
                    <span
                      key={acc.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-[11px] font-medium"
                    >
                      <span>{acc.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleAccessory(acc.id)}
                        aria-label={`Remove ${acc.name}`}
                        className="opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Outfit Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Concrete Studio Layer"
                  className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <StyleTagSelector
                singleSelect
                builtInOptions={STYLE_CATEGORIES}
                selected={styleCategory ? [styleCategory] : ['Streetwear']}
                onChange={(next) => setStyleCategory(next[0] || 'Streetwear')}
                label="Style"
                onError={(msg) => onToast(msg, 'error')}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Occasion & Notes
                </label>
                <input
                  type="text"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  placeholder="Gallery walk / Studio"
                  className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040] mb-2"
                />
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Silhouette & proportion notes..."
                  className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SEASON_TAGS.map((s) => {
                  const active = seasons.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setSeasons((prev) =>
                          prev.includes(s) ? (prev.length > 1 ? prev.filter((x) => x !== s) : prev) : [...prev, s]
                        )
                      }
                      className={`px-2 py-1 rounded-chip text-[11px] border cursor-pointer ${
                        active
                          ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                          : 'border-[#d4cfc5] dark:border-[#404040]'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRemix}
                  onChange={(e) => setAllowRemix(e.target.checked)}
                  className="accent-[#171717] dark:accent-[#e5e1da]"
                />
                <span>Allow others to remix this outfit</span>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveLookbookOnly}
                  className="py-2.5 px-3 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{saving ? 'Saving...' : 'Save Lookbook'}</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleOpenShareModal}
                  className="py-2.5 px-3 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Save &amp; Share</span>
                </button>
              </div>
            </div>
          </section>

          {/* Piece Picker Columns */}
          <section className="lg:col-span-7 space-y-5">
            {/* Multi-Top Picker (up to 5 layers) */}
            <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-sm">
                  1. Select Top Layers (up to {MAX_TOP_LAYERS})
                </h3>
                <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                  {topIds.length}/{MAX_TOP_LAYERS} selected
                </span>
              </div>
              {tops.length === 0 ? (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                  No clean garments available in this category.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {tops.map((item) => {
                    const layerIdx = topIds.indexOf(item.id);
                    const active = layerIdx >= 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleTopLayer(item.id)}
                        className={`p-2 rounded-control border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#171717] dark:border-[#e5e1da] ring-2 ring-[#171717] dark:ring-[#e5e1da] bg-[#f5f4f0] dark:bg-[#171717]'
                            : 'border-[#d4cfc5] dark:border-[#404040] hover:bg-[#f5f4f0] dark:hover:bg-[#303030]'
                        }`}
                      >
                        <div className="relative aspect-square rounded-chip overflow-hidden mb-2 bg-[#eae7e0] dark:bg-[#171717]">
                          <GarmentImage
                            src={item.thumbUrl || item.imageUrl}
                            mediaId={item.mediaId}
                            alt={item.altText || item.name}
                            isCutout={item.isCutout}
                          />
                          {active && (
                            <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[10px] font-mono-num font-bold">
                              Layer {layerIdx + 1}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                          {item.color} · {item.laundryStatus}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {[
              { label: '2. Select Bottom', items: bottoms, selected: bottomId, onPick: setBottomId },
              { label: '3. Select Footwear', items: shoes, selected: shoesId, onPick: setShoesId },
            ].map((group) => (
              <div
                key={group.label}
                className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3"
              >
                <h3 className="font-display font-bold text-sm">{group.label}</h3>
                {group.items.length === 0 ? (
                  <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                    No clean garments available in this category.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {group.items.map((item) => {
                      const active = group.selected === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => group.onPick(active ? '' : item.id)}
                          className={`p-2 rounded-control border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#171717] dark:border-[#e5e1da] ring-2 ring-[#171717] dark:ring-[#e5e1da] bg-[#f5f4f0] dark:bg-[#171717]'
                              : 'border-[#d4cfc5] dark:border-[#404040] hover:bg-[#f5f4f0] dark:hover:bg-[#303030]'
                          }`}
                        >
                          <div className="relative aspect-square rounded-chip overflow-hidden mb-2 bg-[#eae7e0] dark:bg-[#171717]">
                            <GarmentImage
                              src={item.thumbUrl || item.imageUrl}
                              mediaId={item.mediaId}
                              alt={item.altText || item.name}
                              isCutout={item.isCutout}
                            />
                            {active && (
                              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                            {item.color} · {item.laundryStatus}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Accessories Multi-select (up to 8) */}
            <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-sm">
                  4. Accessories (Optional, up to {MAX_OUTFIT_ACCESSORIES})
                </h3>
                <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                  {accessoryIds.length}/{MAX_OUTFIT_ACCESSORIES}
                </span>
              </div>
              {accessories.length === 0 ? (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">No accessories added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accessories.map((acc) => {
                    const active = accessoryIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => toggleAccessory(acc.id)}
                        className={`px-3 py-2 rounded-control text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                            : 'border-[#d4cfc5] dark:border-[#404040]'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        <span>{acc.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Save & Share Confirmation Modal */}
        {shareModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-share-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) setShareModalOpen(false);
            }}
          >
            <form
              onSubmit={handleConfirmSaveAndShare}
              className="w-full max-w-md rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="save-share-title" className="font-display font-bold text-lg">
                    Share Outfit to Feed
                  </h2>
                  <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                    Saves &ldquo;{name.trim()}&rdquo; to My Lookbook and publishes a post.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShareModalOpen(false)}
                  aria-label="Close share dialog"
                  className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Caption (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={shareCaption}
                  onChange={(e) => setShareCaption(e.target.value)}
                  placeholder="Write a caption or leave blank..."
                  className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Post Visibility
                </label>
                <select
                  value={shareVisibility}
                  onChange={(e) => setShareVisibility(e.target.value as Visibility)}
                  className="w-full px-3 py-2.5 min-h-[42px] rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShareModalOpen(false)}
                  className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{saving ? 'Publishing...' : 'Publish Post'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
