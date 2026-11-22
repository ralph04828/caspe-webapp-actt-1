import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavSection, PostType, SocialPost, WeatherForecast } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import {
  fetchWeatherForLocation,
  getBrowserCoordinates,
  getCachedWeather,
} from '../services/weatherService';
import { getSuggestedSeasonsForTemp } from '../utils/formatters';
import { PostCard } from './PostCard';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { MyDayBar, MyDayUserGroup } from './MyDayBar';
import { OnboardingChecklistCard } from './OnboardingModal';
import {
  CloudSun,
  PlusSquare,
  RefreshCw,
  Shirt,
  Sparkles,
  X,
  Users,
  Layers,
} from 'lucide-react';

interface HomeFeedPageProps {
  onNavigate: (section: NavSection) => void;
  onOpenCreatePost: () => void;
  onOpenCreateMyDay: () => void;
  onOpenStoryViewer: (groups: MyDayUserGroup[], initialUserId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRemixPost: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const HomeFeedPage: React.FC<HomeFeedPageProps> = ({
  onNavigate,
  onOpenCreatePost,
  onOpenCreateMyDay,
  onOpenStoryViewer,
  onOpenProfile,
  onRemixPost,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe } = useWardrobe();
  const {
    visiblePostsForFeed,
    visibleFriendsPosts,
    myPosts,
    outgoingFollows,
    discoverProfiles,
    toggleFollow,
    sendFriendRequest,
    getFriendshipState,
    loadMorePublicPosts,
    refreshFeedAndProfiles,
    hasMorePublicPosts,
    loadingFeed,
  } = useSocial();

  const [feedMode, setFeedMode] = useState<'everyone' | 'friends' | 'mine'>('everyone');
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<WeatherForecast | null>(() => getCachedWeather());
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const savedLoc = userProfile?.weatherLocation;
    if (savedLoc) {
      fetchWeatherForLocation(savedLoc).then(setWeather).catch(() => {});
      return;
    }
    if (!weather) {
      getBrowserCoordinates()
        .then(({ lat, lon }) =>
          fetchWeatherForLocation({ name: 'Local Weather', lat, lon }).then(setWeather)
        )
        .catch(() => {});
    }
  }, [userProfile?.weatherLocation?.name]);

  const acceptedFollowingIds = useMemo(() => {
    const s = new Set<string>();
    if (userProfile) s.add(userProfile.uid);
    outgoingFollows.filter((f) => f.status === 'accepted').forEach((f) => s.add(f.targetId));
    return s;
  }, [outgoingFollows, userProfile]);

  const baseFeedPosts = useMemo(() => {
    if (feedMode === 'friends') return visibleFriendsPosts;
    if (feedMode === 'mine') return myPosts;
    return visiblePostsForFeed;
  }, [feedMode, visiblePostsForFeed, visibleFriendsPosts, myPosts]);

  const filteredPosts = useMemo(() => {
    return baseFeedPosts.filter((post) => {
      if (typeFilter !== 'all' && post.postType !== typeFilter) return false;
      if (activeHashtag && !post.hashtags?.includes(activeHashtag)) return false;
      return true;
    });
  }, [baseFeedPosts, typeFilter, activeHashtag]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshFeedAndProfiles();
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  };

  // Daily deterministic wardrobe rotation matching today's temperature
  const todaysSuggestion = useMemo(() => {
    const cleanItems = wardrobe.filter((w) => w.laundryStatus === 'clean');
    const pool = cleanItems.length > 0 ? cleanItems : wardrobe;
    if (pool.length === 0) return null;

    const preferredSeasons = getSuggestedSeasonsForTemp(weather?.currentTempC);
    const seasonMatch = (itemSeasons: string[] = []) =>
      itemSeasons.some((s) => preferredSeasons.includes(s as any));

    const tops = pool.filter((i) => ['T-shirts', 'Shirts', 'Hoodies', 'Jackets'].includes(i.category));
    const bottoms = pool.filter((i) => ['Pants', 'Shorts', 'Jorts'].includes(i.category));
    const shoes = pool.filter((i) => ['Shoes', 'Sneakers', 'Slides'].includes(i.category));

    const dayIndex = new Date().getDate();
    const pick = <T extends { seasons?: string[] }>(arr: T[]): T | undefined => {
      if (arr.length === 0) return undefined;
      const suited = arr.filter((a) => seasonMatch(a.seasons));
      const list = suited.length > 0 ? suited : arr;
      return list[dayIndex % list.length];
    };

    const top = pick(tops);
    const bottom = pick(bottoms);
    const shoe = pick(shoes);
    if (!top && !bottom && !shoe) return null;
    return { top, bottom, shoe };
  }, [wardrobe, weather?.currentTempC]);

  const suggestedCreators = useMemo(() => {
    if (!userProfile) return [];
    return discoverProfiles
      .filter((p) => p.uid !== userProfile.uid && !acceptedFollowingIds.has(p.uid))
      .slice(0, 4);
  }, [discoverProfiles, userProfile, acceptedFollowingIds]);

  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-12 gap-7"
      onTouchStart={(e) => {
        if (window.scrollY <= 4) touchStartYRef.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartYRef.current !== null) {
          const endY = e.changedTouches[0]?.clientY ?? 0;
          if (endY - touchStartYRef.current > 85 && window.scrollY <= 4) {
            handleRefresh();
          }
          touchStartYRef.current = null;
        }
      }}
    >
      {/* Main Feed Column */}
      <div className="xl:col-span-8 space-y-5">
        <MyDayBar
          onOpenCreateMyDay={onOpenCreateMyDay}
          onOpenViewer={onOpenStoryViewer}
        />

        <OnboardingChecklistCard onNavigate={onNavigate} />

        {/* Feed Mode + Refresh + Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-full bg-[#eae7e0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]">
              {(
                [
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'friends', label: 'Friends' },
                  { id: 'mine', label: 'Mine' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedMode(tab.id)}
                  className={`px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    feedMode === tab.id
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                      : 'text-[#4e4c46] dark:text-[#c2bfb8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh feed"
              title="Refresh feed"
              className="w-10 h-10 rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex items-center justify-center hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'outfit', label: 'Outfits' },
                { id: 'piece', label: 'Pieces' },
                { id: 'ootd', label: 'OOTD' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-chip text-xs font-medium border transition-colors cursor-pointer ${
                  typeFilter === f.id
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                    : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                }`}
              >
                {f.label}
              </button>
            ))}

            {activeHashtag && (
              <button
                type="button"
                onClick={() => setActiveHashtag(null)}
                className="px-3 py-1.5 rounded-chip text-xs font-semibold bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>#{activeHashtag}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Feed Posts */}
        {loadingFeed ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#eae7e0] dark:bg-[#303030]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-32 rounded bg-[#eae7e0] dark:bg-[#303030]" />
                    <div className="h-2.5 w-20 rounded bg-[#eae7e0] dark:bg-[#303030]" />
                  </div>
                </div>
                <div className="h-64 rounded-card bg-[#eae7e0] dark:bg-[#303030]" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-3">
            <Users className="w-8 h-8 mx-auto opacity-60" />
            <h3 className="font-display font-bold text-lg">
              {feedMode === 'friends'
                ? 'Your Friends feed is quiet'
                : feedMode === 'mine'
                ? 'You have not posted any fits yet'
                : 'No matching fits yet'}
            </h3>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] max-w-md mx-auto">
              {feedMode === 'friends'
                ? 'Find friends and style creators in People to see their daily fits and stories here.'
                : 'Share an OOTD, lookbook outfit, or garment piece to start the conversation.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('people')}
                className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Find People</span>
              </button>
              <button
                type="button"
                onClick={onOpenCreatePost}
                className="px-4 py-2 min-h-[42px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusSquare className="w-3.5 h-3.5" />
                <span>Create Post</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredPosts.slice(0, visibleCount).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenProfile={onOpenProfile}
                onSelectHashtag={(tag) => setActiveHashtag(tag)}
                onRemixPost={onRemixPost}
                onToast={onToast}
              />
            ))}

            {(filteredPosts.length > visibleCount || (feedMode === 'everyone' && hasMorePublicPosts)) && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setVisibleCount((prev) => prev + 10);
                    if (feedMode === 'everyone' && filteredPosts.length <= visibleCount + 10 && hasMorePublicPosts) {
                      loadMorePublicPosts();
                    }
                  }}
                  className="px-5 py-2.5 min-h-[44px] rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                >
                  Load more fits
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Rail — Daily Rotation, Weather & Suggested People */}
      <aside className="xl:col-span-4 space-y-5">
        <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                Daily Wardrobe Rotation
              </p>
              <h2 className="font-display font-bold text-lg mt-0.5">
                Ready for today
              </h2>
            </div>
            {weather && (
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 font-mono-num font-bold text-base">
                  <CloudSun className="w-4 h-4" />
                  <span>{weather.currentTempC}°C</span>
                </div>
                <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate max-w-[140px]">
                  {weather.locationName}
                </p>
              </div>
            )}
          </div>

          {weather && (
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] leading-relaxed p-3 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]">
              {weather.clothingAdvice}
            </p>
          )}

          {todaysSuggestion ? (
            <div className="grid grid-cols-3 gap-2">
              {[todaysSuggestion.top, todaysSuggestion.bottom, todaysSuggestion.shoe]
                .filter(Boolean)
                .map((item) => (
                  <div
                    key={item!.id}
                    className="rounded-control border border-[#d4cfc5] dark:border-[#404040] overflow-hidden bg-[#f5f4f0] dark:bg-[#171717]"
                  >
                    <div className="aspect-square">
                      <GarmentImage
                        src={item!.thumbUrl || item!.imageUrl}
                        mediaId={item!.mediaId}
                        alt={item!.altText || item!.name}
                        isCutout={item!.isCutout}
                      />
                    </div>
                    <p className="p-1.5 text-[10px] font-semibold truncate">{item!.name}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              Add clean garments to My Wardrobe for weather-matched daily picks.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('wardrobe')}
              className="py-2 px-3 min-h-[42px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Wardrobe ({wardrobe.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('builder')}
              className="py-2 px-3 min-h-[42px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fit Builder</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ootd')}
            className="w-full py-2 px-3 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open OOTD Spotlight</span>
          </button>
        </section>

        {/* Suggested Style Creators */}
        {suggestedCreators.length > 0 && (
          <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider">
                People to Connect With
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('people')}
                className="text-xs underline underline-offset-4 hover:opacity-75 cursor-pointer"
              >
                Directory
              </button>
            </div>
            <div className="space-y-3">
              {suggestedCreators.map((creator) => {
                const fState = getFriendshipState(creator.uid);
                return (
                  <div key={creator.uid} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(creator.uid)}
                      className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                    >
                      <AvatarImage
                        src={creator.photoURL}
                        mediaId={creator.mediaId}
                        name={creator.displayName || creator.username}
                        sizeClass="w-9 h-9"
                        textSizeClass="text-xs"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{creator.displayName}</p>
                        <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                          @{creator.username} · {creator.stylePreference || 'Streetwear'}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {fState === 'none' && (
                        <button
                          type="button"
                          onClick={() => sendFriendRequest(creator)}
                          className="px-2.5 py-1.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[11px] font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFollow(creator)}
                        className="px-2.5 py-1.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-[11px] font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
                      >
                        Follow
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
};
