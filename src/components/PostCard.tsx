import React, { useEffect, useRef, useState } from 'react';
import { PostComment, SocialPost, Visibility } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { preparePreviewDataUrl, uploadImageAsset } from '../services/storageService';
import { formatRelativeTime } from '../utils/formatters';
import { resolveDisplayAspectRatio } from '../utils/aspectRatio';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { VisibilityBadge } from './VisibilityBadge';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Repeat,
  MoreHorizontal,
  Trash2,
  Flag,
  VolumeX,
  Ban,
  Send,
  Lock,
  ImagePlus,
  X,
  Loader2,
  Edit3,
  Reply,
  Share2,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';

interface PostCardProps {
  post: SocialPost;
  onOpenProfile: (userId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onRemixPost?: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onOpenProfile,
  onSelectHashtag,
  onRemixPost,
  onToast,
}) => {
  const { userProfile, isDemoMode } = useAuth();
  const {
    likedPostIds,
    savedPostIds,
    conversations,
    toggleLike,
    toggleSave,
    loadComments,
    addComment,
    deleteComment,
    editPost,
    deletePost,
    sharePostToChat,
    toggleBlock,
    toggleMute,
    reportItem,
  } = useSocial();

  const [menuOpen, setMenuOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [editVisibility, setEditVisibility] = useState<Visibility>(post.visibility);
  const [savingEdit, setSavingEdit] = useState(false);

  const [mediaIdx, setMediaIdx] = useState(0);
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setMediaIdx(0);
    setNaturalDims(null);
  }, [post.id]);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [commentImgDataUrl, setCommentImgDataUrl] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const isOwner = userProfile?.uid === post.userId;
  const isLiked = likedPostIds.has(post.id);
  const isSaved = savedPostIds.has(post.id);

  const mediaUrls =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.mediaUrl
      ? [post.mediaUrl]
      : [];
  const mediaIds =
    post.mediaIds && post.mediaIds.length > 0
      ? post.mediaIds
      : post.mediaId
      ? [post.mediaId]
      : [];
  const altTexts =
    post.altTexts && post.altTexts.length > 0
      ? post.altTexts
      : [post.altText || post.caption || 'Fashion fit post'];

  const displayAspect = resolveDisplayAspectRatio({
    aspectRatio: post.aspectRatio,
    width: post.width,
    height: post.height,
    mediaDimensions: post.mediaDimensions,
    naturalWidth: naturalDims?.width,
    naturalHeight: naturalDims?.height,
    fallbackRatio: 1,
    maxHeightCss: '80vh',
  });

  const handleToggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) {
      setLoadingComments(true);
      try {
        const list = await loadComments(post.id);
        setComments(list);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleCommentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await preparePreviewDataUrl(file);
      setCommentImgDataUrl(compressed);
    } catch (err: any) {
      onToast(err?.message || 'Could not process comment image.', 'error');
    }
    e.target.value = '';
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!commentInput.trim() && !commentImgDataUrl) || !userProfile) return;
    setSubmittingComment(true);
    try {
      let attachment:
        | { imageUrl: string; thumbUrl: string; mediaId: string; altText?: string }
        | undefined;
      if (commentImgDataUrl) {
        const uploaded = await uploadImageAsset(
          commentImgDataUrl,
          userProfile.uid,
          post.visibility,
          isDemoMode
        );
        attachment = {
          imageUrl: uploaded.imageUrl,
          thumbUrl: uploaded.thumbUrl,
          mediaId: uploaded.mediaId,
          altText: commentInput.trim() || 'Comment attachment',
        };
      }
      const created = await addComment(
        post,
        commentInput,
        attachment,
        replyingTo || undefined
      );
      setComments((prev) => [...prev, created]);
      setCommentInput('');
      setReplyingTo(null);
      setCommentImgDataUrl(null);
    } catch (err: any) {
      onToast(err?.message || 'Could not add comment.', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (c: PostComment) => {
    await deleteComment(c);
    setComments((prev) => prev.filter((item) => item.id !== c.id));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCaption.trim()) return;
    setSavingEdit(true);
    try {
      await editPost(post, { caption: editCaption, visibility: editVisibility });
      setEditing(false);
      onToast('Post updated.');
    } catch (err: any) {
      onToast(err?.message || 'Could not update post.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderCaption = (text = '') => {
    const tokens = (text || '').split(/(\s+)/);
    return tokens.map((tok, i) => {
      if (tok.startsWith('#') && tok.length > 1) {
        const tag = tok.slice(1).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectHashtag?.(tag)}
            className="font-semibold underline underline-offset-2 hover:opacity-75 cursor-pointer"
          >
            {tok}
          </button>
        );
      }
      if (tok.startsWith('@') && tok.length > 2) {
        return (
          <span key={i} className="font-semibold">
            {tok}
          </span>
        );
      }
      return <React.Fragment key={i}>{tok}</React.Fragment>;
    });
  };

  return (
    <article className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenProfile(post.userId)}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
        >
          <AvatarImage
            src={post.authorPhotoUrl}
            name={post.authorName || post.authorUsername || 'S'}
            sizeClass="w-10 h-10"
            textSizeClass="text-sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold truncate group-hover:underline">
                {post.authorName || 'SWOOOSH Member'}
              </span>
              <span className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                @{post.authorUsername || 'member'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.editedAt && <span>· Edited</span>}
              {post.occasion && <span>· {post.occasion}</span>}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0 relative">
          <span className="px-2 py-0.5 rounded-chip text-[10px] font-mono-num uppercase tracking-wider border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]">
            {(post.postType || 'outfit') === 'ootd' ? 'OOTD' : (post.postType || 'outfit').toUpperCase()}
          </span>
          {post.visibility !== 'public' && <VisibilityBadge visibility={post.visibility} />}

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Post options"
            className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-48 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] shadow-xl py-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/?u=${post.authorUsername}`);
                  setMenuOpen(false);
                  onToast('Link copied.');
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy creator invite link</span>
              </button>

              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCaption(post.caption || '');
                      setEditVisibility(post.visibility);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit caption</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      deletePost(post);
                      onToast('Post deleted.');
                    }}
                    className="w-full px-3.5 py-2 text-left text-red-600 dark:text-red-400 hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete post</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await toggleMute({
                        uid: post.userId,
                        username: post.authorUsername,
                        displayName: post.authorName,
                      });
                      onToast(`Muted @${post.authorUsername}.`);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Mute @{post.authorUsername}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await toggleBlock({
                        uid: post.userId,
                        username: post.authorUsername,
                        displayName: post.authorName,
                      });
                      onToast(`Blocked @${post.authorUsername}.`);
                    }}
                    className="w-full px-3.5 py-2 text-left text-red-600 dark:text-red-400 hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Block user</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await reportItem({
                        targetType: 'post',
                        targetId: post.id,
                        targetOwnerId: post.userId,
                        reason: 'Inappropriate or spam content',
                      });
                      onToast('Report submitted. Thank you for keeping SWOOOSH respectful.');
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report post</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remix Attribution */}
      {post.remixedFrom && (
        <div className="px-4 pb-2 flex items-center gap-1.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
          <Repeat className="w-3.5 h-3.5" />
          <span>
            Remixed from <strong>@{post.remixedFrom.username}</strong>
          </span>
        </div>
      )}

      {/* Main Photo Carousel (1–4 images) */}
      {(mediaUrls.length > 0 || mediaIds.length > 0) && (
        <div className="bg-[#eae7e0] dark:bg-[#171717] border-y border-[#d4cfc5]/60 dark:border-[#404040]/60">
          <div
            className="relative w-full mx-auto overflow-hidden touch-pan-y"
            style={displayAspect.frameStyle}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t && mediaUrls.length > 1) {
                touchStartRef.current = { x: t.clientX, y: t.clientY };
              }
            }}
            onTouchEnd={(e) => {
              const start = touchStartRef.current;
              touchStartRef.current = null;
              const t = e.changedTouches[0];
              if (!start || !t || mediaUrls.length <= 1) return;
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                setMediaIdx((i) =>
                  dx < 0 ? (i + 1) % mediaUrls.length : (i - 1 + mediaUrls.length) % mediaUrls.length
                );
              }
            }}
          >
            <GarmentImage
              src={mediaUrls[mediaIdx]}
              mediaId={mediaIds[mediaIdx]}
              alt={altTexts[mediaIdx] || post.altText || post.caption || 'Fashion fit post'}
              className="w-full h-full object-cover"
              onImageLoad={(dims) => {
                if (mediaIdx === 0 && !naturalDims) {
                  setNaturalDims({ width: dims.naturalWidth, height: dims.naturalHeight });
                }
              }}
            />
            {mediaUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setMediaIdx((i) => (i - 1 + mediaUrls.length) % mediaUrls.length)}
                  aria-label="Previous photo"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMediaIdx((i) => (i + 1) % mediaUrls.length)}
                  aria-label="Next photo"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60">
                  {mediaUrls.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMediaIdx(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={`w-2 h-2 rounded-full cursor-pointer ${
                        i === mediaIdx ? 'bg-white' : 'bg-white/45'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Pieces Strip */}
      {post.piecesPreview && post.piecesPreview.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1">
          {post.piecesPreview.map((piece, idx) => (
            <div
              key={`${piece.id}_${idx}`}
              className="shrink-0 flex items-center gap-2 pr-3 p-1.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]"
            >
              <div className="w-9 h-9 rounded-chip overflow-hidden bg-[#eae7e0] dark:bg-[#303030] shrink-0">
                {piece.isPrivatePlaceholder ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 opacity-70" />
                  </div>
                ) : (
                  <GarmentImage
                    src={piece.thumbUrl || piece.imageUrl}
                    mediaId={piece.mediaId}
                    alt={piece.name}
                  />
                )}
              </div>
              <div className="min-w-0 max-w-[140px]">
                <p className="text-[11px] font-semibold truncate">
                  {piece.isPrivatePlaceholder ? 'Private piece' : piece.name}
                </p>
                <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                  {piece.isPrivatePlaceholder
                    ? piece.category
                    : `${piece.brand || piece.category}${piece.color ? ` · ${piece.color}` : ''}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Caption & Inline Edit */}
      <div className="px-4 py-3 space-y-2">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-2">
            <textarea
              rows={2}
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="w-full px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value as Visibility)}
                className="px-2.5 py-1.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs"
              >
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="followers">Followers</option>
                <option value="private">Private</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-3 py-1.5 rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="text-sm leading-relaxed">{renderCaption(post.caption || '')}</p>
        )}

        {(post.styleTags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(post.styleTags || []).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-chip text-[11px] font-medium bg-[#eae7e0] dark:bg-[#303030] text-[#171717] dark:text-[#e5e1da]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-4 py-2.5 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-2 relative">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => toggleLike(post)}
            aria-label={isLiked ? 'Unlike post' : 'Like post'}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiked
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                : 'hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="font-mono-num">{post.likesCount ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleComments}
            aria-label="Toggle comments"
            className="min-h-[40px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-mono-num">{post.commentsCount ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setSharePickerOpen((v) => !v)}
            aria-label="Share post to chat"
            className="min-h-[40px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>

          {post.allowRemix && post.piecesPreview && post.piecesPreview.length > 0 && onRemixPost && (
            <button
              type="button"
              onClick={() => onRemixPost(post)}
              className="min-h-[40px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline">Remix this fit</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => toggleSave(post)}
          aria-label={isSaved ? 'Remove from saved' : 'Save fit'}
          className={`min-h-[40px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isSaved
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
              : 'hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        {sharePickerOpen && (
          <div className="absolute left-4 bottom-12 z-20 w-64 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#1e1e1e] shadow-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#4e4c46] dark:text-[#b0b0b0]">
                Share to Chat
              </span>
              <button
                type="button"
                onClick={() => setSharePickerOpen(false)}
                className="cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#b0b0b0] py-1">
                Start a DM or group in Messages first.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {conversations.map((conv) => {
                  const otherId = conv.participantIds.find((id) => id !== userProfile?.uid);
                  const label =
                    conv.type === 'group'
                      ? conv.name || 'Group Chat'
                      : (otherId && conv.participantProfiles[otherId]?.displayName) || 'DM Chat';
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={async () => {
                        await sharePostToChat(conv.id, post);
                        setSharePickerOpen(false);
                        onToast(`Sent to ${label}!`);
                      }}
                      className="w-full px-2.5 py-2 rounded-control text-xs font-semibold text-left hover:bg-[#eae7e0] dark:hover:bg-[#303030] truncate cursor-pointer"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments Drawer */}
      {commentsOpen && (
        <div className="px-4 py-3 border-t border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/60 dark:bg-[#171717]/60 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              {post.commentPolicy === 'off' ? 'Comments are disabled on this post.' : 'No comments yet. Start the conversation.'}
            </p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {comments.map((c) => {
                const canDelete = userProfile?.uid === c.userId || isOwner;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 min-w-0">
                      <AvatarImage
                        src={c.authorPhotoUrl}
                        name={c.authorName || c.authorUsername}
                        sizeClass="w-6 h-6"
                        textSizeClass="text-[10px]"
                      />
                      <div className="min-w-0 space-y-1">
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenProfile(c.userId)}
                            className="font-semibold hover:underline cursor-pointer mr-1.5"
                          >
                            @{c.authorUsername}
                          </button>
                          {c.replyToUsername && (
                            <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-chip bg-[#eae7e0] dark:bg-[#303030]">
                              @{c.replyToUsername}
                            </span>
                          )}
                          <span>{c.text}</span>
                          <span className="ml-2 text-[10px] text-[#4e4c46] dark:text-[#c2bfb8]">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        {(c.thumbUrl || c.imageUrl || c.mediaId) && (
                          <div className="w-24 h-24 rounded-control overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#242424]">
                            <GarmentImage
                              src={c.thumbUrl || c.imageUrl}
                              mediaId={c.mediaId}
                              alt={c.altText || 'Comment attachment'}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {post.commentPolicy !== 'off' && (
                        <button
                          type="button"
                          onClick={() => setReplyingTo({ id: c.id, username: c.authorUsername })}
                          aria-label={`Reply to @${c.authorUsername}`}
                          className="text-[#4e4c46] dark:text-[#c2bfb8] hover:text-[#171717] dark:hover:text-[#e5e1da] p-1 cursor-pointer"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c)}
                          aria-label="Delete comment"
                          className="text-[#4e4c46] dark:text-[#c2bfb8] hover:text-red-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {post.commentPolicy !== 'off' && (
            <form onSubmit={handleAddComment} className="space-y-2">
              {replyingTo && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-control bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] text-[11px]">
                  <span>
                    Replying to <strong>@{replyingTo.username}</strong>
                  </span>
                  <button type="button" onClick={() => setReplyingTo(null)} className="cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {commentImgDataUrl && (
                <div className="relative inline-block w-20 h-20 rounded-control overflow-hidden border border-[#d4cfc5] dark:border-[#404040]">
                  <GarmentImage src={commentImgDataUrl} alt="Comment attachment preview" />
                  <button
                    type="button"
                    onClick={() => setCommentImgDataUrl(null)}
                    aria-label="Remove comment photo"
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/75 text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label
                  title="Attach photo to comment"
                  className="px-2.5 py-2 min-h-[42px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ImagePlus className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCommentFileChange}
                    className="sr-only"
                  />
                </label>
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Write a supportive style note..."
                  className="flex-1 px-3 py-2 min-h-[42px] rounded-control text-xs bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                />
                <button
                  type="submit"
                  disabled={submittingComment || (!commentInput.trim() && !commentImgDataUrl)}
                  aria-label="Post comment"
                  className="px-3.5 py-2 min-h-[42px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                >
                  {submittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  );
};
