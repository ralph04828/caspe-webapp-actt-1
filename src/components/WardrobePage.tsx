import React, { useEffect, useMemo, useState } from 'react';
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  ClothingItem,
  LaundryStatus,
  SEASON_TAGS,
  SEASON_TAGS as ALL_SEASONS,
  STYLE_CATEGORIES,
  SeasonTag,
  Visibility,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { uploadImageAsset } from '../services/storageService';
import { removeBackgroundClient } from '../utils/bgRemoval';
import { autoTagGarmentPhoto } from '../services/aiService';
import { buildAutoAltText } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import {
  Plus,
  Search,
  Sparkles,
  Scissors,
  CheckCircle2,
  Droplets,
  AlertCircle,
  Edit3,
  Trash2,
  Upload,
  X,
  CheckSquare,
  Square,
  Loader2,
  Share2,
} from 'lucide-react';

interface WardrobePageProps {
  openAddModalOnMount?: boolean;
  onConsumedOpenAdd?: () => void;
  onSharePiece?: (item: ClothingItem) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const LAUNDRY_CYCLE: LaundryStatus[] = ['clean', 'dirty', 'washing'];
const VISIBILITY_CYCLE: Visibility[] = ['public', 'followers', 'private'];

export const WardrobePage: React.FC<WardrobePageProps> = ({
  openAddModalOnMount,
  onConsumedOpenAdd,
  onSharePiece,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const {
    wardrobe,
    addClothing,
    editClothing,
    removeClothing,
    setLaundryStatus,
    markManyClean,
  } = useWardrobe();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [laundryFilter, setLaundryFilter] = useState<'all' | LaundryStatus>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);

  // Form state (strictly zero price/cost fields)
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('T-shirts');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('L');
  const [seasons, setSeasons] = useState<SeasonTag[]>(['All-Season']);
  const [styleTags, setStyleTags] = useState<string[]>(['Streetwear']);
  const [visibility, setVisibility] = useState<Visibility>(userProfile?.defaultItemVisibility || 'public');
  const [laundryStatus, setFormLaundry] = useState<LaundryStatus>('clean');
  const [description, setDescription] = useState('');
  const [altText, setAltText] = useState('');

  const [rawPhotoUrl, setRawPhotoUrl] = useState<string | null>(null);
  const [cutoutPhotoUrl, setCutoutPhotoUrl] = useState<string | null>(null);
  const [useCutout, setUseCutout] = useState(false);
  const [bgProgress, setBgProgress] = useState<number | null>(null);
  const [autoTagging, setAutoTagging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (openAddModalOnMount) {
      openAdd();
      onConsumedOpenAdd?.();
    }
  }, [openAddModalOnMount]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const openAdd = () => {
    setEditingItem(null);
    setName('');
    setCategory('T-shirts');
    setBrand('');
    setColor('');
    setSize('L');
    setSeasons(['All-Season']);
    setStyleTags(['Streetwear']);
    setVisibility(userProfile?.defaultItemVisibility || 'public');
    setFormLaundry('clean');
    setDescription('');
    setAltText('');
    setRawPhotoUrl(null);
    setCutoutPhotoUrl(null);
    setUseCutout(false);
    setModalOpen(true);
  };

  const openEdit = (item: ClothingItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setBrand(item.brand);
    setColor(item.color);
    setSize(item.size);
    setSeasons(item.seasons?.length ? item.seasons : ['All-Season']);
    setStyleTags(item.styleTags || []);
    setVisibility(item.visibility || 'public');
    setFormLaundry(item.laundryStatus || 'clean');
    setDescription(item.description || '');
    setAltText(item.altText || buildAutoAltText(item));
    setRawPhotoUrl(item.imageUrl || null);
    setCutoutPhotoUrl(null);
    setUseCutout(Boolean(item.isCutout));
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCutoutPhotoUrl(null);
    setUseCutout(false);
    const reader = new FileReader();
    reader.onload = () => setRawPhotoUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleRemoveBg = async () => {
    if (!rawPhotoUrl) return;
    setBgProgress(10);
    try {
      const res = await removeBackgroundClient(rawPhotoUrl, 36, setBgProgress);
      setCutoutPhotoUrl(res.cutoutDataUrl);
      setUseCutout(true);
      onToast('Background removed! Compare original vs cutout.');
    } catch (err: any) {
      onToast(err?.message || 'Could not remove background; keeping original.', 'error');
    } finally {
      setBgProgress(null);
    }
  };

  const handleAIAutoTag = async () => {
    const img = useCutout && cutoutPhotoUrl ? cutoutPhotoUrl : rawPhotoUrl;
    if (!img) {
      onToast('Upload a garment photo first to auto-tag.', 'error');
      return;
    }
    setAutoTagging(true);
    try {
      const mime = img.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
      const tags = await autoTagGarmentPhoto(img, mime);
      if (tags.name) setName(tags.name);
      if (tags.category && CLOTHING_CATEGORIES.includes(tags.category)) setCategory(tags.category);
      if (tags.color) setColor(tags.color);
      if (Array.isArray(tags.styleTags) && tags.styleTags.length > 0) setStyleTags(tags.styleTags);
      if (Array.isArray(tags.seasons) && tags.seasons.length > 0) {
        setSeasons(tags.seasons.filter((s) => ALL_SEASONS.includes(s)));
      }
      if (tags.altText) setAltText(tags.altText);
      if (tags.description) setDescription(tags.description);
      onToast('SWOOOSH AI tagged this garment.');
    } catch (err: any) {
      onToast(err?.message || 'Auto-tagging failed.', 'error');
    } finally {
      setAutoTagging(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!name.trim()) {
      onToast('Garment name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingItem?.imageUrl;
      let thumbUrl = editingItem?.thumbUrl;
      let mediaId = editingItem?.mediaId;

      const activeImg = useCutout && cutoutPhotoUrl ? cutoutPhotoUrl : rawPhotoUrl;
      if (activeImg && activeImg.startsWith('data:')) {
        const uploaded = await uploadImageAsset(activeImg, userProfile.uid, visibility, isDemoMode);
        imageUrl = uploaded.imageUrl;
        thumbUrl = uploaded.thumbUrl;
        mediaId = uploaded.mediaId;
      }

      const finalAlt = altText.trim() || buildAutoAltText({ color, brand, name, category });

      if (editingItem) {
        await editClothing(editingItem.id, {
          name: name.trim(),
          category,
          brand: brand.trim() || 'Unbranded',
          color: color.trim() || 'Neutral',
          size: size.trim() || 'M',
          seasons,
          styleTags,
          visibility,
          laundryStatus,
          description: description.trim(),
          altText: finalAlt,
          imageUrl,
          thumbUrl,
          mediaId,
          isCutout: useCutout,
        });
        onToast('Garment updated.');
      } else {
        await addClothing({
          name: name.trim(),
          category,
          brand: brand.trim() || 'Unbranded',
          color: color.trim() || 'Neutral',
          size: size.trim() || 'M',
          seasons,
          styleTags,
          visibility,
          laundryStatus,
          description: description.trim(),
          altText: finalAlt,
          imageUrl,
          thumbUrl,
          mediaId,
          isCutout: useCutout,
          wearCount: 0,
        });
        onToast('Added to My Wardrobe.');
      }
      setModalOpen(false);
    } catch (err: any) {
      onToast(err?.message || 'Failed to save garment.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wardrobe.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (laundryFilter !== 'all' && item.laundryStatus !== laundryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        (item.styleTags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [wardrobe, search, categoryFilter, laundryFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkClean = async () => {
    const ids = Array.from(selectedIds);
    await markManyClean(ids);
    setSelectedIds(new Set());
    onToast(`Marked ${ids.length} item${ids.length === 1 ? '' : 's'} as Clean.`);
  };

  const dirtyCount = wardrobe.filter((w) => w.laundryStatus === 'dirty').length;
  const washingCount = wardrobe.filter((w) => w.laundryStatus === 'washing').length;

  const renderLaundryChip = (item: ClothingItem) => {
    const nextStatus =
      LAUNDRY_CYCLE[(LAUNDRY_CYCLE.indexOf(item.laundryStatus || 'clean') + 1) % LAUNDRY_CYCLE.length];

    const config =
      item.laundryStatus === 'dirty'
        ? { label: 'Dirty', Icon: AlertCircle, cls: 'border-amber-600/50 bg-amber-500/15 text-amber-800 dark:text-amber-300' }
        : item.laundryStatus === 'washing'
        ? { label: 'In the wash', Icon: Droplets, cls: 'border-sky-600/50 bg-sky-500/15 text-sky-800 dark:text-sky-300' }
        : { label: 'Clean', Icon: CheckCircle2, cls: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' };

    const Icon = config.Icon;
    return (
      <button
        type="button"
        onClick={() => setLaundryStatus(item.id, nextStatus)}
        title="Private laundry status — click to cycle Clean / Dirty / In the wash"
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-chip text-[11px] font-medium border transition-colors cursor-pointer ${config.cls}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span>{config.label}</span>
      </button>
    );
  };

  const previewImg = useCutout && cutoutPhotoUrl ? cutoutPhotoUrl : rawPhotoUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">My Wardrobe</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            {wardrobe.length} garments · Laundry status & wear counts stay private to you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkClean}
              className="px-4 py-2.5 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark {selectedIds.size} Clean</span>
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 hover:opacity-90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Garment</span>
          </button>
        </div>
      </div>

      {/* Filters & Laundry Bar */}
      <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#4e4c46] dark:text-[#c2bfb8]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search garments by name, brand, color, or style..."
              className="w-full pl-9 pr-4 py-2.5 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {(
              [
                { id: 'all', label: `All (${wardrobe.length})` },
                { id: 'clean', label: 'Clean' },
                { id: 'dirty', label: `Dirty (${dirtyCount})` },
                { id: 'washing', label: `In the wash (${washingCount})` },
              ] as const
            ).map((lf) => (
              <button
                key={lf.id}
                type="button"
                onClick={() => setLaundryFilter(lf.id)}
                className={`px-3 py-1.5 rounded-chip text-xs font-medium border cursor-pointer ${
                  laundryFilter === lf.id
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                    : 'border-[#d4cfc5] dark:border-[#404040]'
                }`}
              >
                {lf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['All', ...CLOTHING_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-chip text-[11px] font-medium border cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Wardrobe Grid */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
          <p className="font-display font-bold text-base">No garments found</p>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Adjust your filters or add a new piece to your digital wardrobe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const nextVis =
              VISIBILITY_CYCLE[(VISIBILITY_CYCLE.indexOf(item.visibility || 'public') + 1) % VISIBILITY_CYCLE.length];

            return (
              <article
                key={item.id}
                className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden flex flex-col shadow-sm"
              >
                <div className="relative aspect-square bg-[#eae7e0] dark:bg-[#171717]">
                  <GarmentImage
                    src={item.thumbUrl || item.imageUrl}
                    alt={item.altText || item.name}
                    fallbackLabel={item.name}
                    isCutout={item.isCutout}
                  />
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                    className="absolute top-2.5 left-2.5 p-1.5 rounded-chip bg-white/90 dark:bg-[#171717]/90 border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="absolute top-2.5 right-2.5">
                    <VisibilityBadge
                      visibility={item.visibility || 'public'}
                      onClick={() => editClothing(item.id, { visibility: nextVis })}
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                      <span className="font-semibold uppercase tracking-wider truncate">
                        {item.brand}
                      </span>
                      <span className="font-mono-num">Size {item.size}</span>
                    </div>
                    <h3 className="font-display font-bold text-sm leading-snug line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                      {item.category} · {item.color}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {renderLaundryChip(item)}
                      <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                        {item.wearCount || 0} wears
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-1">
                      {onSharePiece && (
                        <button
                          type="button"
                          onClick={() => onSharePiece(item)}
                          title="Share piece to feed"
                          className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.name}`}
                        className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer ml-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await removeClothing(item);
                          onToast('Removed from wardrobe.');
                        }}
                        aria-label={`Delete ${item.name}`}
                        className="p-2 rounded-control hover:bg-red-500/15 text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Garment Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wardrobe-modal-title"
        >
          <div className="w-full max-w-xl rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between">
              <h2 id="wardrobe-modal-title" className="font-display font-bold text-lg">
                {editingItem ? 'Edit Garment' : 'Add Garment'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Photo Upload + Background Removal + AI Auto-Tag */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Garment Photo
                  </label>
                  <div className="flex items-center gap-2">
                    {rawPhotoUrl && (
                      <>
                        <button
                          type="button"
                          onClick={handleRemoveBg}
                          disabled={bgProgress !== null}
                          className="px-2.5 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-[11px] font-medium flex items-center gap-1 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                        >
                          <Scissors className="w-3 h-3" />
                          <span>
                            {bgProgress !== null ? `Removing (${bgProgress}%)` : 'Remove background'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAIAutoTag}
                          disabled={autoTagging}
                          className="px-2.5 py-1 rounded-chip bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        >
                          {autoTagging ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{autoTagging ? 'Tagging...' : 'AI Auto-Tag'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {previewImg ? (
                  <div className="space-y-2">
                    <div className="relative h-48 rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#171717]">
                      <GarmentImage src={previewImg} alt="Garment preview" isCutout={useCutout} />
                      <button
                        type="button"
                        onClick={() => {
                          setRawPhotoUrl(null);
                          setCutoutPhotoUrl(null);
                        }}
                        aria-label="Clear photo"
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {cutoutPhotoUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setUseCutout(false)}
                          className={`px-3 py-1 rounded-chip border cursor-pointer ${
                            !useCutout
                              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                              : 'border-[#d4cfc5] dark:border-[#404040]'
                          }`}
                        >
                          Keep Original
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseCutout(true)}
                          className={`px-3 py-1 rounded-chip border cursor-pointer ${
                            useCutout
                              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                              : 'border-[#d4cfc5] dark:border-[#404040]'
                          }`}
                        >
                          Use Cutout
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 rounded-card border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] cursor-pointer">
                    <Upload className="w-5 h-5 mb-1.5 opacity-70" />
                    <span className="text-xs font-medium">Upload photo (WebP compressed in-browser)</span>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                    Garment Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Boxy Heavyweight Tee"
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Entire Studios"
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ClothingCategory)}
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    {CLOTHING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="Charcoal"
                      className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                      Size
                    </label>
                    <input
                      type="text"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      placeholder="L"
                      className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                    />
                  </div>
                </div>
              </div>

              {/* Seasons & Style Tags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Seasons
                </label>
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
                        className={`px-2.5 py-1 rounded-chip text-xs border cursor-pointer ${
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
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Style Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CATEGORIES.map((tag) => {
                    const active = styleTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setStyleTags((prev) =>
                            prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
                          )
                        }
                        className={`px-2.5 py-1 rounded-chip text-xs border cursor-pointer ${
                          active
                            ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                            : 'border-[#d4cfc5] dark:border-[#404040]'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visibility & Laundry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as Visibility)}
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    <option value="public">Public (Visible on profile & lookbooks)</option>
                    <option value="followers">Followers only</option>
                    <option value="private">Private (Hidden from others)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                    Laundry Status (Always Private)
                  </label>
                  <select
                    value={laundryStatus}
                    onChange={(e) => setFormLaundry(e.target.value as LaundryStatus)}
                    className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    <option value="clean">Clean</option>
                    <option value="dirty">Dirty</option>
                    <option value="washing">In the wash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Image Alt Text (Accessibility)
                </label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder={buildAutoAltText({ color, brand, name, category })}
                  className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                  Fabric / Fit Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Heavyweight 320gsm cotton, boxy shoulder drape..."
                  className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Wardrobe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
