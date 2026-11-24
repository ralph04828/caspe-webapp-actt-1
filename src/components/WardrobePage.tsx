import React, { useEffect, useMemo, useState } from 'react';
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  ClothingItem,
  LaundryStatus,
  SEASON_TAGS,
  SeasonTag,
  SizeSystem,
  Visibility,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { preparePreviewDataUrl, resolveMediaRef, uploadImageAsset } from '../services/storageService';
import { removeBackgroundClient } from '../utils/bgRemoval';
import { buildAutoAltText } from '../utils/formatters';
import {
  ACCESSORY_PRESET_SIZES,
  BottomSizeMode,
  formatShoeSizeValue,
  getCategorySizeKind,
  getDefaultSizeForCategory,
  getSavedShoeSystem,
  getShoeSizesForSystem,
  getSizeFilterOptionsForCategory,
  isSizeValidForCategory,
  LETTER_SIZES,
  parseShoeSizeValue,
  savePreferredShoeSystem,
  SHOE_SIZE_SYSTEMS,
  ShoeSizeSystem,
  TOP_SIZES,
  WAIST_SIZES,
} from '../utils/sizing';
import { dedupeStyleTags } from '../utils/styleTags';
import {
  getDraftSessionKey,
  loadSessionJson,
  removeSessionKey,
  saveSessionJson,
} from '../utils/draftStorage';
import { loadIdbDraft, removeIdbDraft, saveIdbDraft } from '../utils/indexedDbDrafts';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import { CropAspectKey, PhotoCropEditor, PhotoCropState, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { StyleTagSelector } from './StyleTagSelector';
import { ErrorBoundary } from './ErrorBoundary';
import {
  Plus,
  Search,
  Scissors,
  CheckCircle2,
  Droplets,
  AlertCircle,
  Edit3,
  Trash2,
  X,
  CheckSquare,
  Square,
  Share2,
  ArrowLeft,
  Crop,
  Loader2,
} from 'lucide-react';

interface WardrobePageProps {
  openAddModalOnMount?: boolean;
  onConsumedOpenAdd?: () => void;
  onModalStateChange?: (isOpen: boolean) => void;
  onSharePiece?: (item: ClothingItem) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type WardrobeModalStep = 'photo' | 'editor' | 'details';

interface WardrobeDraft {
  step: WardrobeModalStep;
  editingItemId: string | null;
  rawPhotoUrl: string | null;
  cropState: PhotoCropState | null;
  croppedPhotoUrl: string | null;
  cutoutPhotoUrl: string | null;
  useCutout: boolean;
  name: string;
  category: ClothingCategory;
  brand: string;
  color: string;
  size: string;
  sizeSystem?: SizeSystem;
  seasons: SeasonTag[];
  styleTags: string[];
  visibility: Visibility;
  laundryStatus: LaundryStatus;
  description: string;
  altText: string;
}

const LAUNDRY_CYCLE: LaundryStatus[] = ['clean', 'dirty', 'washing'];
const VISIBILITY_CYCLE: Visibility[] = ['public', 'friends', 'followers', 'private'];

function makeEmptyWardrobeDraft(defaultVis: Visibility, uid?: string): WardrobeDraft {
  const shoeSys = getSavedShoeSystem(uid);
  const { size, sizeSystem } = getDefaultSizeForCategory('T-shirts', shoeSys);
  return {
    step: 'photo',
    editingItemId: null,
    rawPhotoUrl: null,
    cropState: null,
    croppedPhotoUrl: null,
    cutoutPhotoUrl: null,
    useCutout: false,
    name: '',
    category: 'T-shirts',
    brand: '',
    color: '',
    size,
    sizeSystem,
    seasons: ['All-Season'],
    styleTags: ['Streetwear'],
    visibility: defaultVis,
    laundryStatus: 'clean',
    description: '',
    altText: '',
  };
}

export const WardrobePage: React.FC<WardrobePageProps> = ({
  openAddModalOnMount,
  onConsumedOpenAdd,
  onModalStateChange,
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

  const defaultVis = userProfile?.defaultItemVisibility || 'public';
  const draftKey = getDraftSessionKey('wardrobe', userProfile?.uid || 'anon');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ClothingCategory>('All');
  const [sizeFilter, setSizeFilter] = useState<string>('All');
  const [laundryFilter, setLaundryFilter] = useState<'all' | LaundryStatus>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ClothingItem | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [draft, setDraft] = useState<WardrobeDraft>(() =>
    makeEmptyWardrobeDraft(defaultVis, userProfile?.uid)
  );
  const [bottomSizeMode, setBottomSizeMode] = useState<BottomSizeMode>('Letter');
  const [shoeSizeSystem, setShoeSizeSystem] = useState<ShoeSizeSystem>(() =>
    getSavedShoeSystem(userProfile?.uid)
  );
  const [accessoryOtherMode, setAccessoryOtherMode] = useState(false);
  const [sizeResetWarning, setSizeResetWarning] = useState<string | null>(null);

  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [resolvingForCrop, setResolvingForCrop] = useState(false);
  const [bgProgress, setBgProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  const updateDraft = (updater: Partial<WardrobeDraft> | ((prev: WardrobeDraft) => WardrobeDraft)) => {
    setDraft((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      return next;
    });
  };

  // Restore any interrupted Add Garment draft if mobile picker triggered a tab reload
  useEffect(() => {
    let cancelled = false;
    const savedSession = loadSessionJson<WardrobeDraft>(draftKey);
    if (savedSession && !savedSession.editingItemId && (openAddModalOnMount || savedSession.rawPhotoUrl || savedSession.name)) {
      setEditingItem(null);
      setDraft({ ...makeEmptyWardrobeDraft(defaultVis, userProfile?.uid), ...savedSession });
      setModalOpen(true);
      onConsumedOpenAdd?.();
    } else if (openAddModalOnMount) {
      openAdd();
      onConsumedOpenAdd?.();
    }

    loadIdbDraft<WardrobeDraft>(draftKey).then((idb) => {
      if (cancelled || !idb || idb.editingItemId) return;
      if (idb.rawPhotoUrl || idb.croppedPhotoUrl || idb.name?.trim()) {
        setEditingItem(null);
        setDraft((prev) => {
          if (prev.rawPhotoUrl || prev.croppedPhotoUrl || prev.name.trim()) return prev;
          return { ...makeEmptyWardrobeDraft(defaultVis), ...idb };
        });
        setModalOpen(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [openAddModalOnMount, draftKey]);

  // Persist add-mode draft in IndexedDB + lightweight sessionStorage while modal is open
  useEffect(() => {
    onModalStateChange?.(modalOpen);
    if (!modalOpen || editingItem) return;
    const hasContent = Boolean(
      draft.rawPhotoUrl ||
        draft.croppedPhotoUrl ||
        draft.cutoutPhotoUrl ||
        draft.name.trim() ||
        draft.brand.trim() ||
        draft.color.trim() ||
        draft.description.trim()
    );
    if (!hasContent) {
      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      return;
    }
    saveIdbDraft(draftKey, draft);
    saveSessionJson(draftKey, {
      ...draft,
      rawPhotoUrl: null,
      croppedPhotoUrl: null,
      cutoutPhotoUrl: null,
    });
  }, [modalOpen, editingItem, draft, draftKey]);

  const hasUnsavedChanges = useMemo(() => {
    if (!modalOpen) return false;
    if (editingItem) {
      return (
        draft.name !== editingItem.name ||
        draft.brand !== editingItem.brand ||
        draft.color !== editingItem.color ||
        draft.description !== (editingItem.description || '') ||
        Boolean(draft.croppedPhotoUrl?.startsWith('data:')) ||
        Boolean(draft.cutoutPhotoUrl)
      );
    }
    return Boolean(
      draft.rawPhotoUrl ||
        draft.croppedPhotoUrl ||
        draft.name.trim() ||
        draft.brand.trim() ||
        draft.color.trim() ||
        draft.description.trim()
    );
  }, [modalOpen, editingItem, draft]);

  const attemptCloseModal = () => {
    if (saving || preparingPhoto) return;
    if (hasUnsavedChanges) {
      setDiscardPromptOpen(true);
      return;
    }
    forceCloseModal();
  };

  const forceCloseModal = () => {
    setDiscardPromptOpen(false);
    setModalOpen(false);
    setModalError(null);
    setSizeResetWarning(null);
    setEditingItem(null);
    removeSessionKey(draftKey);
    removeIdbDraft(draftKey);
    setDraft(makeEmptyWardrobeDraft(defaultVis, userProfile?.uid));
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !discardPromptOpen) {
        attemptCloseModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, discardPromptOpen, hasUnsavedChanges, saving, preparingPhoto]);

  const syncSizeHelpersForItem = (cat: ClothingCategory, sizeVal: string, sys?: SizeSystem) => {
    setSizeResetWarning(null);
    const kind = getCategorySizeKind(cat);
    if (kind === 'bottoms') {
      const isWaist = WAIST_SIZES.includes((sizeVal || '').replace(/^(W|Waist)\s*/i, '')) || sys === 'Waist';
      setBottomSizeMode(isWaist ? 'Waist' : 'Letter');
    } else if (kind === 'footwear') {
      const savedSys = getSavedShoeSystem(userProfile?.uid);
      const parsed = parseShoeSizeValue(sizeVal, (sys as ShoeSizeSystem) || savedSys);
      setShoeSizeSystem(parsed.system);
    } else if (kind === 'accessories') {
      const isCustom = Boolean(sizeVal && !(ACCESSORY_PRESET_SIZES as readonly string[]).includes(sizeVal));
      setAccessoryOtherMode(isCustom);
    }
  };

  const openAdd = () => {
    setEditingItem(null);
    setModalError(null);
    const fresh = makeEmptyWardrobeDraft(defaultVis, userProfile?.uid);
    syncSizeHelpersForItem(fresh.category, fresh.size, fresh.sizeSystem);
    setDraft(fresh);
    setModalOpen(true);
  };

  const openEdit = (item: ClothingItem) => {
    setEditingItem(item);
    setModalError(null);
    setDetailItem(null);
    syncSizeHelpersForItem(item.category, item.size || '', item.sizeSystem);
    setDraft({
      step: 'details',
      editingItemId: item.id,
      rawPhotoUrl: null,
      cropState: null,
      croppedPhotoUrl: item.imageUrl || null,
      cutoutPhotoUrl: null,
      useCutout: Boolean(item.isCutout),
      name: item.name,
      category: item.category,
      brand: item.brand,
      color: item.color,
      size: item.size || '',
      sizeSystem: item.sizeSystem,
      seasons: item.seasons?.length ? item.seasons : ['All-Season'],
      styleTags: dedupeStyleTags(item.styleTags || [], userProfile?.customStyles),
      visibility: item.visibility || 'public',
      laundryStatus: item.laundryStatus || 'clean',
      description: item.description || '',
      altText: item.altText || buildAutoAltText(item),
    });
    setModalOpen(true);
  };

  const processSelectedFile = async (file: File) => {
    setModalError(null);
    setPreparingPhoto(true);
    try {
      const compressedDataUrl = await preparePreviewDataUrl(file);
      updateDraft((prev) => ({
        ...prev,
        step: 'editor',
        rawPhotoUrl: compressedDataUrl,
        cropState: createDefaultCropState('1:1'),
        croppedPhotoUrl: null,
        cutoutPhotoUrl: null,
        useCutout: false,
      }));
    } catch (err: any) {
      const msg = err?.message || 'Could not process selected photo.';
      console.error('Wardrobe photo load error:', err);
      setModalError(msg);
      onToast(msg, 'error');
    } finally {
      setPreparingPhoto(false);
    }
  };

  const resolveEditableDataUrl = async (src: string | null): Promise<string | null> => {
    if (!src) return null;
    if (src.startsWith('data:') || /^https?:\/\//i.test(src) || src.startsWith('/')) {
      return src;
    }
    const res = await resolveMediaRef(src, editingItem?.mediaId);
    if (res.status === 'ready' && res.url) {
      return res.url;
    }
    throw new Error(res.reason || 'Photo unavailable to process. Please re-upload.');
  };

  const handleOpenEditorFromDetails = async () => {
    setModalError(null);
    if (draft.rawPhotoUrl) {
      updateDraft({ step: 'editor' });
      return;
    }
    const existingSrc = draft.croppedPhotoUrl || editingItem?.imageUrl || null;
    if (!existingSrc) {
      updateDraft({ step: 'photo' });
      return;
    }

    setResolvingForCrop(true);
    try {
      const resolved = await resolveEditableDataUrl(existingSrc);
      if (!resolved) {
        updateDraft({ step: 'photo' });
        return;
      }
      updateDraft({
        step: 'editor',
        rawPhotoUrl: resolved,
        cropState: draft.cropState || createDefaultCropState('1:1'),
      });
    } catch (err: any) {
      const msg = err?.message || 'Could not load image for cropping.';
      console.error('Failed to open crop editor:', err);
      setModalError(msg);
      onToast(msg, 'error');
    } finally {
      setResolvingForCrop(false);
    }
  };

  const handleRemoveBg = async () => {
    const source = draft.croppedPhotoUrl || draft.rawPhotoUrl;
    if (!source) return;
    setModalError(null);
    setBgProgress(10);
    try {
      const usableUrl = await resolveEditableDataUrl(source);
      if (!usableUrl) return;
      const res = await removeBackgroundClient(usableUrl, 36, setBgProgress);
      updateDraft({
        cutoutPhotoUrl: res.cutoutDataUrl,
        useCutout: true,
      });
      onToast('Background removed! Compare original vs cutout.');
    } catch (err: any) {
      const msg = err?.message || 'Could not remove background; keeping original.';
      console.error('Background removal error:', err);
      setModalError(msg);
      onToast(msg, 'error');
    } finally {
      setBgProgress(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setModalError(null);

    if (!draft.name.trim()) {
      const msg = 'Garment name is required.';
      setModalError(msg);
      onToast(msg, 'error');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = editingItem?.imageUrl;
      let thumbUrl = editingItem?.thumbUrl;
      let mediaId = editingItem?.mediaId;

      const activeImg =
        draft.useCutout && draft.cutoutPhotoUrl
          ? draft.cutoutPhotoUrl
          : draft.croppedPhotoUrl || draft.rawPhotoUrl;

      if (!activeImg) {
        imageUrl = undefined;
        thumbUrl = undefined;
        mediaId = undefined;
      } else if (activeImg.startsWith('data:')) {
        const uploaded = await uploadImageAsset(activeImg, userProfile.uid, draft.visibility, isDemoMode);
        imageUrl = uploaded.imageUrl;
        thumbUrl = uploaded.thumbUrl;
        mediaId = uploaded.mediaId;
      }

      const finalAlt =
        draft.altText.trim() ||
        buildAutoAltText({
          color: draft.color,
          brand: draft.brand,
          name: draft.name,
          category: draft.category,
        });

      const cleanedTags = dedupeStyleTags(draft.styleTags, userProfile.customStyles);
      const kind = getCategorySizeKind(draft.category);
      const finalSize =
        kind === 'footwear' && draft.size.trim()
          ? formatShoeSizeValue(shoeSizeSystem, draft.size)
          : draft.size.trim();
      const finalSizeSystem: SizeSystem | undefined =
        kind === 'footwear'
          ? shoeSizeSystem
          : kind === 'bottoms'
          ? bottomSizeMode
          : kind === 'tops'
          ? 'Letter'
          : 'Other';

      if (editingItem) {
        await editClothing(editingItem.id, {
          name: draft.name.trim(),
          category: draft.category,
          brand: draft.brand.trim() || 'Unbranded',
          color: draft.color.trim() || 'Neutral',
          size: finalSize,
          sizeSystem: finalSizeSystem,
          seasons: draft.seasons,
          styleTags: cleanedTags,
          visibility: draft.visibility,
          laundryStatus: draft.laundryStatus,
          description: draft.description.trim(),
          altText: finalAlt,
          imageUrl,
          thumbUrl,
          mediaId,
          isCutout: draft.useCutout,
        });
        onToast('Garment updated.');
      } else {
        await addClothing({
          name: draft.name.trim(),
          category: draft.category,
          brand: draft.brand.trim() || 'Unbranded',
          color: draft.color.trim() || 'Neutral',
          size: finalSize,
          sizeSystem: finalSizeSystem,
          seasons: draft.seasons,
          styleTags: cleanedTags,
          visibility: draft.visibility,
          laundryStatus: draft.laundryStatus,
          description: draft.description.trim(),
          altText: finalAlt,
          imageUrl,
          thumbUrl,
          mediaId,
          isCutout: draft.useCutout,
          wearCount: 0,
        });
        onToast('Added to My Wardrobe.');
      }

      forceCloseModal();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save garment. Your draft is still here.';
      console.error('Failed saving wardrobe item:', err);
      setModalError(msg);
      onToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sizeFilterOptions = useMemo(
    () => getSizeFilterOptionsForCategory(categoryFilter, wardrobe),
    [categoryFilter, wardrobe]
  );

  useEffect(() => {
    if (sizeFilter !== 'All' && !sizeFilterOptions.includes(sizeFilter)) {
      setSizeFilter('All');
    }
  }, [sizeFilterOptions, sizeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return wardrobe.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (sizeFilter !== 'All' && (item.size || '').trim().toLowerCase() !== sizeFilter.trim().toLowerCase()) {
        return false;
      }
      if (laundryFilter !== 'all' && item.laundryStatus !== laundryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q) ||
        (item.size || '').toLowerCase().includes(q) ||
        (item.styleTags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [wardrobe, search, categoryFilter, sizeFilter, laundryFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkClean = async () => {
    try {
      const ids = Array.from(selectedIds);
      await markManyClean(ids);
      setSelectedIds(new Set());
      onToast(`Marked ${ids.length} item${ids.length === 1 ? '' : 's'} as Clean.`);
    } catch (err: any) {
      console.error('Bulk clean failed:', err);
      onToast(err?.message || 'Could not update laundry status.', 'error');
    }
  };

  const dirtyCount = wardrobe.filter((w) => w.laundryStatus === 'dirty').length;
  const washingCount = wardrobe.filter((w) => w.laundryStatus === 'washing').length;

  const renderLaundryChip = (item: ClothingItem) => {
    const nextStatus =
      LAUNDRY_CYCLE[(LAUNDRY_CYCLE.indexOf(item.laundryStatus || 'clean') + 1) % LAUNDRY_CYCLE.length];

    const config =
      item.laundryStatus === 'dirty'
        ? {
            label: 'Dirty',
            Icon: AlertCircle,
            cls: 'border-amber-600/50 bg-amber-500/15 text-amber-800 dark:text-amber-300',
          }
        : item.laundryStatus === 'washing'
        ? {
            label: 'In the wash',
            Icon: Droplets,
            cls: 'border-sky-600/50 bg-sky-500/15 text-sky-800 dark:text-sky-300',
          }
        : {
            label: 'Clean',
            Icon: CheckCircle2,
            cls: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
          };

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

  const previewImg =
    draft.useCutout && draft.cutoutPhotoUrl
      ? draft.cutoutPhotoUrl
      : draft.croppedPhotoUrl || draft.rawPhotoUrl;

  const stepLabel =
    draft.step === 'photo'
      ? 'Step 1 of 3 · Photo'
      : draft.step === 'editor'
      ? 'Step 2 of 3 · Edit Photo'
      : editingItem
      ? 'Edit Garment'
      : 'Step 3 of 3 · Garment Details';

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
              className="px-4 py-2.5 min-h-[44px] rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark {selectedIds.size} Clean</span>
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="px-5 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-2 hover:opacity-90 cursor-pointer"
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {(['All', ...CLOTHING_CATEGORIES] as const).map((cat) => (
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

          {sizeFilterOptions.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <label
                htmlFor="wardrobe-size-filter"
                className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]"
              >
                Size
              </label>
              <select
                id="wardrobe-size-filter"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                <option value="All">All sizes</option>
                {sizeFilterOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Wardrobe Grid (3 columns on mobile, 4 on desktop) */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
          <p className="font-display font-bold text-base">No garments found</p>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Adjust your filters or add a new piece to your digital wardrobe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const laundryDotCls =
              item.laundryStatus === 'dirty'
                ? 'bg-amber-500'
                : item.laundryStatus === 'washing'
                ? 'bg-sky-500'
                : 'bg-emerald-500';

            return (
              <article
                key={item.id}
                className="group relative rounded-control sm:rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setDetailItem(item)}
                  aria-label={`Open ${item.name} details`}
                  className="w-full block text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] dark:focus-visible:ring-[#e5e1da]"
                >
                  <div className="relative aspect-square bg-[#eae7e0] dark:bg-[#171717] overflow-hidden">
                    <GarmentImage
                      src={item.thumbUrl || item.imageUrl}
                      mediaId={item.mediaId}
                      alt={item.altText || item.name}
                      fallbackLabel={item.name}
                      isCutout={item.isCutout}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <span
                      title={`Laundry: ${item.laundryStatus}`}
                      className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#171717] ${laundryDotCls}`}
                    />
                  </div>
                  <div className="p-1.5 sm:p-2.5 space-y-0.5">
                    <p className="text-[11px] sm:text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      {item.size ? `${item.size} · ` : ''}
                      {item.category}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  aria-label={isSelected ? `Deselect ${item.name}` : `Select ${item.name}`}
                  className="absolute top-1.5 left-1.5 p-1 rounded-chip bg-white/90 dark:bg-[#171717]/90 border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                >
                  {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Garment Detail Modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={detailItem.name}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailItem(null);
          }}
        >
          <div className="w-full max-w-lg rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
            <div className="px-5 py-3.5 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                  {detailItem.brand} · {detailItem.category}
                </p>
                <h2 className="font-display font-bold text-base truncate">{detailItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                aria-label="Close garment details"
                className="w-9 h-9 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[82vh] overflow-y-auto space-y-4">
              <div className="relative aspect-square max-h-72 mx-auto rounded-card overflow-hidden bg-[#eae7e0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]">
                <GarmentImage
                  src={detailItem.imageUrl || detailItem.thumbUrl}
                  mediaId={detailItem.mediaId}
                  alt={detailItem.altText || detailItem.name}
                  fallbackLabel={detailItem.name}
                  isCutout={detailItem.isCutout}
                />
                <div className="absolute top-2.5 right-2.5">
                  <VisibilityBadge
                    visibility={detailItem.visibility || 'public'}
                    onClick={() => {
                      const nextVis =
                        VISIBILITY_CYCLE[
                          (VISIBILITY_CYCLE.indexOf(detailItem.visibility || 'public') + 1) %
                            VISIBILITY_CYCLE.length
                        ];
                      editClothing(detailItem.id, { visibility: nextVis });
                      setDetailItem((prev) => (prev ? { ...prev, visibility: nextVis } : null));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-control bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]">
                  <p className="text-[10px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">Size</p>
                  <p className="font-semibold font-mono-num">{detailItem.size || '—'}</p>
                </div>
                <div className="p-2.5 rounded-control bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]">
                  <p className="text-[10px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">Color</p>
                  <p className="font-semibold truncate">{detailItem.color || 'Neutral'}</p>
                </div>
                <div className="p-2.5 rounded-control bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]">
                  <p className="text-[10px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">Wears</p>
                  <p className="font-semibold font-mono-num">{detailItem.wearCount || 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {renderLaundryChip(detailItem)}
                <div className="flex flex-wrap gap-1.5">
                  {(detailItem.seasons || []).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-[10px]"
                    >
                      {s}
                    </span>
                  ))}
                  {dedupeStyleTags(detailItem.styleTags || []).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-chip bg-[#eae7e0] dark:bg-[#303030] text-[10px] font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {detailItem.description && (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] leading-relaxed">
                  {detailItem.description}
                </p>
              )}

              <div className="pt-3 border-t border-[#d4cfc5] dark:border-[#404040] flex flex-wrap items-center gap-2">
                {onSharePiece && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailItem;
                      setDetailItem(null);
                      onSharePiece(target);
                    }}
                    className="px-4 py-2 min-h-[40px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Post this</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(detailItem)}
                  className="px-3.5 py-2 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await removeClothing(detailItem);
                      setDetailItem(null);
                      onToast('Removed from wardrobe.');
                    } catch (err: any) {
                      console.error('Delete wardrobe item error:', err);
                      onToast(err?.message || 'Could not remove garment.', 'error');
                    }
                  }}
                  className="px-3.5 py-2 min-h-[40px] rounded-control border border-red-500/40 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500/10 cursor-pointer ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Step Add / Edit Garment Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wardrobe-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) attemptCloseModal();
          }}
        >
          <div className="w-full max-w-xl rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between">
              <div>
                <h2 id="wardrobe-modal-title" className="font-display font-bold text-lg">
                  {editingItem ? 'Edit Garment' : 'Add Garment'}
                </h2>
                <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                  {stepLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={attemptCloseModal}
                aria-label="Close modal"
                className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ErrorBoundary title="Wardrobe editor ran into an issue" onReset={() => setModalError(null)}>
              <div className="p-6 max-h-[82vh] overflow-y-auto space-y-4">
                {modalError && (
                  <div
                    role="alert"
                    className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* STEP 1: Pick or Capture Photo */}
                {draft.step === 'photo' && (
                  <div className="space-y-4 py-2">
                    <div className="rounded-card border border-dashed border-[#a5a5a5] bg-white dark:bg-[#171717] p-6 text-center space-y-4">
                      {preparingPhoto ? (
                        <div className="py-6 flex flex-col items-center gap-2 text-xs font-semibold">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Preparing photo for editor...</span>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <p className="font-display font-bold text-base">Choose a garment photo</p>
                            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                              Pick a photo from your device. Next you&rsquo;ll crop &amp; frame it, then add details.
                            </p>
                          </div>
                          <div className="flex justify-center">
                            <PhotoPickerButton
                              label="Choose Photo"
                              busyLabel="Preparing photo..."
                              busy={preparingPhoto}
                              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold cursor-pointer hover:opacity-90"
                              onFileSelected={processSelectedFile}
                              onError={(msg) => {
                                setModalError(msg);
                                onToast(msg, 'error');
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={attemptCloseModal}
                        className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ step: 'details' })}
                        className="text-xs font-semibold underline text-[#4e4c46] dark:text-[#c2bfb8] hover:text-[#171717] dark:hover:text-[#e5e1da] min-h-[44px] px-2 cursor-pointer"
                      >
                        Skip photo &amp; enter details
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Interactive Photo Editor (Zoom, Drag, Done -> Details) */}
                {draft.step === 'editor' && draft.rawPhotoUrl && (
                  <PhotoCropEditor
                    sourceUrl={draft.rawPhotoUrl}
                    initialCrop={draft.cropState}
                    defaultAspect={'1:1' as CropAspectKey}
                    allowAspectSwitch={false}
                    title="Crop & Frame Garment"
                    subtitle="Drag to center your garment, adjust zoom, then tap Done to add details."
                    backLabel={editingItem ? 'Back to Details' : 'Back'}
                    doneLabel="Done"
                    onBack={() =>
                      updateDraft({
                        step: editingItem || draft.croppedPhotoUrl ? 'details' : 'photo',
                      })
                    }
                    onChangePhotoFile={processSelectedFile}
                    onDone={({ croppedDataUrl, cropState }) => {
                      updateDraft((prev) => ({
                        ...prev,
                        step: 'details',
                        croppedPhotoUrl: croppedDataUrl,
                        cropState,
                        cutoutPhotoUrl: null,
                        useCutout: false,
                      }));
                    }}
                  />
                )}

                {/* STEP 3: Garment Details Screen + Save item */}
                {draft.step === 'details' && (
                  <form onSubmit={handleSave} className="space-y-4">
                    {/* Cropped Photo Summary + Back to Editor + Background Cutout */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                          Garment Photo
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {previewImg && (
                            <button
                              type="button"
                              onClick={handleOpenEditorFromDetails}
                              disabled={resolvingForCrop}
                              className="px-2.5 py-1.5 min-h-[34px] rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-[11px] font-medium inline-flex items-center gap-1 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                            >
                              {resolvingForCrop ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Crop className="w-3 h-3" />
                              )}
                              <span>Edit Crop</span>
                            </button>
                          )}
                          {previewImg && (
                            <button
                              type="button"
                              onClick={handleRemoveBg}
                              disabled={bgProgress !== null}
                              className="px-2.5 py-1.5 min-h-[34px] rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-[11px] font-medium inline-flex items-center gap-1 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                            >
                              <Scissors className="w-3 h-3" />
                              <span>
                                {bgProgress !== null ? `Removing (${bgProgress}%)` : 'Remove background'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {previewImg ? (
                        <div className="space-y-2">
                          <div className="relative h-48 rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#171717]">
                            <GarmentImage
                              src={previewImg}
                              mediaId={editingItem?.mediaId}
                              alt="Garment preview"
                              isCutout={draft.useCutout}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft({
                                  rawPhotoUrl: null,
                                  cropState: null,
                                  croppedPhotoUrl: null,
                                  cutoutPhotoUrl: null,
                                  useCutout: false,
                                })
                              }
                              aria-label="Clear photo"
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {draft.cutoutPhotoUrl && (
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => updateDraft({ useCutout: false })}
                                className={`px-3 py-1.5 rounded-chip border cursor-pointer ${
                                  !draft.useCutout
                                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                                    : 'border-[#d4cfc5] dark:border-[#404040]'
                                }`}
                              >
                                Keep Original
                              </button>
                              <button
                                type="button"
                                onClick={() => updateDraft({ useCutout: true })}
                                className={`px-3 py-1.5 rounded-chip border cursor-pointer ${
                                  draft.useCutout
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
                        <PhotoPickerButton
                          label="Choose Photo"
                          busyLabel="Preparing photo..."
                          busy={preparingPhoto}
                          className="w-full flex items-center justify-center gap-2 p-3.5 min-h-[44px] rounded-control border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] cursor-pointer text-xs font-semibold"
                          onFileSelected={processSelectedFile}
                          onError={(msg) => {
                            setModalError(msg);
                            onToast(msg, 'error');
                          }}
                        />
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
                          value={draft.name}
                          onChange={(e) => updateDraft({ name: e.target.value })}
                          placeholder="Boxy Heavyweight Tee"
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                          Brand
                        </label>
                        <input
                          type="text"
                          value={draft.brand}
                          onChange={(e) => updateDraft({ brand: e.target.value })}
                          placeholder="Entire Studios"
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                          Category
                        </label>
                        <select
                          value={draft.category}
                          onChange={(e) => {
                            const nextCat = e.target.value as ClothingCategory;
                            const nextKind = getCategorySizeKind(nextCat);
                            const valid = isSizeValidForCategory(draft.size, nextCat);
                            if (!valid && draft.size.trim()) {
                              setSizeResetWarning(
                                'Size cleared because it does not match the new category.'
                              );
                            } else {
                              setSizeResetWarning(null);
                            }
                            if (nextKind === 'accessories') {
                              setAccessoryOtherMode(
                                valid &&
                                  Boolean(draft.size) &&
                                  !(ACCESSORY_PRESET_SIZES as readonly string[]).includes(draft.size)
                              );
                            } else if (nextKind === 'bottoms') {
                              const isW = WAIST_SIZES.includes(
                                (valid ? draft.size : '').replace(/^(W|Waist)\s*/i, '')
                              );
                              setBottomSizeMode(isW ? 'Waist' : 'Letter');
                            }
                            updateDraft((prev) => ({
                              ...prev,
                              category: nextCat,
                              size: valid ? prev.size : '',
                              sizeSystem:
                                nextKind === 'footwear'
                                  ? shoeSizeSystem
                                  : nextKind === 'bottoms'
                                  ? bottomSizeMode
                                  : nextKind === 'tops'
                                  ? 'Letter'
                                  : 'Other',
                            }));
                          }}
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                        >
                          {CLOTHING_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                          Color
                        </label>
                        <input
                          type="text"
                          value={draft.color}
                          onChange={(e) => updateDraft({ color: e.target.value })}
                          placeholder="Charcoal"
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                        />
                      </div>
                    </div>

                    {/* Category-Aware Size Picker */}
                    <div className="p-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                          Size ({draft.category})
                        </label>

                        {getCategorySizeKind(draft.category) === 'bottoms' && (
                          <div className="inline-flex rounded-chip border border-[#d4cfc5] dark:border-[#404040] overflow-hidden text-[11px]">
                            {(['Letter', 'Waist'] as BottomSizeMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setBottomSizeMode(mode)}
                                className={`px-2.5 py-1 font-semibold cursor-pointer ${
                                  bottomSizeMode === mode
                                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                                    : ''
                                }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        )}

                        {getCategorySizeKind(draft.category) === 'footwear' && (
                          <div className="inline-flex rounded-chip border border-[#d4cfc5] dark:border-[#404040] overflow-hidden text-[11px]">
                            {SHOE_SIZE_SYSTEMS.map((sys) => (
                              <button
                                key={sys}
                                type="button"
                                onClick={() => {
                                  setShoeSizeSystem(sys);
                                  savePreferredShoeSystem(sys, userProfile?.uid);
                                  updateDraft({ size: '', sizeSystem: sys });
                                }}
                                className={`px-2.5 py-1 font-semibold cursor-pointer ${
                                  shoeSizeSystem === sys
                                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                                    : ''
                                }`}
                              >
                                {sys}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {sizeResetWarning && (
                        <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                          {sizeResetWarning}
                        </p>
                      )}

                      {getCategorySizeKind(draft.category) === 'tops' && (
                        <div className="flex flex-wrap gap-1.5">
                          {TOP_SIZES.map((sz) => {
                            const active = draft.size === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setSizeResetWarning(null);
                                  updateDraft({ size: sz, sizeSystem: 'Letter' });
                                }}
                                className={`px-3 py-1.5 min-h-[34px] rounded-chip text-xs font-semibold border cursor-pointer ${
                                  active
                                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                                    : 'border-[#d4cfc5] dark:border-[#404040]'
                                }`}
                              >
                                {sz}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {getCategorySizeKind(draft.category) === 'bottoms' && (
                        <div className="flex flex-wrap gap-1.5">
                          {(bottomSizeMode === 'Letter'
                            ? [...LETTER_SIZES, 'One size']
                            : [...WAIST_SIZES, 'One size']
                          ).map((sz) => {
                            const active = draft.size === sz;
                            return (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => {
                                  setSizeResetWarning(null);
                                  updateDraft({ size: sz, sizeSystem: bottomSizeMode });
                                }}
                                className={`px-3 py-1.5 min-h-[34px] rounded-chip text-xs font-semibold border cursor-pointer ${
                                  active
                                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                                    : 'border-[#d4cfc5] dark:border-[#404040]'
                                }`}
                              >
                                {sz}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {getCategorySizeKind(draft.category) === 'footwear' && (
                        <select
                          value={parseShoeSizeValue(draft.size, shoeSizeSystem).value}
                          onChange={(e) => {
                            setSizeResetWarning(null);
                            const raw = e.target.value;
                            updateDraft({
                              size: raw ? formatShoeSizeValue(shoeSizeSystem, raw) : '',
                              sizeSystem: shoeSizeSystem,
                            });
                          }}
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                        >
                          <option value="">Select {shoeSizeSystem} shoe size...</option>
                          {getShoeSizesForSystem(shoeSizeSystem).map((sz) => (
                            <option key={sz} value={sz}>
                              {shoeSizeSystem} {sz}
                            </option>
                          ))}
                        </select>
                      )}

                      {getCategorySizeKind(draft.category) === 'accessories' && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {ACCESSORY_PRESET_SIZES.map((sz) => {
                              const active = !accessoryOtherMode && draft.size === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => {
                                    setAccessoryOtherMode(false);
                                    setSizeResetWarning(null);
                                    updateDraft({ size: sz, sizeSystem: 'Other' });
                                  }}
                                  className={`px-3 py-1.5 min-h-[34px] rounded-chip text-xs font-semibold border cursor-pointer ${
                                    active
                                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                                      : 'border-[#d4cfc5] dark:border-[#404040]'
                                  }`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => {
                                setAccessoryOtherMode(true);
                                setSizeResetWarning(null);
                                if ((ACCESSORY_PRESET_SIZES as readonly string[]).includes(draft.size)) {
                                  updateDraft({ size: '', sizeSystem: 'Other' });
                                }
                              }}
                              className={`px-3 py-1.5 min-h-[34px] rounded-chip text-xs font-semibold border cursor-pointer ${
                                accessoryOtherMode
                                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                                  : 'border-dashed border-[#4e4c46] dark:border-[#888888]'
                              }`}
                            >
                              Other
                            </button>
                          </div>
                          {accessoryOtherMode && (
                            <input
                              type="text"
                              maxLength={32}
                              value={draft.size}
                              onChange={(e) => updateDraft({ size: e.target.value, sizeSystem: 'Other' })}
                              placeholder="e.g. Ring 8, Belt 34 in, Cap 7 1/4"
                              className="w-full px-3 py-2 min-h-[40px] rounded-control text-xs bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                            />
                          )}
                        </div>
                      )}

                      {getCategorySizeKind(draft.category) === 'other' && (
                        <input
                          type="text"
                          maxLength={32}
                          value={draft.size}
                          onChange={(e) => {
                            setSizeResetWarning(null);
                            updateDraft({ size: e.target.value, sizeSystem: 'Other' });
                          }}
                          placeholder="Enter size (e.g. M, 32, OS, Custom)"
                          className="w-full px-3 py-2 min-h-[40px] rounded-control text-xs bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                        />
                      )}
                    </div>

                    {/* Seasons & Style Tags */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                        Seasons
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SEASON_TAGS.map((s) => {
                          const active = draft.seasons.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  seasons: prev.seasons.includes(s)
                                    ? prev.seasons.length > 1
                                      ? prev.seasons.filter((x) => x !== s)
                                      : prev.seasons
                                    : [...prev.seasons, s],
                                }))
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

                    <StyleTagSelector
                      label="Style Tags"
                      selected={draft.styleTags}
                      onChange={(next) => updateDraft({ styleTags: next })}
                      onError={(msg) => setModalError(msg)}
                    />

                    {/* Visibility & Laundry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                          Visibility
                        </label>
                        <select
                          value={draft.visibility}
                          onChange={(e) => updateDraft({ visibility: e.target.value as Visibility })}
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                        >
                          <option value="public">Public (Visible on profile & lookbooks)</option>
                          <option value="friends">Friends only</option>
                          <option value="followers">Followers only</option>
                          <option value="private">Private (Hidden from others)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                          Laundry Status (Always Private)
                        </label>
                        <select
                          value={draft.laundryStatus}
                          onChange={(e) => updateDraft({ laundryStatus: e.target.value as LaundryStatus })}
                          className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
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
                        value={draft.altText}
                        onChange={(e) => updateDraft({ altText: e.target.value })}
                        placeholder={buildAutoAltText({
                          color: draft.color,
                          brand: draft.brand,
                          name: draft.name,
                          category: draft.category,
                        })}
                        className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                        Fabric / Fit Notes
                      </label>
                      <textarea
                        rows={2}
                        value={draft.description}
                        onChange={(e) => updateDraft({ description: e.target.value })}
                        placeholder="Heavyweight 320gsm cotton, boxy shoulder drape..."
                        className="w-full px-3 py-2 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                      />
                    </div>

                    <div className="pt-2 border-t border-[#d4cfc5] dark:border-[#404040] flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={saving || resolvingForCrop}
                        onClick={() => {
                          if (draft.rawPhotoUrl || draft.croppedPhotoUrl) {
                            handleOpenEditorFromDetails();
                          } else {
                            updateDraft({ step: 'photo' });
                          }
                        }}
                        className="px-3.5 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{draft.rawPhotoUrl || draft.croppedPhotoUrl ? 'Back to Editor' : 'Back to Photo'}</span>
                      </button>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={attemptCloseModal}
                          disabled={saving}
                          className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-5 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Save item'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </ErrorBoundary>
          </div>
        </div>
      )}

      <DiscardDraftDialog
        open={discardPromptOpen}
        title={editingItem ? 'Discard garment changes?' : 'Discard this item?'}
        description="You have unsaved garment details or a photo draft. Leaving now will discard them."
        onKeep={() => setDiscardPromptOpen(false)}
        onDiscard={forceCloseModal}
      />
    </div>
  );
};
