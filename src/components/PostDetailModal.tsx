import React, { useEffect } from 'react';
import { SocialPost } from '../types';
import { PostCard } from './PostCard';
import { Copy, X } from 'lucide-react';

interface PostDetailModalProps {
  post: SocialPost | null;
  openComments?: boolean;
  highlightCommentId?: string | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onRemixPost?: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  openComments = true,
  highlightCommentId = null,
  onClose,
  onOpenProfile,
  onRemixPost,
  onToast,
}) => {
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [post, onClose]);

  if (!post) return null;

  const postUrl = `${window.location.origin}/post/${post.id}`;

  return (
    <div
      className="fixed inset-0 z-[72] bg-black/75 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Post by @${post.authorUsername}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl my-auto space-y-3">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] shadow-lg">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(postUrl);
              onToast('Post link copied.');
            }}
            className="px-3 py-1.5 min-h-[36px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy link</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close post"
            className="w-9 h-9 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <PostCard
          post={post}
          defaultCommentsOpen={openComments}
          highlightCommentId={highlightCommentId}
          onOpenProfile={(uid) => {
            onClose();
            onOpenProfile(uid);
          }}
          onRemixPost={
            onRemixPost
              ? (p) => {
                  onClose();
                  onRemixPost(p);
                }
              : undefined
          }
          onToast={onToast}
        />
      </div>
    </div>
  );
};
