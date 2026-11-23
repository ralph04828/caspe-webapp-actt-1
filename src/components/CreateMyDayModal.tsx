import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Crop,
  Globe,
  Loader2,
  Lock,
  Music,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { MyDayVisibility, STYLE_CATEGORIES } from '../types';
import { preparePreviewDataUrl, uploadImageAsset } from '../services/storageService';
import { resolveDisplayAspectRatio } from '../utils/aspectRatio';
import {
  getDraftSessionKey,
  loadSessionJson,
  removeSessionKey,
  saveSessionJson,
} from '../utils/draftStorage';
import { loadIdbDraft, removeIdbDraft, saveIdbDraft } from '../utils/indexedDbDrafts';
import { AvatarImage } from './AvatarImage';
import { PhotoCropEditor, PhotoCropState, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { ErrorBoundary } from './ErrorBoundary';

interface CreateMyDayModalProps {
  onClose: () => void;
  onCreated?: () => void;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

type MyDayStep = 'photo' | 'editor' | 'details';

interface MyDayDraft {
  step: MyDayStep;
  rawPhotoUrl: string;
  cropState: PhotoCropState | null;
  croppedPhotoUrl: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  caption: string;
  styleTag: string;
  altText: string;
  visibility: MyDayVisibility;
  closeFriendIds: string[];
}

function makeEmptyMyDayDraft(): MyDayDraft {
  return {
    step: 'photo',
    rawPhotoUrl: '',
    cropState: null,
    croppedPhotoUrl: '',
    aspectRatio: '3:4',
    caption: '',
    styleTag: 'Streetwear',
    altText: '',
    visibility: 'public',
    closeFriendIds: [],
  };
}

export const CreateMyDayModal: React.FC<CreateMyDayModalProps> = ({
  onClose,
  onCreated,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const { createStory, friendIds, discoverProfiles } = useSocial();

  const draftKey = getDraftSessionKey('myday', userProfile?.uid || 'anon');

  const [draft, setDraft] = useState<MyDayDraft>(() => {
    const saved = loadSessionJson<MyDayDraft>(draftKey);
    return saved ? { ...makeEmptyMyDayDraft(), ...saved } : makeEmptyMyDayDraft();
  });

  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const friendProfiles = discoverProfiles.filter((p) => friendIds.includes(p.uid));

  const updateDraft = (updater: Partial<MyDayDraft> | ((prev: MyDayDraft) => MyDayDraft)) => {
    setDraft((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  };

  useEffect(() => {
    let cancelled = false;
    loadIdbDraft<MyDayDraft>(draftKey).then((idb) => {
      if (cancelled || !idb) return;
      setDraft((prev) => {
        if (prev.rawPhotoUrl || prev.croppedPhotoUrl || prev.caption.trim()) return prev;
        return { ...makeEmptyMyDayDraft(), ...idb };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    const hasContent = Boolean(draft.rawPhotoUrl || draft.croppedPhotoUrl || draft.caption.trim() || draft.altText.trim());
    if (!hasContent) {
      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      return;
    }
    saveIdbDraft(draftKey, draft);
    saveSessionJson(draftKey, {
      ...draft,
      rawPhotoUrl: '',
      croppedPhotoUrl: '',
    });
  }, [draftKey, draft]);

  const hasUnsavedDraft = useMemo(
    () =>
      Boolean(
        draft.rawPhotoUrl ||
          draft.croppedPhotoUrl ||
          draft.caption.trim() ||
          draft.altText.trim()
      ),
    [draft.rawPhotoUrl, draft.croppedPhotoUrl, draft.caption, draft.altText]
  );

  const attemptClose = () => {
    if (submitting || compressing) return;
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
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !discardOpen) {
        attemptClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [discardOpen, hasUnsavedDraft, submitting, compressing]);

  const processSelectedFile = async (file: File) => {
    setError(null);
    setCompressing(true);
    try {
      const dataUrl = await preparePreviewDataUrl(file);
      updateDraft((prev) => ({
        ...prev,
        step: 'editor',
        rawPhotoUrl: dataUrl,
        cropState: createDefaultCropState('3:4'),
        croppedPhotoUrl: '',
      }));
    } catch (err: any) {
      const msg = err?.message || 'Could not process image.';
      console.error('MyDay photo load error:', err);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setCompressing(false);
    }
  };

  const toggleCloseFriend = (uid: string) => {
    updateDraft((prev) => ({
      ...prev,
      closeFriendIds: prev.closeFriendIds.includes(uid)
        ? prev.closeFriendIds.filter((id) => id !== uid)
        : [...prev.closeFriendIds, uid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const activeImage = draft.croppedPhotoUrl || draft.rawPhotoUrl;
    if (!activeImage) {
      const msg = 'Please capture or choose a photo for your MyDay.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }
    if (
      draft.visibility === 'close_friends' &&
      draft.closeFriendIds.length === 0 &&
      friendProfiles.length > 0
    ) {
      const msg = 'Select at least one close friend or switch visibility.';
      setError(msg);
      onToast?.(msg, 'error');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const uploaded = await uploadImageAsset(
        activeImage,
        userProfile.uid,
        draft.visibility === 'public' ? 'public' : 'friends',
        isDemoMode
      );
      await createStory({
        mediaUrl: uploaded.imageUrl,
        thumbUrl: uploaded.thumbUrl,
        mediaId: uploaded.mediaId,
        aspectRatio: draft.aspectRatio || draft.cropState?.aspectKey || '3:4',
        width: draft.width || uploaded.width,
        height: draft.height || uploaded.height,
        altText: draft.altText.trim() || `${userProfile.displayName}'s ${draft.styleTag} MyDay`,
        caption: draft.caption.trim() || undefined,
        styleTag: draft.styleTag,
        visibility: draft.visibility,
        closeFriendIds: draft.visibility === 'close_friends' ? draft.closeFriendIds : undefined,
      });

      removeSessionKey(draftKey);
      removeIdbDraft(draftKey);
      onCreated?.();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Could not publish MyDay. Your draft is preserved.';
      console.error('Failed to share MyDay story:', err);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel =
    draft.step === 'photo'
      ? 'Step 1 of 3 · Choose Photo'
      : draft.step === 'editor'
      ? 'Step 2 of 3 · Edit Photo'
      : 'Step 3 of 3 · Story Details';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-myday-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-modal p-5 sm:p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#d4cfc5] dark:border-[#404040]">
          <div>
            <h2 id="create-myday-title" className="text-lg font-display font-bold text-[#171717] dark:text-[#e5e1da]">
              Add to MyDay
            </h2>
            <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#b0b0b0]">
              {stepLabel} · Visible for 24h
            </p>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close MyDay composer"
            className="w-11 h-11 rounded-control flex items-center justify-center border border-[#d4cfc5] dark:border-[#404040] text-[#171717] dark:text-[#e5e1da] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ErrorBoundary title="MyDay editor ran into an issue" onReset={() => setError(null)}>
          <div className="mt-4 max-h-[78vh] overflow-y-auto space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-control border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Pick or Take Photo */}
            {draft.step === 'photo' && (
              <div className="space-y-4">
                <div className="rounded-card border border-dashed border-[#a5a5a5] bg-[#f5f4f0] dark:bg-[#1e1e1e] p-6 text-center space-y-3">
                  {compressing ? (
                    <div className="py-6 flex flex-col items-center gap-2 text-xs font-semibold">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Preparing WebP photo...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-[#171717] dark:text-[#e5e1da]">
                        Choose a photo for your 24h MyDay
                      </p>
                      <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">
                        You&rsquo;ll crop &amp; adjust the frame next before sharing.
                      </p>
                      <div className="flex justify-center pt-1">
                        <PhotoPickerButton
                          label="Choose Photo"
                          busyLabel="Preparing WebP photo..."
                          busy={compressing}
                          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer hover:opacity-90"
                          onFileSelected={processSelectedFile}
                          onError={(msg) => {
                            setError(msg);
                            onToast?.(msg, 'error');
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={attemptClose}
                    className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Interactive Photo Editor (Zoom, Drag, Done -> Story Details) */}
            {draft.step === 'editor' && draft.rawPhotoUrl && (
              <PhotoCropEditor
                sourceUrl={draft.rawPhotoUrl}
                initialCrop={draft.cropState}
                defaultAspect="3:4"
                allowAspectSwitch={true}
                title="Crop & Frame MyDay"
                subtitle="Drag to reposition and adjust zoom, then tap Done to add caption & visibility."
                backLabel="Back"
                doneLabel="Done"
                onBack={() =>
                  updateDraft({
                    step: draft.croppedPhotoUrl ? 'details' : 'photo',
                  })
                }
                onChangePhotoFile={processSelectedFile}
                onDone={({ croppedDataUrl, cropState, aspectRatio, width, height }) => {
                  updateDraft({
                    step: 'details',
                    croppedPhotoUrl: croppedDataUrl,
                    cropState,
                    aspectRatio,
                    width,
                    height,
                  });
                }}
              />
            )}

            {/* STEP 3: Story Details Screen + Share to MyDay */}
            {draft.step === 'details' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Cropped Photo Preview */}
                {draft.croppedPhotoUrl ? (
                  <div
                    className="relative w-full rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#171717] mx-auto"
                    style={
                      resolveDisplayAspectRatio({
                        aspectRatio: draft.aspectRatio || draft.cropState?.aspectKey,
                        width: draft.width,
                        height: draft.height,
                        fallbackRatio: 3 / 4,
                        maxHeightCss: '18rem',
                      }).frameStyle
                    }
                  >
                    <img
                      src={draft.croppedPhotoUrl}
                      alt={draft.altText || 'MyDay preview'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateDraft({ step: 'editor' })}
                      className="absolute top-2.5 right-2.5 px-3 py-1.5 min-h-[34px] rounded-chip bg-[#171717]/85 text-[#e5e1da] text-xs font-semibold border border-[#404040] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Edit Crop</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateDraft({ step: 'photo' })}
                    className="w-full p-4 rounded-card border border-dashed border-[#a5a5a5] text-xs font-semibold cursor-pointer"
                  >
                    Select a photo first
                  </button>
                )}

                {/* Caption */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="myday-caption" className="text-xs font-semibold text-[#171717] dark:text-[#e5e1da]">
                      Caption (optional)
                    </label>
                    <span className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">
                      {draft.caption.length}/220
                    </span>
                  </div>
                  <input
                    id="myday-caption"
                    type="text"
                    maxLength={220}
                    value={draft.caption}
                    onChange={(e) => updateDraft({ caption: e.target.value })}
                    placeholder="Today's layers, thrift find, sneaker check..."
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-sm text-[#171717] dark:text-[#e5e1da]"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <span className="block text-xs font-semibold text-[#171717] dark:text-[#e5e1da] mb-1.5">
                    Who can see this MyDay
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'public' as MyDayVisibility, label: 'Public', Icon: Globe },
                      { id: 'friends' as MyDayVisibility, label: 'Friends', Icon: Users },
                      { id: 'close_friends' as MyDayVisibility, label: 'Close Friends', Icon: Lock },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => updateDraft({ visibility: id })}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2 min-h-[44px] rounded-control text-xs font-semibold border cursor-pointer transition-colors ${
                          draft.visibility === id
                            ? 'bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                            : 'border-[#d4cfc5] dark:border-[#404040] text-[#171717] dark:text-[#e5e1da] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {draft.visibility === 'close_friends' && (
                  <div className="rounded-control border border-[#d4cfc5] dark:border-[#404040] p-3 max-h-36 overflow-y-auto space-y-2 bg-[#f5f4f0] dark:bg-[#1e1e1e]">
                    <p className="text-[11px] font-semibold text-[#4e4c46] dark:text-[#b0b0b0]">
                      Select close friends ({draft.closeFriendIds.length} chosen)
                    </p>
                    {friendProfiles.length === 0 ? (
                      <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                        Add friends in the People tab first to share with Close Friends.
                      </p>
                    ) : (
                      friendProfiles.map((f) => {
                        const checked = draft.closeFriendIds.includes(f.uid);
                        return (
                          <label
                            key={f.uid}
                            className="flex items-center gap-2.5 text-xs text-[#171717] dark:text-[#e5e1da] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCloseFriend(f.uid)}
                            />
                            <AvatarImage src={f.photoURL} name={f.displayName} sizeClass="w-6 h-6" textSizeClass="text-[10px]" />
                            <span className="font-medium truncate">{f.displayName}</span>
                            <span className="text-[#4e4c46] dark:text-[#b0b0b0] text-[11px]">@{f.username}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Style Vibe */}
                <div>
                  <span className="block text-xs font-semibold text-[#171717] dark:text-[#e5e1da] mb-1.5">
                    Style vibe
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLE_CATEGORIES.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => updateDraft({ styleTag: tag })}
                        className={`px-2.5 py-1.5 rounded-chip text-xs font-medium border transition-colors cursor-pointer ${
                          draft.styleTag === tag
                            ? 'bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                            : 'border-[#d4cfc5] dark:border-[#404040] text-[#4e4c46] dark:text-[#b0b0b0] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alt Text */}
                <div>
                  <label htmlFor="myday-alt" className="block text-xs font-semibold text-[#171717] dark:text-[#e5e1da] mb-1">
                    Alt text (accessibility)
                  </label>
                  <input
                    id="myday-alt"
                    type="text"
                    maxLength={140}
                    value={draft.altText}
                    onChange={(e) => updateDraft({ altText: e.target.value })}
                    placeholder="e.g. Wearing black boxy jacket and wide denim"
                    className="w-full px-3 py-2 min-h-[42px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs text-[#171717] dark:text-[#e5e1da]"
                  />
                </div>

                {/* Sound placeholder (scheduled for future step) */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/60 dark:bg-[#171717]/60 text-xs text-[#4e4c46] dark:text-[#b0b0b0]">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Music className="w-3.5 h-3.5" />
                    <span>Soundtrack</span>
                  </span>
                  <span className="text-[11px]">Audio clips coming soon</span>
                </div>

                {/* Footer Navigation & Submit */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => updateDraft({ step: draft.rawPhotoUrl ? 'editor' : 'photo' })}
                    className="px-3.5 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Editor</span>
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={attemptClose}
                      disabled={submitting}
                      className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold text-[#171717] dark:text-[#e5e1da] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!draft.croppedPhotoUrl || submitting}
                      className="px-5 py-2.5 min-h-[44px] rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{submitting ? 'Sharing MyDay...' : 'Share to MyDay'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </ErrorBoundary>
      </div>

      <DiscardDraftDialog
        open={discardOpen}
        title="Discard this post?"
        description="You have an unfinished MyDay draft. Closing now will discard your photo, crop, and caption."
        onKeep={() => setDiscardOpen(false)}
        onDiscard={forceClose}
      />
    </div>
  );
};
