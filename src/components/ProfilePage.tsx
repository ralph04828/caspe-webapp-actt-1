import React, { useEffect, useMemo, useState } from 'react';
import {
  BOTTOM_CATEGORIES,
  ClothingItem,
  NavSection,
  SHOE_CATEGORIES,
  SocialPost,
  TOP_CATEGORIES,
  UserProfile,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { getUserProfile } from '../services/firestoreService';
import { daysSince } from '../utils/formatters';
import { GarmentImage } from './GarmentImage';
import { PostCard } from './PostCard';
import {
  ArrowLeft,
  Ban,
  Flame,
  Lock,
  Settings,
  UserPlus,
  Check,
  Clock,
  VolumeX,
} from 'lucide-react';

interface ProfilePageProps {
  viewingUserId: string | null; // null = current user's own profile
  onBackToOwn: () => void;
  onOpenProfile: (uid: string) => void;
  onNavigate: (section: NavSection) => void;
  onRemixPost: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  viewingUserId,
  onBackToOwn,
  onOpenProfile,
  onNavigate,
  onRemixPost,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe, wearLogs } = useWardrobe();
  const {
    visiblePostsForFeed,
    savedPostIds,
    discoverProfiles,
    isFollowing,
    toggleFollow,
    fetchProfileData,
    toggleBlock,
    toggleMute,
    isBlocked,
    isMuted,
  } = useSocial();

  const isOwn = !viewingUserId || viewingUserId === userProfile?.uid;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);
  const [profileWardrobe, setProfileWardrobe] = useState<ClothingItem[]>([]);
  const [tab, setTab] = useState<'fits' | 'wardrobe' | 'stats' | 'saved'>('fits');

  useEffect(() => {
    if (isOwn) {
      setTargetProfile(userProfile);
      setProfilePosts(visiblePostsForFeed.filter((p) => p.userId === userProfile?.uid));
      setProfileWardrobe(wardrobe);
      return;
    }

    const fromDiscover = discoverProfiles.find((p) => p.uid === viewingUserId) || null;
    if (fromDiscover) {
      setTargetProfile(fromDiscover);
      fetchProfileData(fromDiscover).then(({ posts, wardrobe: w }) => {
        setProfilePosts(posts);
        setProfileWardrobe(w);
      });
    } else if (viewingUserId) {
      getUserProfile(viewingUserId)
        .then((p) => {
          setTargetProfile(p);
          if (p) {
            fetchProfileData(p).then(({ posts, wardrobe: w }) => {
              setProfilePosts(posts);
              setProfileWardrobe(w);
            });
          }
        })
        .catch(() => {});
    }
  }, [viewingUserId, isOwn, userProfile, visiblePostsForFeed, wardrobe, discoverProfiles]);

  // Owner-only private Style Stats (NO prices / costs!)
  const styleStats = useMemo(() => {
    const sortedByWear = [...wardrobe].sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
    const mostWorn = sortedByWear.slice(0, 3);
    const neglected = wardrobe.filter((w) => {
      const d = daysSince(w.lastWornAt);
      return w.wearCount === 0 || (d !== null && d >= 60);
    });

    const tops = wardrobe.filter((w) => TOP_CATEGORIES.includes(w.category)).length;
    const bottoms = wardrobe.filter((w) => BOTTOM_CATEGORIES.includes(w.category)).length;
    const shoes = wardrobe.filter((w) => SHOE_CATEGORIES.includes(w.category)).length;
    const versatilityCombos = Math.max(0, tops * bottoms * Math.max(1, shoes));

    // Wear streak calculation
    const uniqueDates = Array.from(new Set(wearLogs.map((l) => l.date))).sort().reverse();
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 60; i++) {
      const iso = cursor.toISOString().split('T')[0];
      if (uniqueDates.includes(iso)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const totalLikesReceived = visiblePostsForFeed
      .filter((p) => p.userId === userProfile?.uid)
      .reduce((acc, p) => acc + (p.likesCount || 0), 0);

    return { mostWorn, neglected, versatilityCombos, streak, totalLikesReceived };
  }, [wardrobe, wearLogs, visiblePostsForFeed, userProfile?.uid]);

  const savedPosts = useMemo(
    () => visiblePostsForFeed.filter((p) => savedPostIds.has(p.id)),
    [visiblePostsForFeed, savedPostIds]
  );

  if (!targetProfile) {
    return (
      <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs">
        Loading profile...
      </div>
    );
  }

  const followStatus = isOwn ? 'none' : isFollowing(targetProfile.uid);
  const canSeePrivateContent = isOwn || targetProfile.isPublic || followStatus === 'accepted';
  const initial = (targetProfile.displayName || targetProfile.username || 'S').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {!isOwn && (
        <button
          type="button"
          onClick={onBackToOwn}
          className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Profile</span>
        </button>
      )}

      {/* Profile Header Card */}
      <section className="p-6 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          {targetProfile.photoURL ? (
            <img
              src={targetProfile.photoURL}
              alt={targetProfile.displayName}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full object-cover border border-[#d4cfc5] dark:border-[#404040] shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-display font-bold text-2xl flex items-center justify-center shrink-0">
              {initial}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {targetProfile.displayName}
              </h1>
              {!targetProfile.isPublic && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[11px] border border-[#d4cfc5] dark:border-[#404040]">
                  <Lock className="w-3 h-3" /> Private account
                </span>
              )}
            </div>
            <p className="text-xs font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
              @{targetProfile.username}
            </p>
            {targetProfile.bio && <p className="text-sm max-w-xl">{targetProfile.bio}</p>}

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <span>
                <strong className="font-mono-num">{targetProfile.followersCount || 0}</strong>{' '}
                Followers
              </span>
              <span>
                <strong className="font-mono-num">{targetProfile.followingCount || 0}</strong>{' '}
                Following
              </span>
              <span>
                <strong className="font-mono-num">{profilePosts.length}</strong> Fits
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOwn ? (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="px-4 py-2 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Edit Profile & Privacy</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => toggleFollow(targetProfile)}
                className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  followStatus === 'accepted' || followStatus === 'pending'
                    ? 'border border-[#d4cfc5] dark:border-[#404040]'
                    : 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                }`}
              >
                {followStatus === 'accepted' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Following</span>
                  </>
                ) : followStatus === 'pending' ? (
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
              <button
                type="button"
                onClick={() => {
                  toggleMute({
                    uid: targetProfile.uid,
                    username: targetProfile.username,
                    displayName: targetProfile.displayName,
                  });
                  onToast(isMuted(targetProfile.uid) ? 'Unmuted user.' : 'Muted user.');
                }}
                className="p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                title="Mute user"
              >
                <VolumeX className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleBlock({
                    uid: targetProfile.uid,
                    username: targetProfile.username,
                    displayName: targetProfile.displayName,
                  });
                  onToast(isBlocked(targetProfile.uid) ? 'Unblocked user.' : 'Blocked user.');
                }}
                className="p-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-red-600 dark:text-red-400 cursor-pointer"
                title="Block user"
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </section>

      {!canSeePrivateContent ? (
        <div className="p-10 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
          <Lock className="w-7 h-7 mx-auto opacity-70" />
          <h2 className="font-display font-bold text-lg">This account is private</h2>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Send a follow request to see @{targetProfile.username}&rsquo;s fits and public wardrobe pieces.
          </p>
        </div>
      ) : (
        <>
          {/* Profile Tabs */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTab('fits')}
              className={`px-4 py-2 rounded-control text-xs font-semibold border cursor-pointer ${
                tab === 'fits'
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
              }`}
            >
              Fits ({profilePosts.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('wardrobe')}
              className={`px-4 py-2 rounded-control text-xs font-semibold border cursor-pointer ${
                tab === 'wardrobe'
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
              }`}
            >
              {isOwn ? `My Wardrobe (${profileWardrobe.length})` : `Visible Wardrobe (${profileWardrobe.length})`}
            </button>
            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('stats')}
                  className={`px-4 py-2 rounded-control text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                    tab === 'stats'
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Style Stats (Private)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('saved')}
                  className={`px-4 py-2 rounded-control text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                    tab === 'saved'
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Saved ({savedPosts.length})</span>
                </button>
              </>
            )}
          </div>

          {tab === 'fits' && (
            <div className="space-y-4 max-w-2xl">
              {profilePosts.length === 0 ? (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">No shared fits yet.</p>
              ) : (
                profilePosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    onOpenProfile={onOpenProfile}
                    onRemixPost={onRemixPost}
                    onToast={onToast}
                  />
                ))
              )}
            </div>
          )}

          {tab === 'wardrobe' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {profileWardrobe.map((item) => (
                <div
                  key={item.id}
                  className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden"
                >
                  <div className="aspect-square bg-[#eae7e0] dark:bg-[#171717]">
                    <GarmentImage
                      src={item.thumbUrl || item.imageUrl}
                      alt={item.altText || item.name}
                      isCutout={item.isCutout}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      {item.brand} · {item.color}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'stats' && isOwn && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]">
                  <p className="text-[11px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Wear Streak
                  </p>
                  <p className="font-display text-2xl font-bold mt-1 flex items-center gap-1.5">
                    <Flame className="w-5 h-5" />
                    <span className="font-mono-num">{styleStats.streak} days</span>
                  </p>
                </div>
                <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]">
                  <p className="text-[11px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Possible Outfit Combos
                  </p>
                  <p className="font-display text-2xl font-bold font-mono-num mt-1">
                    {styleStats.versatilityCombos}
                  </p>
                </div>
                <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]">
                  <p className="text-[11px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Not Worn 60+ Days
                  </p>
                  <p className="font-display text-2xl font-bold font-mono-num mt-1">
                    {styleStats.neglected.length}
                  </p>
                </div>
                <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]">
                  <p className="text-[11px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Community Likes
                  </p>
                  <p className="font-display text-2xl font-bold font-mono-num mt-1">
                    {styleStats.totalLikesReceived}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
                  <h3 className="font-display font-bold text-sm uppercase tracking-wider">
                    Most Worn Rotation
                  </h3>
                  {styleStats.mostWorn.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                        {item.wearCount} wears
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
                  <h3 className="font-display font-bold text-sm uppercase tracking-wider">
                    Needs Rotation (60+ days / 0 wears)
                  </h3>
                  {styleStats.neglected.length === 0 ? (
                    <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                      Great balance—every piece has been worn recently.
                    </p>
                  ) : (
                    styleStats.neglected.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                          {item.lastWornAt ? `${daysSince(item.lastWornAt)}d ago` : 'Never logged'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'saved' && isOwn && (
            <div className="space-y-4 max-w-2xl">
              {savedPosts.length === 0 ? (
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                  Saved fits from your feed will appear here privately.
                </p>
              ) : (
                savedPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    onOpenProfile={onOpenProfile}
                    onRemixPost={onRemixPost}
                    onToast={onToast}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
