import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { SocialPost } from '../types';
import { PostCard } from './PostCard';
import { ArrowLeft, X } from 'lucide-react';

interface PostFeedViewerModalProps {
  open: boolean;
  posts: SocialPost[];
  initialPostId: string | null;
  title?: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onRemixPost?: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PostFeedViewerModal: React.FC<PostFeedViewerModalProps> = ({
  open,
  posts,
  initialPostId,
  title = 'Posts',
  onClose,
  onOpenProfile,
  onSelectHashtag,
  onRemixPost,
  onToast,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !initialPostId) return;
    const targetEl = itemRefs.current.get(initialPostId);
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'start', behavior: 'auto' });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [open, initialPostId]);

  if (!open || !initialPostId) return null;

  return (
    <div
      className="fixed inset-0 z-[72] bg-[#f5f4f0] dark:bg-[#171717] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shrink-0 h-14 px-4 sm:px-6 border-b border-[#d4cfc5] dark:border-[#404040] bg-white/95 dark:bg-[#242424]/95 backdrop-blur-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to grid"
            className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">{title}</h2>
            <p className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close feed viewer"
          className="w-10 h-10 rounded-control flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6"
      >
        <div className="w-full max-w-xl mx-auto space-y-5 pb-12">
          {posts.map((post) => (
            <div
              key={post.id}
              ref={(el) => {
                if (el) itemRefs.current.set(post.id, el);
                else itemRefs.current.delete(post.id);
              }}
              className="scroll-mt-4"
            >
              <PostCard
                post={post}
                onOpenProfile={(uid) => {
                  onClose();
                  onOpenProfile(uid);
                }}
                onSelectHashtag={
                  onSelectHashtag
                    ? (tag) => {
                        onClose();
                        onSelectHashtag(tag);
                      }
                    : undefined
                }
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
          ))}
        </div>
      </div>
    </div>
  );
};
