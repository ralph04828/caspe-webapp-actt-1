import React, { useEffect, useMemo, useState } from 'react';
import { CommentPolicy, Outfit, OutfitPieceSnapshot, PostType, Visibility } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { preparePreviewAsset, preparePreviewDataUrl, uploadImageAsset } from '../services/storageService';
import { removeBackgroundClient } from '../utils/bgRemoval';
import {
  formatAspectRatioFromDimensions,
  resolveDisplayAspectRatio,
} from '../utils/aspectRatio';
import {
  getDraftSessionKey,
  loadSessionJson,
  removeSessionKey,
  saveSessionJson,
} from '../utils/draftStorage';
import { loadIdbDraft, removeIdbDraft, saveIdbDraft } from '../utils/indexedDbDrafts';
import { GarmentImage } from './GarmentImage';
import { PhotoCropState, PhotoEditorModal, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { ErrorBoundary } from './ErrorBoundary';
import {
  AlertCircle,
  X,
  Scissors,
  Globe,
  Users,
  Lock,
  Repeat,
  Loader2,
  Calendar,
  Crop,
} from 'lucide-react';

interface StagedPhoto {
  rawDataUrl: string;
  croppedDataUrl?: string | null;
  cropState?: PhotoCropState | null;
  aspectRatio?: string;
  width?: number;
  height?: number;
  cutoutDataUrl: string | null;
  useCutout: boolean;
  altText: string;
}

interface CreatePostDraft {
  postType: PostType;
  selectedOutfitId: string;
  selectedItemId: string;
  caption: string;
  occasion: string;
  visibility: Visibility;
  allowRemix: boolean;
  commentPolicy: CommentPolicy;
  photos: StagedPhoto[];
}

interface CreatePostModalProps {
  open: boolean;
  initialOutfitId?: string;
  initialItemId?: string;
  initialPlannedOutfit?: { outfit: Outfit; date: string } | null;
  onOpenCreateMyDay?: () => void;
  onClose: () => void;
  onPublished: (message: string) => void;
  onToast?: (message: string, type?: 'success' | 'error') => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  open,
  initialOutfitId,
  initialItemId,
  initialPlannedOutfit,
  onOpenCreateMyDay,
  onClose,
  onPublished,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const { wardrobe, outfits } = useWardrobe();
  const { publishPost } = useSocial();

  const draftKey = getDraftSessionKey('create_post', userProfile?.uid || 'anon');

  const [postType, setPostType] = useState<PostType>(
    initialPlannedOutfit ? 'outfit' : initialOutfitId ? 'outfit' : initialItemId ? 'piece' : 'outfit'
  );
  const [selectedOutfitId, setSelectedOutfitId] = useState(
    initialPlannedOutfit?.outfit.id || initialOutfitId || outfits[0]?.id || ''
  );
  const [selectedItemId, setSelectedItemId] = useState(initialItemId || wardrobe[0]?.id || '');
  const [caption, setCaption] = useState('');
  const [occasion, setOccasion] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(userProfile?.defaultOutfitVisibility || 'public');
  const [allowRemix, setAllowRemix] = useState(true);
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>('everyone');
  const [isPlannedCopy, setIsPlannedCopy] = useState(false);

  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Sub-modal photo crop editor (either adding a new single photo OR re-editing existing index)
  const [editorState, setEditorState] = useState<{
    mode: 'new' | 'edit';
    index?: number;
    sourceUrl: string;
    initialCrop: PhotoCropState | null;
  } | null>(null);

  const resetComposer = () => {
    setPostType('outfit');
    setSelectedOutfitId(outfits[0]?.id || '');
    setSelectedItemId(wardrobe[0]?.id || '');
    setCaption('');
    setOccasion('');
    setVisibility(userProfile?.defaultOutfitVisibility || 'public');
    setAllowRemix(true);
    setCommentPolicy('everyone');
    setIsPlannedCopy(false);
    setPhotos([]);
    setError(null);
    setEditorState(null);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);

    let cancelled = false;
    if (initialPlannedOutfit) {
      setPostType('outfit');
      setSelectedOutfitId(initialPlannedOutfit.outfit.id);
      setIsPlannedCopy(true);
      setCaption(
        `Fit lined up for ${initialPlannedOutfit.date}: ${initialPlannedOutfit.outfit.name} #fitcheck`
      );
      setOccasion(initialPlannedOutfit.outfit.occasion || '');
    } else if (initialOutfitId) {
      setPostType('outfit');
      setSelectedOutfitId(initialOutfitId);
      setIsPlannedCopy(false);
    } else if (initialItemId) {
      setPostType('piece');
      setSelectedItemId(initialItemId);
      setIsPlannedCopy(false);
    } else {
      setIsPlannedCopy(false);
      const applyDraft = (saved: CreatePostDraft | null) => {
        if (!saved) return false;
        const hasData =
          (Array.isArray(saved.photos) && saved.photos.length > 0) ||
          Boolean(saved.caption?.trim()) ||
          Boolean(saved.occasion?.trim());
        if (!hasData) return false;
        setPostType(saved.postType || 'outfit');
        setSelectedOutfitId(saved.selectedOutfitId || outfits[0]?.id || '');
        setSelectedItemId(saved.selectedItemId || wardrobe[0]?.id || '');
        setCaption(saved.caption || '');
        setOccasion(saved.occasion || '');
        setVisibility(saved.visibility || userProfile?.defaultOutfitVisibility || 'public');
        setAllowRemix(saved.allowRemix !== false);
        setCommentPolicy(saved.commentPolicy || 'everyone');
        setPhotos(Array.isArray(saved.photos) ? saved.photos.slice(0, 10) : []);
        return true;
      };

      const savedSession = loadSessionJson<CreatePostDraft>(draftKey);
      const restoredFromSession = applyDraft(savedSession);

      loadIdbDraft<CreatePostDraft>(draftKey).then((idbDraft) => {
        if (cancelled || !idbDraft) return;
        if (!restoredFromSession || (Array.isArray(idbDraft.photos) && idbDraft.photos.length > 0 && (!savedSession?.photos || savedSession.photos.length === 0))) {
          applyDraft(idbDraft);
        }
      });

      if (!restoredFromSession) {
        if (!selectedOutfitId && outfits[0]?.id) setSelectedOutfitId(outfits[0].id);
        if (!selectedItemId && wardrobe[0]?.id) setSelectedItemId(wardrobe[0].id);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [open, initialOutfitId, initialItemId, initialPlannedOutfit, draftKey]);

  // Keep draft synced to IndexedDB (photos + fields) and lightweight metadata to sessionStorage
  useEffect(() => {
    if (!open || isPlannedCopy || initialOutfitId || initialItemId) return;
    const fullPayload: CreatePostDraft = {
      postType,
      selectedOutfitId,
      selectedItemId,
      caption,
      occasion,
      visibility,
      allowRemix,
      commentPolicy,
      photos,
    };
    const hasContent = Boolean(photos.length > 0 || caption.trim() || occasion.trim());
    if (!hasContent) {
      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      return;
    }
    saveIdbDraft(draftKey, fullPayload);
    saveSessionJson(draftKey, {
      ...fullPayload,
      photos: photos.length <= 2 ? photos : [],
    });
  }, [
    open,
    isPlannedCopy,
    initialOutfitId,
    initialItemId,
    draftKey,
    postType,
    selectedOutfitId,
    selectedItemId,
    caption,
    occasion,
    visibility,
    allowRemix,
    commentPolicy,
    photos,
  ]);

  const hasUnsavedDraft = useMemo(
    () => Boolean(photos.length > 0 || caption.trim() || occasion.trim()),
    [photos.length, caption, occasion]
  );

  const attemptClose = () => {
    if (submitting || bgProcessing) return;
    if (hasUnsavedDraft) {
      setDiscardOpen(true);
      return;
    }
    forceClose();
  };

  const forceClose = () => {
    setDiscardOpen(false);
    removeSessionKey(draftKey);
    removeIdbDraft(draftKey);
    resetComposer();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !discardOpen && !editorState) {
        attemptClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, discardOpen, editorState, hasUnsavedDraft, submitting, bgProcessing]);

  if (!open) return null;

  const handleFilesSelected = async (selectedFiles: File[]) => {
    const remaining = Math.max(0, 10 - photos.length);
    const files = selectedFiles.slice(0, remaining);
    if (files.length === 0) return;
    setError(null);
    const defaultSharedAspect = photos[0]?.cropState?.aspectKey || '4:5';
    if (files.length === 1) {
      const compressed = await preparePreviewAsset(files[0]);
      setEditorState({
        mode: 'new',
        sourceUrl: compressed.dataUrl,
        initialCrop: createDefaultCropState(defaultSharedAspect),
      });
      return;
    }

    const added: StagedPhoto[] = [];
    for (const file of files) {
      const compressed = await preparePreviewAsset(file);
      added.push({
        rawDataUrl: compressed.dataUrl,
        croppedDataUrl: compressed.dataUrl,
        cropState: null,
        aspectRatio: formatAspectRatioFromDimensions(compressed.width, compressed.height, {
          clampToFeed: true,
        }),
        width: compressed.width,
        height: compressed.height,
        cutoutDataUrl: null,
        useCutout: false,
        altText: '',
      });
    }
    setPhotos((prev) => [...prev, ...added].slice(0, 10));
  };

  const handleRemoveBackgroundFirst = async () => {
    const first = photos[0];
    if (!first) return;
    setBgProcessing(true);
    setError(null);
    try {
      const source = first.croppedDataUrl || first.rawDataUrl;
      const res = await removeBackgroundClient(source, 36);
      setPhotos((prev) =>
        prev.map((p, idx) =>
          idx === 0 ? { ...p, cutoutDataUrl: res.cutoutDataUrl, useCutout: true } : p
        )
      );
    } catch (err: any) {
      const msg = err?.message || 'Background removal unavailable for this image; keeping original.';
      console.error('Background removal error:', err);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setBgProcessing(false);
    }
  };

  const buildIndependentPlannedSnapshot = (outfit: Outfit): OutfitPieceSnapshot[] => {
    const snaps: OutfitPieceSnapshot[] = [];
    const pushSlot = (slot: OutfitPieceSnapshot['slot'], id?: string) => {
      if (!id) return;
      const item = wardrobe.find((w) => w.id === id);
      if (!item) return;
      const priv = item.visibility === 'private';
      snaps.push({
        id: item.id,
        slot,
        name: priv ? 'Private piece' : item.name,
        category: item.category,
        brand: priv ? '' : item.brand || '',
        color: priv ? '' : item.color || '',
        imageUrl: priv ? undefined : item.thumbUrl || item.imageUrl,
        thumbUrl: priv ? undefined : item.thumbUrl,
        mediaId: priv ? undefined : item.mediaId,
        visibility: item.visibility,
        isPrivatePlaceholder: priv,
      });
    };
    pushSlot('top', outfit.topId);
    pushSlot('bottom', outfit.bottomId);
    pushSlot('shoes', outfit.shoesId);
    (outfit.accessoryIds || []).forEach((aid) => pushSlot('accessory', aid));
    return snaps;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || submitting) return;
    setError(null);

    if (!caption.trim()) {
      const msg = 'Add a caption or #hashtags to share your post.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }

    const chosenOutfit =
      postType === 'outfit'
        ? (isPlannedCopy && initialPlannedOutfit?.outfit) ||
          outfits.find((o) => o.id === selectedOutfitId)
        : undefined;
    const chosenItem = postType === 'piece' ? wardrobe.find((w) => w.id === selectedItemId) : undefined;

    if (postType === 'outfit' && !chosenOutfit && photos.length === 0) {
      const msg = 'Select an outfit from My Lookbook or upload a photo.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }
    if (postType === 'piece' && !chosenItem) {
      const msg = 'Select a wardrobe piece to highlight.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }
    if (postType === 'ootd' && photos.length === 0) {
      const msg = 'Upload a photo for your Outfit of the Day post.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedList: {
        imageUrl: string;
        thumbUrl: string;
        mediaId: string;
        altText: string;
        width: number;
        height: number;
        aspectRatio?: string;
      }[] = [];
      for (const p of photos) {
        const active =
          p.useCutout && p.cutoutDataUrl
            ? p.cutoutDataUrl
            : p.croppedDataUrl || p.rawDataUrl;
        const up = await uploadImageAsset(active, userProfile.uid, visibility, isDemoMode);
        uploadedList.push({
          imageUrl: up.imageUrl,
          thumbUrl: up.thumbUrl,
          mediaId: up.mediaId,
          altText: p.altText.trim() || 'Fit photo',
          width: up.width,
          height: up.height,
          aspectRatio:
            p.aspectRatio ||
            p.cropState?.aspectKey ||
            formatAspectRatioFromDimensions(up.width, up.height, { clampToFeed: true }),
        });
      }

      const primaryPhoto = uploadedList[0];
      const sharedAspectRatio =
        primaryPhoto?.aspectRatio ||
        (primaryPhoto
          ? formatAspectRatioFromDimensions(primaryPhoto.width, primaryPhoto.height, {
              clampToFeed: true,
            })
          : undefined);

      const plannedPieces =
        isPlannedCopy && chosenOutfit ? buildIndependentPlannedSnapshot(chosenOutfit) : undefined;

      await publishPost({
        postType,
        caption,
        visibility,
        allowRemix,
        commentPolicy,
        outfit: isPlannedCopy ? undefined : chosenOutfit,
        plannedPieces,
        item: chosenItem,
        wardrobe,
        mediaUrl: uploadedList[0]?.imageUrl,
        thumbUrl: uploadedList[0]?.thumbUrl,
        mediaId: uploadedList[0]?.mediaId,
        mediaUrls: uploadedList.length ? uploadedList.map((u) => u.imageUrl) : undefined,
        thumbUrls: uploadedList.length ? uploadedList.map((u) => u.thumbUrl) : undefined,
        mediaIds: uploadedList.length ? uploadedList.map((u) => u.mediaId) : undefined,
        altText: uploadedList[0]?.altText,
        altTexts: uploadedList.length ? uploadedList.map((u) => u.altText) : undefined,
        aspectRatio: sharedAspectRatio,
        width: primaryPhoto?.width,
        height: primaryPhoto?.height,
        mediaDimensions: uploadedList.length
          ? uploadedList.map((u) => ({ width: u.width, height: u.height }))
          : undefined,
        occasion: occasion.trim() || undefined,
        styleTags: chosenOutfit
          ? [chosenOutfit.styleCategory, ...(chosenOutfit.tags || []).slice(0, 2)]
          : chosenItem?.styleTags || ['Streetwear'],
      });

      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      resetComposer();
      onPublished('Shared to the SWOOOSH feed.');
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Could not publish post. Please try again.';
      console.error('Publish post failed:', err);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-post-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) attemptClose();
        }}
      >
        <div className="w-full max-w-lg rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-2xl overflow-hidden my-auto">
          <div className="px-6 py-4 border-b border-[#d4cfc5] dark:border-[#404040] flex items-center justify-between">
            <div>
              <h2 id="create-post-title" className="font-display font-bold text-lg">
                Create Post
              </h2>
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                Share an OOTD, lookbook fit, wardrobe piece, or planned outfit copy.
              </p>
            </div>
            <button
              type="button"
              onClick={attemptClose}
              aria-label="Close create post dialog"
              className="w-11 h-11 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ErrorBoundary title="Post composer ran into an issue" onReset={() => setError(null)}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isPlannedCopy && (
                <div className="p-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] text-xs flex items-center gap-2">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    Posting an independent snapshot of your planned outfit — your private calendar stays separate.
                  </span>
                </div>
              )}

              {/* Post Type Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'outfit', label: 'Lookbook Fit' },
                    { id: 'piece', label: 'Piece' },
                    { id: 'ootd', label: 'OOTD Photo' },
                  ] as { id: PostType; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPostType(tab.id)}
                    className={`py-2 px-3 min-h-[42px] rounded-control text-xs font-semibold border transition-colors cursor-pointer ${
                      postType === tab.id
                        ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                        : 'border-[#d4cfc5] dark:border-[#404040] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {postType === 'outfit' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                    Choose from My Lookbook
                  </label>
                  <select
                    value={selectedOutfitId}
                    onChange={(e) => setSelectedOutfitId(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    {outfits.length === 0 && <option value="">No saved outfits yet</option>}
                    {outfits.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.styleCategory})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {postType === 'piece' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                    Choose from My Wardrobe
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    {wardrobe.length === 0 && <option value="">No wardrobe items yet</option>}
                    {wardrobe.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.brand} ({item.color})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Multi-photo Upload (up to 10) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    {postType === 'ootd' ? 'OOTD Photos (up to 10)' : 'Photos (Optional, up to 10)'}
                  </label>
                  {photos.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveBackgroundFirst}
                      disabled={bgProcessing}
                      className="text-[11px] font-medium inline-flex items-center gap-1 px-2 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                    >
                      {bgProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                      <span>{bgProcessing ? 'Processing...' : 'Cutout photo 1'}</span>
                    </button>
                  )}
                </div>

                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((p, idx) => {
                      const preview =
                        p.useCutout && p.cutoutDataUrl
                          ? p.cutoutDataUrl
                          : p.croppedDataUrl || p.rawDataUrl;
                      const previewAspect = resolveDisplayAspectRatio({
                        aspectRatio: p.aspectRatio || p.cropState?.aspectKey,
                        width: p.width,
                        height: p.height,
                        fallbackRatio: 1,
                        maxHeightCss: '15rem',
                      });
                      return (
                        <div
                          key={idx}
                          className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#171717] overflow-hidden p-1.5 space-y-1.5"
                        >
                          <div className="rounded-chip overflow-hidden bg-[#eae7e0] dark:bg-[#242424] flex items-center justify-center">
                            <div className="relative w-full mx-auto overflow-hidden" style={previewAspect.frameStyle}>
                              <GarmentImage src={preview} alt={p.altText || `Photo ${idx + 1}`} isCutout={p.useCutout} />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorState({
                                    mode: 'edit',
                                    index: idx,
                                    sourceUrl: p.rawDataUrl,
                                    initialCrop: p.cropState || createDefaultCropState('4:5'),
                                  })
                                }
                                aria-label={`Edit crop for photo ${idx + 1}`}
                                className="absolute bottom-1.5 left-1.5 px-2 py-1 rounded-chip bg-black/75 text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-black"
                              >
                              <Crop className="w-3 h-3" />
                              <span>Edit Crop</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                              aria-label={`Remove photo ${idx + 1}`}
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/75 text-white flex items-center justify-center cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={p.altText}
                            onChange={(e) =>
                              setPhotos((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, altText: e.target.value } : item))
                              )
                            }
                            placeholder={`Alt text for photo ${idx + 1}`}
                            className="w-full px-2 py-1 rounded-chip text-[11px] bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {photos.length < 10 && (
                  <PhotoPickerButton
                    multiple={true}
                    label={`Choose Photos (${photos.length}/10)`}
                    busyLabel="Preparing photos..."
                    className="w-full flex items-center justify-center gap-2 p-3 min-h-[44px] rounded-control border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-white/60 dark:bg-[#171717]/60 hover:bg-white dark:hover:bg-[#171717] cursor-pointer text-xs font-semibold"
                    onFilesSelected={handleFilesSelected}
                    onError={(msg) => {
                      setError(msg);
                      onToast?.(msg, 'error');
                    }}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Caption (#hashtags & @mentions supported)
                </label>
                <textarea
                  rows={3}
                  required
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Rainy morning studio layers. #streetwear #monochrome"
                  className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Occasion
                </label>
                <input
                  type="text"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  placeholder="Studio, Coffee, Campus"
                  className="w-full px-3 py-2 min-h-[42px] rounded-control text-sm bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              {/* Visibility & Comment Policy */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                    Who can see this
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'public', label: 'Public', Icon: Globe },
                        { id: 'friends', label: 'Friends', Icon: Users },
                        { id: 'followers', label: 'Followers', Icon: Users },
                        { id: 'private', label: 'Private', Icon: Lock },
                      ] as { id: Visibility; label: string; Icon: any }[]
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setVisibility(id)}
                        className={`py-2 px-2 min-h-[40px] rounded-control text-[11px] font-medium border flex items-center justify-center gap-1 cursor-pointer ${
                          visibility === id
                            ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                            : 'border-[#d4cfc5] dark:border-[#404040]'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                    Who can comment
                  </label>
                  <select
                    value={commentPolicy}
                    onChange={(e) => setCommentPolicy(e.target.value as CommentPolicy)}
                    className="w-full px-3 py-2 min-h-[42px] rounded-control text-xs bg-white dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="friends">Friends only</option>
                    <option value="followers">Followers only</option>
                    <option value="off">Comments off</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRemix}
                  onChange={(e) => setAllowRemix(e.target.checked)}
                  className="w-4 h-4 accent-[#171717] dark:accent-[#e5e1da]"
                />
                <Repeat className="w-3.5 h-3.5" />
                <span>Allow others to remix this fit with pieces from their wardrobe</span>
              </label>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                {onOpenCreateMyDay ? (
                  <button
                    type="button"
                    onClick={() => {
                      removeSessionKey(draftKey);
                      removeIdbDraft(draftKey);
                      resetComposer();
                      onClose();
                      onOpenCreateMyDay();
                    }}
                    className="text-xs font-semibold underline text-[#4e4c46] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                  >
                    Post a 24h MyDay instead
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={attemptClose}
                    disabled={submitting}
                    className="px-4 py-2.5 min-h-[44px] rounded-control text-xs font-semibold border border-[#d4cfc5] dark:border-[#404040] cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{submitting ? 'Sharing...' : 'Publish Post'}</span>
                  </button>
                </div>
              </div>
            </form>
          </ErrorBoundary>
        </div>
      </div>

      <PhotoEditorModal
        open={Boolean(editorState)}
        sourceUrl={editorState?.sourceUrl || ''}
        initialCrop={editorState?.initialCrop}
        defaultAspect="4:5"
        allowAspectSwitch={true}
        title="Crop Post Photo"
        subtitle="Adjust framing, then tap Done to keep this photo in your post."
        doneLabel="Done"
        onCancel={() => setEditorState(null)}
        onChangePhotoFile={async (file) => {
          const compressed = await preparePreviewDataUrl(file);
          setEditorState((prev) =>
            prev
              ? {
                  ...prev,
                  sourceUrl: compressed,
                  initialCrop: createDefaultCropState(prev.initialCrop?.aspectKey || '4:5'),
                }
              : null
          );
        }}
        onDone={({ croppedDataUrl, cropState, aspectRatio, width, height }) => {
          if (!editorState) return;
          if (editorState.mode === 'new') {
            setPhotos((prev) =>
              [
                ...prev,
                {
                  rawDataUrl: editorState.sourceUrl,
                  croppedDataUrl,
                  cropState,
                  aspectRatio,
                  width,
                  height,
                  cutoutDataUrl: null,
                  useCutout: false,
                  altText: '',
                },
              ].slice(0, 10)
            );
          } else if (typeof editorState.index === 'number') {
            const targetIdx = editorState.index;
            setPhotos((prev) =>
              prev.map((p, i) =>
                i === targetIdx
                  ? {
                      ...p,
                      rawDataUrl: editorState.sourceUrl,
                      croppedDataUrl,
                      cropState,
                      aspectRatio,
                      width,
                      height,
                      cutoutDataUrl: null,
                      useCutout: false,
                    }
                  : p
              )
            );
          }
          setEditorState(null);
        }}
      />

      <DiscardDraftDialog
        open={discardOpen}
        title="Discard this post?"
        description="You have unsaved photos or caption edits in this post. Discarding will clear your draft."
        onKeep={() => setDiscardOpen(false)}
        onDiscard={forceClose}
      />
    </>
  );
};
