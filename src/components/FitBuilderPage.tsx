import React, { useEffect, useMemo, useState } from 'react';
import {
  ACCESSORY_CATEGORIES,
  BOTTOM_CATEGORIES,
  ClothingItem,
  NavSection,
  Outfit,
  OutfitPieceSnapshot,
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
import { remixOutfitWithAI } from '../services/aiService';
import { GarmentImage } from './GarmentImage';
import {
  AlertTriangle,
  Check,
  Loader2,
  Repeat,
  Save,
  Share2,
  Sparkles,
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

  const [topId, setTopId] = useState<string>('');
  const [bottomId, setBottomId] = useState<string>('');
  const [shoesId, setShoesId] = useState<string>('');
  const [accessoryIds, setAccessoryIds] = useState<string[]>([]);

  const [includeDirty, setIncludeDirty] = useState(false);
  const [aiRemixing, setAiRemixing] = useState(false);
  const [aiRemixNote, setAiRemixNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingOutfit) {
      setName(editingOutfit.name);
      setStyleCategory(editingOutfit.styleCategory);
      setOccasion(editingOutfit.occasion || '');
      setSeasons(editingOutfit.seasons?.length ? editingOutfit.seasons : ['All-Season']);
      setDescription(editingOutfit.description || '');
      setVisibility(editingOutfit.visibility || 'public');
      setAllowRemix(editingOutfit.allowRemix !== false);
      setTopId(editingOutfit.topId || '');
      setBottomId(editingOutfit.bottomId || '');
      setShoesId(editingOutfit.shoesId || '');
      setAccessoryIds(editingOutfit.accessoryIds || []);
    } else if (remixSourcePost) {
      setName(`Remix: ${remixSourcePost.occasion || remixSourcePost.styleTags?.[0] || 'Daily Fit'}`);
      setStyleCategory(remixSourcePost.styleTags?.[0] || 'Streetwear');
      setOccasion(remixSourcePost.occasion || 'Remixed Fit');
      setDescription(`Remixed from @${remixSourcePost.authorUsername}`);
      setAiRemixNote(null);
      // Pre-match clean pieces from user's own wardrobe for each slot!
      const clean = wardrobe.filter((w) => w.laundryStatus === 'clean');
      const pool = clean.length > 0 ? clean : wardrobe;
      const firstTop = pool.find((i) => TOP_CATEGORIES.includes(i.category));
      const firstBot = pool.find((i) => BOTTOM_CATEGORIES.includes(i.category));
      const firstShoe = pool.find((i) => SHOE_CATEGORIES.includes(i.category));
      setTopId(firstTop?.id || '');
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
  const selectedTop = findItem(topId);
  const selectedBottom = findItem(bottomId);
  const selectedShoes = findItem(shoesId);
  const selectedAccessories = accessoryIds.map(findItem).filter(Boolean) as ClothingItem[];

  const dirtyWarnings = [selectedTop, selectedBottom, selectedShoes, ...selectedAccessories]
    .filter((i): i is ClothingItem => Boolean(i && i.laundryStatus !== 'clean'));

  const handleAISwapOnePiece = async () => {
    const pieces: OutfitPieceSnapshot[] = [];
    if (remixSourcePost?.piecesPreview?.length) {
      pieces.push(...remixSourcePost.piecesPreview);
    } else {
      if (selectedTop) {
        pieces.push({
          id: selectedTop.id,
          slot: 'top',
          name: selectedTop.name,
          category: selectedTop.category,
          brand: selectedTop.brand,
          color: selectedTop.color,
          visibility: selectedTop.visibility,
        });
      }
      if (selectedBottom) {
        pieces.push({
          id: selectedBottom.id,
          slot: 'bottom',
          name: selectedBottom.name,
          category: selectedBottom.category,
          brand: selectedBottom.brand,
          color: selectedBottom.color,
          visibility: selectedBottom.visibility,
        });
      }
      if (selectedShoes) {
        pieces.push({
          id: selectedShoes.id,
          slot: 'shoes',
          name: selectedShoes.name,
          category: selectedShoes.category,
          brand: selectedShoes.brand,
          color: selectedShoes.color,
          visibility: selectedShoes.visibility,
        });
      }
    }

    if (wardrobe.length === 0) {
      onToast('Add garments to My Wardrobe first so AI can swap a piece.', 'error');
      return;
    }

    setAiRemixing(true);
    try {
      const res = await remixOutfitWithAI(pieces, wardrobe, `Keep ${styleCategory} balance.`);
      if (res.replacementItemId) {
        if (res.slotToSwap === 'top') setTopId(res.replacementItemId);
        else if (res.slotToSwap === 'bottom') setBottomId(res.replacementItemId);
        else if (res.slotToSwap === 'shoes') setShoesId(res.replacementItemId);
        else if (!accessoryIds.includes(res.replacementItemId)) {
          setAccessoryIds((prev) => [...prev, res.replacementItemId]);
        }
      }
      setAiRemixNote(res.rationale || res.replacementSummary);
      onToast('AI swapped one piece for your remix!');
    } catch (err: any) {
      onToast(err?.message || 'AI remix unavailable.', 'error');
    } finally {
      setAiRemixing(false);
    }
  };

  const handleSave = async (shareToFeed: boolean) => {
    if (!name.trim()) {
      onToast('Give this outfit a name first.', 'error');
      return;
    }
    if (!topId && !bottomId && !shoesId && accessoryIds.length === 0) {
      onToast('Select at least one garment for your fit.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        styleCategory,
        occasion: occasion.trim(),
        seasons,
        tags: [styleCategory.toLowerCase()],
        description: description.trim(),
        topId: topId || undefined,
        bottomId: bottomId || undefined,
        shoesId: shoesId || undefined,
        accessoryIds,
        coverImageUrl: selectedTop?.imageUrl || selectedBottom?.imageUrl || selectedShoes?.imageUrl,
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

      let saved: Outfit;
      if (editingOutfit) {
        await editOutfit(editingOutfit.id, payload);
        saved = { ...editingOutfit, ...payload };
        onClearEditingOutfit();
      } else {
        saved = await addOutfit(payload);
      }

      if (shareToFeed) {
        await publishPost({
          postType: 'outfit',
          caption: `${saved.name} — ${saved.description || saved.styleCategory} #${styleCategory.toLowerCase().replace(/\s+/g, '')}`,
          visibility,
          allowRemix,
          commentPolicy: 'everyone',
          outfit: saved,
          wardrobe,
          occasion: saved.occasion,
          styleTags: [saved.styleCategory],
          remixedFrom: payload.remixedFrom,
        });
        onToast('Saved to My Lookbook and shared to Feed!');
        onClearRemixSource?.();
        onNavigate('home');
      } else {
        onToast('Saved to My Lookbook.');
        onClearRemixSource?.();
        onNavigate('lookbook');
      }
    } catch (err: any) {
      onToast(err?.message || 'Failed to save outfit.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Fit Builder</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Private workspace to compose & remix outfits until you save or share them.
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
            onClick={handleAISwapOnePiece}
            disabled={aiRemixing}
            className="px-4 py-2 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors cursor-pointer"
          >
            {aiRemixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>AI Swap One Piece</span>
          </button>
        </div>
      </div>

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

      {aiRemixNote && (
        <div className="p-3.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{aiRemixNote}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual Preview Canvas */}
        <section className="lg:col-span-5 p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wider">
            Outfit Canvas
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Top', item: selectedTop },
              { label: 'Bottom', item: selectedBottom },
              { label: 'Footwear', item: selectedShoes },
              { label: `Accessories (${selectedAccessories.length})`, item: selectedAccessories[0] },
            ].map((slot) => (
              <div
                key={slot.label}
                className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] overflow-hidden"
              >
                <div className="aspect-square">
                  <GarmentImage
                    src={slot.item?.thumbUrl || slot.item?.imageUrl}
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Style
                </label>
                <select
                  value={styleCategory}
                  onChange={(e) => setStyleCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                >
                  {STYLE_CATEGORIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
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
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </div>
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
                onClick={() => handleSave(false)}
                className="py-2.5 px-3 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Lookbook</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="py-2.5 px-3 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Save & Share</span>
              </button>
            </div>
          </div>
        </section>

        {/* Piece Picker Columns */}
        <section className="lg:col-span-7 space-y-5">
          {[
            { label: '1. Select Top / Outerwear', items: tops, selected: topId, onPick: setTopId },
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

          {/* Accessories Multi-select */}
          <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
            <h3 className="font-display font-bold text-sm">4. Accessories (Optional)</h3>
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
                      onClick={() =>
                        setAccessoryIds((prev) =>
                          prev.includes(acc.id) ? prev.filter((x) => x !== acc.id) : [...prev, acc.id]
                        )
                      }
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
    </div>
  );
};
