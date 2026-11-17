import React, { useMemo, useState } from 'react';
import { STYLE_CATEGORIES, SocialPost } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { GarmentImage } from './GarmentImage';
import { PostCard } from './PostCard';
import { Search, Heart, MessageCircle, Repeat, UserPlus, Check, Clock } from 'lucide-react';

interface ExplorePageProps {
  onOpenProfile: (userId: string) => void;
  onRemixPost: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  onOpenProfile,
  onRemixPost,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const {
    visiblePostsForFeed,
    discoverProfiles,
    isFollowing,
    toggleFollow,
  } = useSocial();

  const [queryText, setQueryText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('All');
  const [focusedPost, setFocusedPost] = useState<SocialPost | null>(null);

  const matchingPeople = useMemo(() => {
    const q = queryText.trim().toLowerCase().replace(/^@/, '');
    const myTags = new Set(userProfile?.styleTags || []);

    return discoverProfiles
      .filter((p) => p.uid !== userProfile?.uid)
      .filter((p) => {
        if (!q) return true;
        return (
          p.usernameLower.includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          (p.styleTags || []).some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const aScore = (a.styleTags || []).filter((t) => myTags.has(t)).length;
        const bScore = (b.styleTags || []).filter((t) => myTags.has(t)).length;
        return bScore - aScore;
      });
  }, [discoverProfiles, queryText, userProfile]);

  const matchingPosts = useMemo(() => {
    const q = queryText.trim().toLowerCase().replace(/^#/, '');
    return visiblePostsForFeed.filter((post) => {
      if (selectedStyle !== 'All' && !post.styleTags?.includes(selectedStyle)) return false;
      if (!q) return true;
      return (
        post.caption.toLowerCase().includes(q) ||
        post.authorUsername.toLowerCase().includes(q) ||
        post.hashtags?.some((h) => h.includes(q)) ||
        post.styleTags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [visiblePostsForFeed, selectedStyle, queryText]);

  return (
    <div className="space-y-7">
      {/* Search & Style Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#4e4c46] dark:text-[#c2bfb8]" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search people (@handle), #hashtags, or aesthetics..."
            className="w-full pl-10 pr-4 py-2.5 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['All', ...STYLE_CATEGORIES].map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setSelectedStyle(style)}
              className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-colors cursor-pointer ${
                selectedStyle === style
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* People Matching Your Style */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">
            {queryText ? 'People' : 'Suggested Style Creators'}
          </h2>
          <span className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Matched to your aesthetics
          </span>
        </div>

        {matchingPeople.length === 0 ? (
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            No matching creators found.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {matchingPeople.slice(0, 6).map((person) => {
              const status = isFollowing(person.uid);
              return (
                <div
                  key={person.uid}
                  className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex items-center justify-between gap-3 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProfile(person.uid)}
                    className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                  >
                    {person.photoURL ? (
                      <img
                        src={person.photoURL}
                        alt={person.displayName}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover border border-[#d4cfc5] dark:border-[#404040] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-bold flex items-center justify-center shrink-0">
                        {person.displayName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{person.displayName}</p>
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                        @{person.username}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(person.styleTags || []).slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded-chip text-[10px] bg-[#eae7e0] dark:bg-[#303030]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFollow(person)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                      status === 'accepted'
                        ? 'border border-[#d4cfc5] dark:border-[#404040]'
                        : status === 'pending'
                        ? 'border border-[#d4cfc5] dark:border-[#404040] opacity-75'
                        : 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    }`}
                  >
                    {status === 'accepted' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : status === 'pending' ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Requested</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Photo-First Lookbook Grid */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-base uppercase tracking-wider">
          Discover Fits ({matchingPosts.length})
        </h2>

        {matchingPosts.length === 0 ? (
          <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            No public fits match this filter yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {matchingPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setFocusedPost(post)}
                className="group relative aspect-[3/4] rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#242424] text-left cursor-pointer"
              >
                <GarmentImage
                  src={post.thumbUrl || post.mediaUrl}
                  alt={post.altText || post.caption}
                  fallbackLabel={post.caption}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent flex flex-col justify-end p-3 text-[#f5f4f0]">
                  <p className="text-xs font-semibold truncate">@{post.authorUsername}</p>
                  <p className="text-[11px] opacity-85 line-clamp-1">{post.caption}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono-num">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {post.likesCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {post.commentsCount}
                    </span>
                    {post.allowRemix && (
                      <span className="flex items-center gap-1 ml-auto">
                        <Repeat className="w-3 h-3" /> Remix
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Focused Post Modal */}
      {focusedPost && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setFocusedPost(null)}
        >
          <div className="w-full max-w-xl my-auto" onClick={(e) => e.stopPropagation()}>
            <PostCard
              post={focusedPost}
              onOpenProfile={(uid) => {
                setFocusedPost(null);
                onOpenProfile(uid);
              }}
              onSelectHashtag={(tag) => {
                setQueryText(`#${tag}`);
                setFocusedPost(null);
              }}
              onRemixPost={(p) => {
                setFocusedPost(null);
                onRemixPost(p);
              }}
              onToast={onToast}
            />
          </div>
        </div>
      )}
    </div>
  );
};
