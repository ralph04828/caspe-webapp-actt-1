import React, { useEffect, useMemo, useState } from 'react';
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
import { GarmentImage } from './GarmentImage';
import {
  CloudSun,
  PlusSquare,
  Sparkles,
  Shirt,
  Compass,
  X,
  Users,
} from 'lucide-react';

interface HomeFeedPageProps {
  onNavigate: (section: NavSection) => void;
  onOpenCreatePost: () => void;
  onOpenProfile: (userId: string) => void;
  onRemixPost: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const HomeFeedPage: React.FC<HomeFeedPageProps> = ({
  onNavigate,
  onOpenCreatePost,
  onOpenProfile,
  onRemixPost,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe } = useWardrobe();
  const {
    visiblePostsForFeed,
    outgoingFollows,
    discoverProfiles,
    toggleFollow,
    loadingFeed,
  } = useSocial();

  const [feedMode, setFeedMode] = useState<'for_you' | 'following'>('for_you');
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [weather, setWeather] = useState<WeatherForecast | null>(() => getCachedWeather());

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

  const filteredPosts = useMemo(() => {
    return visiblePostsForFeed.filter((post) => {
      if (feedMode === 'following' && !acceptedFollowingIds.has(post.userId)) return false;
      if (typeFilter !== 'all' && post.postType !== typeFilter) return false;
      if (activeHashtag && !post.hashtags?.includes(activeHashtag)) return false;
      return true;
    });
  }, [visiblePostsForFeed, feedMode, acceptedFollowingIds, typeFilter, activeHashtag]);

  // Daily deterministic "Today's suggestion" from clean wardrobe items matching today's temperature
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
      {/* Main Feed Column */}
      <div className="xl:col-span-8 space-y-5">
        {/* Feed Mode + Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-full bg-[#eae7e0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]">
            {(
              [
                { id: 'for_you', label: 'For You' },
                { id: 'following', label: 'Following' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFeedMode(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  feedMode === tab.id
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    : 'text-[#4e4c46] dark:text-[#c2bfb8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
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
                className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-colors cursor-pointer ${
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
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-80 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0]/60 dark:bg-[#242424] animate-pulse"
              />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-3">
            <Users className="w-8 h-8 mx-auto opacity-60" />
            <h3 className="font-display font-bold text-lg">
              {feedMode === 'following' ? 'Your Following feed is quiet' : 'No matching fits yet'}
            </h3>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] max-w-md mx-auto">
              {feedMode === 'following'
                ? 'Follow style creators in Explore to see their daily fits and wardrobe pieces here.'
                : 'Share your first fit from My Lookbook or switch filters to see community posts.'}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="px-4 py-2 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore Creators</span>
              </button>
              <button
                type="button"
                onClick={onOpenCreatePost}
                className="px-4 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusSquare className="w-3.5 h-3.5" />
                <span>Share Your Fit</span>
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

            {filteredPosts.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 6)}
                  className="px-5 py-2.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                >
                  Load more fits
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Rail — Today's Suggestion, Weather & Suggested Creators */}
      <aside className="xl:col-span-4 space-y-5">
        {/* Weather & Daily Outfit Suggestion */}
        <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                Today&rsquo;s Suggestion
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
              Add clean garments to My Wardrobe for weather-aware daily picks.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('wardrobe')}
              className="py-2 px-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Wardrobe ({wardrobe.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai')}
              className="py-2 px-3 rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask SWOOOSH AI</span>
            </button>
          </div>
        </section>

        {/* Suggested Style Creators */}
        {suggestedCreators.length > 0 && (
          <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider">
                Creators to Follow
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="text-xs underline underline-offset-4 hover:opacity-75 cursor-pointer"
              >
                See all
              </button>
            </div>
            <div className="space-y-3">
              {suggestedCreators.map((creator) => (
                <div key={creator.uid} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(creator.uid)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    {creator.photoURL ? (
                      <img
                        src={creator.photoURL}
                        alt={creator.displayName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-[#d4cfc5] dark:border-[#404040] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-bold text-xs flex items-center justify-center shrink-0">
                        {creator.displayName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{creator.displayName}</p>
                      <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                        @{creator.username} · {creator.stylePreference || 'Streetwear'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFollow(creator)}
                    className="px-3 py-1.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-[11px] font-semibold hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors shrink-0 cursor-pointer"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
};
