import React, { useMemo, useState } from 'react';
import {
  ACCESSORY_CATEGORIES,
  BOTTOM_CATEGORIES,
  ClothingItem,
  NavSection,
  Outfit,
  SHOE_CATEGORIES,
  STYLE_CATEGORIES,
  TOP_CATEGORIES,
} from '../types';
import { useWardrobe } from '../context/WardrobeContext';
import { GarmentImage } from './GarmentImage';
import { Check, Plus, RotateCcw, Trash2, X } from 'lucide-react';

interface FitBuilderPageProps {
  editingOutfit?: Outfit | null;
  onClearEditingOutfit?: () => void;
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const FitBuilderPage: React.FC<FitBuilderPageProps> = ({
  editingOutfit,
  onClearEditingOutfit,
  onNavigate,
  onToast,
}) => {
  const { wardrobe, addOutfit, editOutfit, removeOutfit } = useWardrobe();

  const [activeSlot, setActiveSlot] = useState<'tops' | 'bottoms' | 'shoes' | 'accessories'>('tops');

  const [selectedTopId, setSelectedTopId] = useState<string>(editingOutfit?.topId || '');
  const [selectedBottomId, setSelectedBottomId] = useState<string>(editingOutfit?.bottomId || '');
  const [selectedShoesId, setSelectedShoesId] = useState<string>(editingOutfit?.shoesId || '');
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>(
    editingOutfit?.accessoryIds || []
  );

  const [outfitName, setOutfitName] = useState(editingOutfit?.name || '');
  const [styleCategory, setStyleCategory] = useState(editingOutfit?.styleCategory || 'Streetwear');
  const [description, setDescription] = useState(editingOutfit?.description || '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editingOutfit) {
      setSelectedTopId(editingOutfit.topId || '');
      setSelectedBottomId(editingOutfit.bottomId || '');
      setSelectedShoesId(editingOutfit.shoesId || '');
      setSelectedAccessoryIds(editingOutfit.accessoryIds || []);
      setOutfitName(editingOutfit.name);
      setStyleCategory(editingOutfit.styleCategory);
      setDescription(editingOutfit.description || '');
    }
  }, [editingOutfit]);

  const tops = useMemo(
    () => wardrobe.filter((w) => TOP_CATEGORIES.includes(w.category)),
    [wardrobe]
  );
  const bottoms = useMemo(
    () => wardrobe.filter((w) => BOTTOM_CATEGORIES.includes(w.category)),
    [wardrobe]
  );
  const shoes = useMemo(
    () => wardrobe.filter((w) => SHOE_CATEGORIES.includes(w.category)),
    [wardrobe]
  );
  const accessories = useMemo(
    () => wardrobe.filter((w) => ACCESSORY_CATEGORIES.includes(w.category)),
    [wardrobe]
  );

  const selectedTop = wardrobe.find((w) => w.id === selectedTopId);
  const selectedBottom = wardrobe.find((w) => w.id === selectedBottomId);
  const selectedShoes = wardrobe.find((w) => w.id === selectedShoesId);
  const selectedAccessories = selectedAccessoryIds
    .map((id) => wardrobe.find((w) => w.id === id))
    .filter(Boolean) as ClothingItem[];

  const toggleAccessory = (id: string) => {
    setSelectedAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetBuilder = () => {
    setSelectedTopId('');
    setSelectedBottomId('');
    setSelectedShoesId('');
    setSelectedAccessoryIds([]);
    setOutfitName('');
    setDescription('');
    onClearEditingOutfit?.();
  };

  const handleSaveOutfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outfitName.trim()) {
      onToast('Please enter a name for this outfit.', 'error');
      return;
    }
    if (!selectedTopId && !selectedBottomId && !selectedShoesId && selectedAccessoryIds.length === 0) {
      onToast('Select at least one clothing item from your wardrobe.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: outfitName.trim(),
        styleCategory,
        description: description.trim(),
        topId: selectedTopId || undefined,
        bottomId: selectedBottomId || undefined,
        shoesId: selectedShoesId || undefined,
        accessoryIds: selectedAccessoryIds,
        isFavorite: editingOutfit?.isFavorite ?? false,
        source: 'builder' as const,
      };

      if (editingOutfit) {
        await editOutfit(editingOutfit.id, payload);
        onToast(`Updated "${payload.name}" in My Lookbook.`);
        onClearEditingOutfit?.();
      } else {
        await addOutfit(payload);
        onToast(`Saved "${payload.name}" to My Lookbook.`);
        resetBuilder();
      }
    } catch (err: any) {
      onToast(err.message || 'Could not save outfit.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!editingOutfit) return;
    try {
      await removeOutfit(editingOutfit);
      onToast(`Deleted "${editingOutfit.name}".`);
      resetBuilder();
    } catch (err: any) {
      onToast(err.message || 'Could not delete outfit.', 'error');
    }
  };

  const slotItems =
    activeSlot === 'tops'
      ? tops
      : activeSlot === 'bottoms'
      ? bottoms
      : activeSlot === 'shoes'
      ? shoes
      : accessories;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
            Outfit Composition Studio
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
            Fit Builder
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetBuilder}
            className="px-3.5 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Canvas</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('lookbook')}
            className="px-3.5 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] cursor-pointer"
          >
            View Lookbook
          </button>
        </div>
      </div>

      {wardrobe.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-3">
          <p className="text-sm font-medium">Add garments to My Wardrobe before building an outfit.</p>
          <button
            type="button"
            onClick={() => onNavigate('wardrobe')}
            className="px-4 py-2 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Go to My Wardrobe</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Wardrobe Selector by Section */}
          <div className="lg:col-span-7 space-y-4">
            {/* Section Tabs */}
            <div className="grid grid-cols-4 border border-[#d8d4ca] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#303030]">
              {(
                [
                  { id: 'tops', label: `Tops (${tops.length})` },
                  { id: 'bottoms', label: `Bottoms (${bottoms.length})` },
                  { id: 'shoes', label: `Shoes (${shoes.length})` },
                  { id: 'accessories', label: `Accessories (${accessories.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSlot(tab.id)}
                  className={`py-2.5 px-2 text-xs font-semibold transition-colors cursor-pointer truncate ${
                    activeSlot === tab.id
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                      : 'text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Garment Grid */}
            {slotItems.length === 0 ? (
              <div className="p-10 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] text-center space-y-2">
                <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
                  No items found in {activeSlot}.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('wardrobe')}
                  className="text-xs font-semibold underline underline-offset-4 cursor-pointer"
                >
                  Add item in My Wardrobe
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slotItems.map((item) => {
                  const isSelected =
                    (activeSlot === 'tops' && selectedTopId === item.id) ||
                    (activeSlot === 'bottoms' && selectedBottomId === item.id) ||
                    (activeSlot === 'shoes' && selectedShoesId === item.id) ||
                    (activeSlot === 'accessories' && selectedAccessoryIds.includes(item.id));

                  const handleSelect = () => {
                    if (activeSlot === 'tops') setSelectedTopId(isSelected ? '' : item.id);
                    else if (activeSlot === 'bottoms') setSelectedBottomId(isSelected ? '' : item.id);
                    else if (activeSlot === 'shoes') setSelectedShoesId(isSelected ? '' : item.id);
                    else toggleAccessory(item.id);
                  };

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={handleSelect}
                      className={`text-left border transition-colors cursor-pointer bg-white dark:bg-[#242424] ${
                        isSelected
                          ? 'border-[#171717] dark:border-[#e5e1da] ring-1 ring-[#171717] dark:ring-[#e5e1da]'
                          : 'border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da]'
                      }`}
                    >
                      <div className="aspect-square relative bg-[#eae7e0] dark:bg-[#303030] overflow-hidden">
                        <GarmentImage src={item.imageUrl} alt={item.name} />
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
                          {item.brand} · {item.color}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Visual Outfit Preview & Save Form */}
          <div className="lg:col-span-5 bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c5a54] dark:text-[#b0b0b0]">
                Visual Outfit Preview
              </h2>
              {editingOutfit && (
                <span className="text-[11px] font-mono-num">Editing Saved Fit</span>
              )}
            </div>

            {/* Composed Slot Previews */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Top', item: selectedTop, clear: () => setSelectedTopId('') },
                { label: 'Bottom', item: selectedBottom, clear: () => setSelectedBottomId('') },
                { label: 'Shoes', item: selectedShoes, clear: () => setSelectedShoesId('') },
                {
                  label: `Accessories (${selectedAccessories.length})`,
                  item: selectedAccessories[0],
                  clear: () => setSelectedAccessoryIds([]),
                },
              ].map((slot) => (
                <div
                  key={slot.label}
                  className="border border-[#d8d4ca] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#303030] p-2.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                    <span className="uppercase tracking-wider">{slot.label}</span>
                    {slot.item && (
                      <button
                        type="button"
                        onClick={slot.clear}
                        className="hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                        title={`Remove ${slot.label}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {slot.item ? (
                    <div className="space-y-1.5">
                      <div className="aspect-square overflow-hidden">
                        <GarmentImage src={slot.item.imageUrl} alt={slot.item.name} />
                      </div>
                      <p className="text-[11px] font-medium truncate">{slot.item.name}</p>
                    </div>
                  ) : (
                    <div className="aspect-square flex items-center justify-center border border-dashed border-[#d8d4ca] dark:border-[#404040] text-[11px] text-[#5c5a54] dark:text-[#b0b0b0]">
                      Empty
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selectedAccessories.length > 1 && (
              <div className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] space-y-1">
                <p className="font-semibold text-[#171717] dark:text-[#e5e1da]">Selected Accessories:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAccessories.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccessory(acc.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-[#d8d4ca] dark:border-[#404040] text-[11px] cursor-pointer"
                    >
                      <span>{acc.name}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save Form */}
            <form onSubmit={handleSaveOutfit} className="space-y-3.5 pt-3 border-t border-[#d8d4ca] dark:border-[#404040]">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Outfit Name *
                </label>
                <input
                  type="text"
                  required
                  value={outfitName}
                  onChange={(e) => setOutfitName(e.target.value)}
                  placeholder="Concrete Evening Layer"
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Style Category
                </label>
                <select
                  value={styleCategory}
                  onChange={(e) => setStyleCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                >
                  {STYLE_CATEGORIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Occasion, layering notes..."
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {editingOutfit && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="px-3.5 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {saving
                    ? 'Saving...'
                    : editingOutfit
                    ? 'Update Saved Outfit'
                    : 'Save to My Lookbook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
