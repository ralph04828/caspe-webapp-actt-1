import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Globe,
  Lock,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { StoryView } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { resolveDisplayAspectRatio } from '../utils/aspectRatio';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { MyDayUserGroup } from './MyDayBar';

interface MyDayViewerModalProps {
  groups: MyDayUserGroup[];
  initialUserId: string;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
  onOpenMessages: () => void;
}

const STORY_DURATION_MS = 5000;

export const MyDayViewerModal: React.FC<MyDayViewerModalProps> = ({
  groups,
  initialUserId,
  onClose,
  onOpenProfile,
  onOpenMessages,
}) => {
  const { userProfile } = useAuth();
  const {
    markStoryViewed,
    fetchStoryViewers,
    deleteStory,
    replyToStory,
    reportItem,
  } = useSocial();

  const initialGroupIdx = Math.max(
    0,
    groups.findIndex((g) => g.userId === initialUserId)
  );
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryView[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [storyDims, setStoryDims] = useState<{ width: number; height: number } | null>(null);

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];
  const isOwner = Boolean(userProfile && currentStory?.userId === userProfile.uid);

  const goNext = () => {
    setShowViewers(false);
    setConfirmDelete(false);
    setStatusNote(null);
    if (!currentGroup) {
      onClose();
      return;
    }
    if (storyIdx + 1 < currentGroup.stories.length) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx + 1 < groups.length) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    setShowViewers(false);
    setConfirmDelete(false);
    setStatusNote(null);
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(Math.max(0, prevGroup.stories.length - 1));
      setProgress(0);
    } else {
      setProgress(0);
    }
  };

  // Mark story viewed & reset natural fallback dims when switching story
  useEffect(() => {
    setStoryDims(null);
    if (currentStory) {
      markStoryViewed(currentStory);
    }
  }, [currentStory?.id]);

  // Auto-advance timer (pauses while holding, viewing viewers, confirming delete, or typing)
  const paused = isHolding || showViewers || confirmDelete || replyText.trim().length > 0 || replySending;
  useEffect(() => {
    if (!currentStory || paused) return;
    const stepMs = 50;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (stepMs / STORY_DURATION_MS) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [currentStory?.id, paused, groupIdx, storyIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [groupIdx, storyIdx, groups.length]);

  if (!currentGroup || !currentStory) return null;

  const storyAspect = resolveDisplayAspectRatio({
    aspectRatio: currentStory.aspectRatio,
    width: currentStory.width,
    height: currentStory.height,
    naturalWidth: storyDims?.width,
    naturalHeight: storyDims?.height,
    fallbackRatio: 4 / 5,
    maxHeightCss: '80vh',
  });

  const handleOpenViewers = async () => {
    if (!isOwner) return;
    setShowViewers((v) => !v);
    if (!showViewers) {
      setLoadingViewers(true);
      try {
        const list = await fetchStoryViewers(currentStory.id);
        setViewers(list);
      } finally {
        setLoadingViewers(false);
      }
    }
  };

  const handleDelete = async () => {
    await deleteStory(currentStory);
    setConfirmDelete(false);
    if (currentGroup.stories.length <= 1) {
      onClose();
    } else {
      goNext();
    }
  };

  const handleSendReply = async (textOverride?: string) => {
    const msg = (textOverride ?? replyText).trim();
    if (!msg) return;
    setReplySending(true);
    setStatusNote(null);
    try {
      await replyToStory(currentStory, msg);
      if (!textOverride) setReplyText('');
      setStatusNote('Reply sent to DM');
    } catch (err: any) {
      setStatusNote(err?.message || 'Could not send reply.');
    } finally {
      setReplySending(false);
    }
  };

  const handleReport = async () => {
    await reportItem({
      targetType: 'story',
      targetId: currentStory.id,
      targetOwnerId: currentStory.userId,
      reason: 'Inappropriate MyDay content',
    });
    setStatusNote('MyDay reported to safety review.');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${currentGroup.authorName}'s MyDay`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close MyDay viewer"
        className="absolute top-3 right-3 z-30 w-11 h-11 rounded-full bg-[#171717]/80 border border-[#404040] text-[#e5e1da] flex items-center justify-center hover:bg-[#303030] cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev / Next Group Arrows on desktop */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous MyDay"
        className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#171717]/80 border border-[#404040] text-[#e5e1da] items-center justify-center hover:bg-[#303030] cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={goNext}
        aria-label="Next MyDay"
        className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#171717]/80 border border-[#404040] text-[#e5e1da] items-center justify-center hover:bg-[#303030] cursor-pointer"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Main Story Frame */}
      <div
        className="relative w-full h-full sm:max-w-[430px] sm:h-[88vh] sm:max-h-[780px] bg-[#171717] sm:rounded-modal overflow-hidden border-0 sm:border sm:border-[#404040] flex flex-col justify-between select-none"
        onPointerDown={() => setIsHolding(true)}
        onPointerUp={() => setIsHolding(false)}
        onPointerLeave={() => setIsHolding(false)}
      >
        {/* Top Segmented Progress Bars + Header */}
        <div className="relative z-20 p-3 pt-4 bg-gradient-to-b from-black/80 via-black/45 to-transparent space-y-2.5">
          <div className="flex items-center gap-1">
            {currentGroup.stories.map((st, idx) => {
              const fill =
                idx < storyIdx ? 100 : idx === storyIdx ? progress : 0;
              return (
                <div
                  key={st.id}
                  className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    className="h-full bg-[#e5e1da] transition-[width] duration-75 ease-linear"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfile(currentStory.userId);
              }}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            >
              <AvatarImage
                src={currentStory.authorPhotoUrl}
                name={currentStory.authorName}
                sizeClass="w-9 h-9"
                textSizeClass="text-xs"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#e5e1da] truncate">
                    {currentStory.authorName}
                  </span>
                  <span className="text-[11px] text-[#b0b0b0]">
                    {formatRelativeTime(currentStory.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#b0b0b0]">
                  <span>@{currentStory.authorUsername}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    {currentStory.visibility === 'public' ? (
                      <Globe className="w-3 h-3" />
                    ) : currentStory.visibility === 'friends' ? (
                      <Users className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    {currentStory.visibility === 'close_friends'
                      ? 'Close Friends'
                      : currentStory.visibility === 'friends'
                      ? 'Friends'
                      : 'Public'}
                  </span>
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0 pr-10 sm:pr-0">
              {currentStory.styleTag && (
                <span className="px-2 py-0.5 rounded-chip bg-white/15 text-[#e5e1da] text-[10px] font-semibold">
                  {currentStory.styleTag}
                </span>
              )}
              {!isOwner && (
                <button
                  type="button"
                  onClick={handleReport}
                  aria-label="Report MyDay"
                  title="Report MyDay"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#e5e1da]/80 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete MyDay"
                  title="Delete MyDay"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#e5e1da]/85 hover:bg-white/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Media + Tap Navigation Overlay */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#171717]">
          <div className="w-full mx-auto overflow-hidden" style={storyAspect.frameStyle}>
            <GarmentImage
              src={currentStory.mediaUrl}
              mediaId={currentStory.mediaId}
              alt={currentStory.altText}
              className="w-full h-full object-cover"
              onImageLoad={(dims) => {
                setStoryDims({ width: dims.naturalWidth, height: dims.naturalHeight });
              }}
            />
          </div>

          {/* Tap Left / Right Zones */}
          <button
            type="button"
            aria-label="Previous MyDay frame"
            onClick={goPrev}
            className="absolute inset-y-16 left-0 w-1/3 cursor-pointer bg-transparent"
          />
          <button
            type="button"
            aria-label="Next MyDay frame"
            onClick={goNext}
            className="absolute inset-y-16 right-0 w-2/3 cursor-pointer bg-transparent"
          />
        </div>

        {/* Bottom Caption + Owner Viewers OR Viewer Reply */}
        <div
          className="relative z-20 p-3.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {currentStory.caption && (
            <p className="text-sm text-[#e5e1da] font-medium leading-snug drop-shadow">
              {currentStory.caption}
            </p>
          )}

          {statusNote && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-control bg-[#303030] border border-[#555555] text-xs text-[#e5e1da]">
              <span>{statusNote}</span>
              {statusNote === 'Reply sent to DM' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMessages();
                  }}
                  className="font-bold underline cursor-pointer"
                >
                  Open Chat
                </button>
              )}
            </div>
          )}

          {confirmDelete && isOwner && (
            <div className="rounded-control bg-[#242424] border border-[#555555] p-3 flex items-center justify-between gap-2">
              <span className="text-xs text-[#e5e1da]">Delete this MyDay now?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-control border border-[#555555] text-xs text-[#e5e1da] cursor-pointer"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-control bg-[#e5e1da] text-[#171717] text-xs font-bold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {isOwner ? (
            <div>
              <button
                type="button"
                onClick={handleOpenViewers}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-control bg-white/15 hover:bg-white/20 text-[#e5e1da] text-xs font-semibold cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>
                  {currentStory.viewCount} {currentStory.viewCount === 1 ? 'viewer' : 'viewers'}
                </span>
              </button>

              {showViewers && (
                <div className="mt-2 rounded-control bg-[#242424] border border-[#404040] p-3 max-h-44 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#e5e1da]">Seen by</span>
                    <button
                      type="button"
                      onClick={() => setShowViewers(false)}
                      className="text-xs text-[#b0b0b0] hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {loadingViewers ? (
                    <p className="text-xs text-[#b0b0b0]">Loading viewers...</p>
                  ) : viewers.length === 0 ? (
                    <p className="text-xs text-[#b0b0b0]">No views recorded yet.</p>
                  ) : (
                    viewers.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2 text-xs text-[#e5e1da]">
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarImage src={v.viewerPhotoUrl} name={v.viewerName} sizeClass="w-7 h-7" textSizeClass="text-[10px]" />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{v.viewerName}</p>
                            <p className="text-[10px] text-[#b0b0b0]">@{v.viewerUsername}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#b0b0b0] shrink-0">
                          {formatRelativeTime(v.viewedAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {['🔥', '🖤', '👟', '✨'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={replySending}
                    onClick={() => handleSendReply(emoji)}
                    className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-base flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  maxLength={1000}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to @${currentStory.authorUsername}...`}
                  className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-full bg-white/15 border border-white/25 text-xs text-[#e5e1da] placeholder:text-[#b0b0b0] focus:outline-none focus:border-[#e5e1da]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || replySending}
                  aria-label="Send MyDay reply"
                  className="w-11 h-11 rounded-full bg-[#e5e1da] text-[#171717] flex items-center justify-center disabled:opacity-45 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
