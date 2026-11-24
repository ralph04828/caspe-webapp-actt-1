import React, { useState } from 'react';
import { SocialPost } from '../types';
import { GarmentImage } from './GarmentImage';
import { Copy, Layers, Lock } from 'lucide-react';

interface MediaGridTilesProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost, index: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
}

export const MediaGridTiles: React.FC<MediaGridTilesProps> = ({
  posts,
  onSelectPost,
  emptyTitle = 'No posts yet',
  emptyDescription = 'Shared outfits and OOTD photos will appear here.',
  pageSize = 24,
}) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  if (posts.length === 0) {
    return (
      <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-1.5">
        <p className="font-display font-bold text-sm">{emptyTitle}</p>
        <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">{emptyDescription}</p>
      </div>
    );
  }

  const displayed = posts.slice(0, visibleCount);
  const hasMore = posts.length > visibleCount;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2">
        {displayed.map((post, idx) => {
          const thumbSrc =
            post.thumbUrls?.[0] ||
            post.thumbUrl ||
            post.mediaUrls?.[0] ||
            post.mediaUrl ||
            post.piecesPreview?.find((p) => !p.isPrivatePlaceholder && (p.thumbUrl || p.imageUrl))
              ?.thumbUrl ||
            post.piecesPreview?.find((p) => !p.isPrivatePlaceholder && p.imageUrl)?.imageUrl;

          const mediaId =
            post.mediaIds?.[0] ||
            post.mediaId ||
            post.piecesPreview?.find((p) => !p.isPrivatePlaceholder && p.mediaId)?.mediaId;

          const multiCount = post.mediaUrls?.length || (post.mediaUrl ? 1 : 0);
          const isOutfitGridFallback =
            !post.mediaUrl &&
            !(post.mediaUrls && post.mediaUrls.length > 0) &&
            (post.piecesPreview?.length || 0) > 1;

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelectPost(post, idx)}
              aria-label={`Open post by @${post.authorUsername}`}
              className="group relative aspect-square bg-[#eae7e0] dark:bg-[#1e1e1e] overflow-hidden rounded-sm sm:rounded-control border border-[#d4cfc5]/60 dark:border-[#404040]/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] dark:focus-visible:ring-[#e5e1da]"
            >
              <GarmentImage
                src={thumbSrc}
                mediaId={mediaId}
                alt={post.altText || post.title || post.caption || `Post by @${post.authorUsername}`}
                fallbackLabel={post.title || post.styleTags?.[0] || 'Fit'}
                className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
              />

              {multiCount > 1 && (
                <span
                  aria-label={`${multiCount} photos`}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center shadow"
                >
                  <Copy className="w-3 h-3" />
                </span>
              )}

              {multiCount <= 1 && isOutfitGridFallback && (
                <span
                  aria-label="Outfit pieces"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center shadow"
                >
                  <Layers className="w-3 h-3" />
                </span>
              )}

              {post.visibility === 'private' && (
                <span
                  aria-label="Private post"
                  className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center"
                >
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + pageSize)}
            className="px-5 py-2.5 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            Load more ({posts.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
