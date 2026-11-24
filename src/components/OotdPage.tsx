import React, { useEffect, useMemo, useState } from 'react';
import {
  CommentPolicy,
  NavSection,
  SEASON_TAGS,
  SeasonTag,
  SocialPost,
  Visibility,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { preparePreviewAsset, preparePreviewDataUrl, uploadImageAsset } from '../services/storageService';
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
import { dedupeStyleTags } from '../utils/styleTags';
import { GarmentImage } from './GarmentImage';
import { PostCard } from './PostCard';
import { PhotoCropState, PhotoEditorModal, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { StyleTagSelector } from './StyleTagSelector';
import { ErrorBoundary } from './ErrorBoundary';
import {
  AlertCircle,
  Crop,
  Globe,
  Loader2,
  Lock,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

interface OotdStagedPhoto {
  rawDataUrl: string;
  croppedDataUrl?: string;
  cropState?: PhotoCropState | null;
  aspectRatio?: string;
  width?: number;
  height?: number;
  alt: string;
}

interface OotdDraft {
  photos: OotdStagedPhoto[];
  caption: string;
  selectedOutfitId: string;
  styleTags: string[];
  seasons: SeasonTag[];
  visibility: Visibility;
  commentPolicy: CommentPolicy;
}

interface OotdPageProps {
  onOpenProfile: (userId: string) => void;
  onRemixPost: (post: SocialPost) => void;
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OotdPage: React.FC<OotdPageProps> = ({
  onOpenProfile,
  onRemixPost,
  onNavigate,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const { outfits, wardrobe } = useWardrobe();
  const { visiblePostsForFeed, visibleFriendsPosts, publishPost } = useSocial();

  const draftKey = getDraftSessionKey('ootd', userProfile?.uid || 'anon');
  const savedDraft = useMemo(() => loadSessionJson<OotdDraft>(draftKey), [draftKey]);

  const [photos, setPhotos] = useState<OotdStagedPhoto[]>(() => savedDraft?.photos || []);
  const [caption, setCaption] = useState(() => savedDraft?.caption || '');
  const [selectedOutfitId, setSelectedOutfitId] = useState(() => savedDraft?.selectedOutfitId || '');
  const [styleTags, setStyleTags] = useState<string[]>(() =>
    savedDraft?.styleTags?.length ? savedDraft.styleTags : ['Streetwear']
  );
  const [seasons, setSeasons] = useState<SeasonTag[]>(() =>
    savedDraft?.seasons?.length ? savedDraft.seasons : ['All-Season']
  );
  const [visibility, setVisibility] = useState<Visibility>(() => savedDraft?.visibility || 'public');
  const [commentPolicy, setCommentPolicy] = useState<CommentPolicy>(
    () => savedDraft?.commentPolicy || 'everyone'
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{
    mode: 'new' | 'edit';
    index?: number;
    sourceUrl: string;
    initialCrop: PhotoCropState | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadIdbDraft<OotdDraft>(draftKey).then((idb) => {
      if (cancelled || !idb) return;
      if (Array.isArray(idb.photos) && idb.photos.length > 0 && photos.length === 0) {
        setPhotos(idb.photos.slice(0, 10));
        if (!caption && idb.caption) setCaption(idb.caption);
        if (!selectedOutfitId && idb.selectedOutfitId) setSelectedOutfitId(idb.selectedOutfitId);
        if (idb.styleTags?.length) setStyleTags(idb.styleTags);
        if (idb.seasons?.length) setSeasons(idb.seasons);
        if (idb.visibility) setVisibility(idb.visibility);
        if (idb.commentPolicy) setCommentPolicy(idb.commentPolicy);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    const hasDraft = Boolean(photos.length > 0 || caption.trim() || selectedOutfitId);
    if (!hasDraft) {
      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      return;
    }
    const fullDraft: OotdDraft = {
      photos,
      caption,
      selectedOutfitId,
      styleTags,
      seasons,
      visibility,
      commentPolicy,
    };
    saveIdbDraft(draftKey, fullDraft);
    saveSessionJson<OotdDraft>(draftKey, {
      ...fullDraft,
      photos: photos.length <= 2 ? photos : [],
    });
  }, [draftKey, photos, caption, selectedOutfitId, styleTags, seasons, visibility, commentPolicy]);

  const recentOotds = useMemo(() => {
    const map = new Map<string, SocialPost>();
    [...visibleFriendsPosts, ...visiblePostsForFeed].forEach((p) => {
      if (p.postType === 'ootd') map.set(p.id, p);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [visibleFriendsPosts, visiblePostsForFeed]);

  const handlePhotoFilesSelected = async (selectedFiles: File[]) => {
    const files = selectedFiles.slice(0, Math.max(0, 10 - photos.length));
    if (files.length === 0) return;
    setFormError(null);

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

    const added: OotdStagedPhoto[] = [];
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
        alt: '',
      });
    }
    setPhotos((prev) => [...prev, ...added].slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || submitting) return;
    setFormError(null);

    if (photos.length === 0) {
      const msg = 'Add at least one OOTD photo.';
      setFormError(msg);
      onToast(msg, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const mediaUrls: string[] = [];
      const thumbUrls: string[] = [];
      const mediaIds: string[] = [];
      const altTexts: string[] = [];
      const mediaDimensions: { width: number; height: number }[] = [];
      let primaryAspectRatio: string | undefined;

      for (const p of photos) {
        const sourceToUpload = p.croppedDataUrl || p.rawDataUrl;
        const uploaded = await uploadImageAsset(sourceToUpload, userProfile.uid, visibility, isDemoMode);
        mediaUrls.push(uploaded.imageUrl);
        thumbUrls.push(uploaded.thumbUrl);
        mediaIds.push(uploaded.mediaId);
        altTexts.push(p.alt.trim() || caption.trim().slice(0, 100) || 'Outfit of the Day photo');
        mediaDimensions.push({ width: uploaded.width, height: uploaded.height });
        if (!primaryAspectRatio) {
          primaryAspectRatio =
            p.aspectRatio ||
            p.cropState?.aspectKey ||
            formatAspectRatioFromDimensions(uploaded.width, uploaded.height, {
              clampToFeed: true,
            });
        }
      }

      const linkedOutfit = outfits.find((o) => o.id === selectedOutfitId);

      await publishPost({
        postType: 'ootd',
        caption,
        visibility,
        allowRemix: Boolean(linkedOutfit),
        commentPolicy,
        outfit: linkedOutfit,
        wardrobe,
        mediaUrl: mediaUrls[0],
        thumbUrl: thumbUrls[0],
        mediaId: mediaIds[0],
        mediaUrls,
        thumbUrls,
        mediaIds,
        altText: altTexts[0],
        altTexts,
        aspectRatio: primaryAspectRatio,
        width: mediaDimensions[0]?.width,
        height: mediaDimensions[0]?.height,
        mediaDimensions,
        seasons,
        styleTags: dedupeStyleTags(
          styleTags.length ? styleTags : ['Streetwear'],
          userProfile.customStyles,
          5
        ),
      });

      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      setPhotos([]);
      setCaption('');
      setSelectedOutfitId('');
      onToast('OOTD posted!');
      onNavigate('home');
    } catch (err: any) {
      const msg = err?.message || 'Failed to publish OOTD. Your draft is still here.';
      console.error('Failed to publish OOTD:', err);
      setFormError(msg);
      onToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Outfit of the Day (OOTD)</h1>
        <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
          Choose up to 10 photos of what you&rsquo;re wearing today and optionally link a Lookbook fit.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
        {/* OOTD Composer */}
        <section className="xl:col-span-5">
          <ErrorBoundary title="OOTD composer ran into an issue" onReset={() => setFormError(null)}>
            <form
              onSubmit={handleSubmit}
              className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base">Post Today&rsquo;s Fit</h2>
                <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                  {photos.length}/10 photos
                </span>
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

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {photos.map((p, idx) => {
                    const previewAspect = resolveDisplayAspectRatio({
                      aspectRatio: p.aspectRatio || p.cropState?.aspectKey,
                      width: p.width,
                      height: p.height,
                      fallbackRatio: 4 / 5,
                      maxHeightCss: '15rem',
                    });
                    return (
                    <div
                      key={idx}
                      className="rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] overflow-hidden"
                    >
                      <div className="bg-[#eae7e0] dark:bg-[#242424] flex items-center justify-center">
                        <div className="relative w-full mx-auto overflow-hidden" style={previewAspect.frameStyle}>
                        <GarmentImage
                          src={p.croppedDataUrl || p.rawDataUrl}
                          alt={p.alt || `OOTD photo ${idx + 1}`}
                        />
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
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/75 text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={p.alt}
                        onChange={(e) =>
                          setPhotos((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, alt: e.target.value } : item))
                          )
                        }
                        placeholder="Describe this photo (alt text)"
                        className="w-full px-2.5 py-1.5 text-[11px] bg-white dark:bg-[#242424] border-t border-[#d4cfc5] dark:border-[#404040]"
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
                  className="w-full min-h-[44px] p-3 rounded-card border border-dashed border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/60 dark:bg-[#171717]/60 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
                  onFilesSelected={handlePhotoFilesSelected}
                  onError={(msg) => {
                    setFormError(msg);
                    onToast(msg, 'error');
                  }}
                />
              )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                Caption (Optional — #hashtags &amp; @mentions)
              </label>
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optional caption or #hashtags..."
                className="w-full px-3.5 py-2.5 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
                Link Saved Outfit (Optional)
              </label>
              <select
                value={selectedOutfitId}
                onChange={(e) => setSelectedOutfitId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                <option value="">No linked Lookbook outfit</option>
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.styleCategory})
                  </option>
                ))}
              </select>
            </div>

            <StyleTagSelector
              label="Style Tags"
              selected={styleTags}
              onChange={setStyleTags}
              onError={(msg) => {
                setFormError(msg);
                onToast(msg, 'error');
              }}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                Season
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
                      className={`px-2.5 py-1 rounded-chip text-[11px] border cursor-pointer ${
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'public', label: 'Public', Icon: Globe },
                      { id: 'friends', label: 'Friends', Icon: Users },
                      { id: 'private', label: 'Private', Icon: Lock },
                    ] as { id: Visibility; label: string; Icon: any }[]
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVisibility(id)}
                      className={`min-h-[40px] px-2 py-1.5 rounded-control text-[11px] font-medium border flex items-center justify-center gap-1 cursor-pointer ${
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
                  Comments
                </label>
                <select
                  value={commentPolicy}
                  onChange={(e) => setCommentPolicy(e.target.value as CommentPolicy)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                >
                  <option value="everyone">Everyone</option>
                  <option value="friends">Friends &amp; followers</option>
                  <option value="off">Comments off</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] py-3 px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{submitting ? 'Publishing OOTD...' : 'Post OOTD'}</span>
            </button>
            </form>
          </ErrorBoundary>
        </section>

        {/* Recent OOTD Showcase */}
        <section className="xl:col-span-7 space-y-4">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">
            Recent OOTD Showcase ({recentOotds.length})
          </h2>
          {recentOotds.length === 0 ? (
            <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              No OOTD posts yet — share the first look of the day!
            </div>
          ) : (
            <div className="space-y-4">
              {recentOotds.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onOpenProfile={onOpenProfile}
                  onRemixPost={onRemixPost}
                  onToast={onToast}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <PhotoEditorModal
        open={Boolean(editorState)}
        sourceUrl={editorState?.sourceUrl || ''}
        initialCrop={editorState?.initialCrop}
        defaultAspect="4:5"
        allowAspectSwitch={true}
        title="Crop OOTD Photo"
        subtitle="Frame your Outfit of the Day, then tap Done to keep it in your post."
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
                  alt: '',
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
                    }
                  : p
              )
            );
          }
          setEditorState(null);
        }}
      />
    </div>
  );
};
