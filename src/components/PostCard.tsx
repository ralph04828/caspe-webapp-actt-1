import React, { useState } from 'react';
import { PostComment, SocialPost } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { formatRelativeTime } from '../utils/formatters';
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
  const { userProfile } = useAuth();
  const {
    likedPostIds,
    savedPostIds,
    toggleLike,
    toggleSave,
    loadComments,
    addComment,
    deleteComment,
    deletePost,
    toggleBlock,
    toggleMute,
    reportItem,
  } = useSocial();

  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const isOwner = userProfile?.uid === post.userId;
  const isLiked = likedPostIds.has(post.id);
  const isSaved = savedPostIds.has(post.id);

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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const created = await addComment(post, commentInput);
      setComments((prev) => [...prev, created]);
      setCommentInput('');
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

  const renderCaption = (text: string) => {
    const tokens = text.split(/(\s+)/);
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

  const initial = (post.authorName || post.authorUsername || 'S').charAt(0).toUpperCase();

  return (
    <article className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpenProfile(post.userId)}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
        >
          {post.authorPhotoUrl ? (
            <img
              src={post.authorPhotoUrl}
              alt={post.authorName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-[#d4cfc5] dark:border-[#404040] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-display font-bold text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold truncate group-hover:underline">
                {post.authorName}
              </span>
              <span className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                @{post.authorUsername}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.occasion && <span>· {post.occasion}</span>}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0 relative">
          <span className="px-2 py-0.5 rounded-chip text-[10px] font-mono-num uppercase tracking-wider border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]">
            {post.postType === 'ootd' ? 'OOTD' : post.postType.toUpperCase()}
          </span>
          {post.visibility !== 'public' && <VisibilityBadge visibility={post.visibility} />}

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Post options"
            className="p-2 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-44 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] shadow-xl py-1 text-xs">
              {isOwner ? (
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

      {/* Main Photo */}
      {post.mediaUrl && (
        <div className="aspect-[4/3] sm:aspect-[16/11] bg-[#eae7e0] dark:bg-[#171717] overflow-hidden border-y border-[#d4cfc5]/60 dark:border-[#404040]/60">
          <GarmentImage
            src={post.mediaUrl}
            alt={post.altText || post.caption}
            className="w-full h-full object-cover"
          />
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
                  <GarmentImage src={piece.imageUrl} alt={piece.name} />
                )}
              </div>
              <div className="min-w-0 max-w-[140px]">
                <p className="text-[11px] font-semibold truncate">
                  {piece.isPrivatePlaceholder ? 'Private piece' : piece.name}
                </p>
                <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                  {piece.isPrivatePlaceholder ? piece.category : `${piece.brand || piece.category} · ${piece.color}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Caption & Style Tags */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm leading-relaxed">{renderCaption(post.caption)}</p>
        {post.styleTags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.styleTags.map((tag) => (
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
      <div className="px-4 py-2.5 border-t border-[#d4cfc5]/70 dark:border-[#404040]/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => toggleLike(post)}
            aria-label={isLiked ? 'Unlike post' : 'Like post'}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiked
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                : 'hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="font-mono-num">{post.likesCount}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleComments}
            aria-label="Toggle comments"
            className="min-h-[38px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-mono-num">{post.commentsCount}</span>
          </button>

          {post.allowRemix && post.piecesPreview && post.piecesPreview.length > 0 && onRemixPost && (
            <button
              type="button"
              onClick={() => onRemixPost(post)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
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
          className={`min-h-[38px] px-2.5 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isSaved
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
              : 'hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
        </button>
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
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {comments.map((c) => {
                const canDelete = userProfile?.uid === c.userId || isOwner;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <button
                        type="button"
                        onClick={() => onOpenProfile(c.userId)}
                        className="font-semibold hover:underline cursor-pointer mr-1.5"
                      >
                        @{c.authorUsername}
                      </button>
                      <span>{c.text}</span>
                      <span className="ml-2 text-[10px] text-[#4e4c46] dark:text-[#c2bfb8]">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c)}
                        aria-label="Delete comment"
                        className="text-[#4e4c46] dark:text-[#c2bfb8] hover:text-red-500 p-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {post.commentPolicy !== 'off' && (
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Write a supportive style note..."
                className="flex-1 px-3 py-2 rounded-control text-xs bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentInput.trim()}
                aria-label="Post comment"
                className="px-3.5 py-2 rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
};
