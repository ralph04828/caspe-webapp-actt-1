import React, { useEffect, useMemo, useState } from 'react';
import {
  BOTTOM_CATEGORIES,
  ClothingItem,
  MyDayStory,
  NavSection,
  Outfit,
  SHOE_CATEGORIES,
  SocialPost,
  TOP_CATEGORIES,
  UserProfile,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { getUserProfile } from '../services/firestoreService';
import { daysSince, formatRelativeTime } from '../utils/formatters';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { PostCard } from './PostCard';
import {
  ArrowLeft,
  Ban,
  Check,
  Clock,
  Copy,
  Flag,
  Flame,
  Lock,
  MessageCircle,
  Settings,
  UserMinus,
  UserPlus,
  Users,
  VolumeX,
} from 'lucide-react';

interface ProfilePageProps {
  viewingUserId: string | null; // null = current user's own profile
  onBackToOwn: () => void;
  onOpenProfile: (uid: string) => void;
  onNavigate: (section: NavSection) => void;
  onMessageUser?: (target: UserProfile) => void;
  onViewStory?: (userId: string) => void;
  onRemixPost: (post: SocialPost) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  viewingUserId,
  onBackToOwn,
  onOpenProfile,
  onNavigate,
  onMessageUser,
  onViewStory,
  onRemixPost,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const { wardrobe, outfits, wearLogs } = useWardrobe();
  const {
    visiblePostsForFeed,
    myPosts,
    savedPostIds,
    discoverProfiles,
    friendships,
    friendIds,
    storiesForFeed,
    isFollowing,
    getFriendshipState,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrCancelFriend,
    toggleFollow,
    fetchProfileData,
    toggleBlock,
    toggleMute,
    reportItem,
    isBlocked,
    isMuted,
  } = useSocial();

  const isOwn = !viewingUserId || viewingUserId === userProfile?.uid;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);
  const [profileWardrobe, setProfileWardrobe] = useState<ClothingItem[]>([]);
  const [profileOutfits, setProfileOutfits] = useState<Outfit[]>([]);
  const [profileStories, setProfileStories] = useState<MyDayStory[]>([]);
  const [tab, setTab] = useState<'posts' | 'wardrobe' | 'lookbook' | 'myday' | 'friends' | 'stats' | 'saved'>('posts');

  useEffect(() => {
    if (isOwn) {
      setTargetProfile(userProfile);
      setProfilePosts(myPosts.length > 0 ? myPosts : visiblePostsForFeed.filter((p) => p.userId === userProfile?.uid));
      setProfileWardrobe(wardrobe);
      setProfileOutfits(outfits);
      setProfileStories(storiesForFeed.filter((s) => s.userId === userProfile?.uid));
      return;
    }

    const fromDiscover = discoverProfiles.find((p) => p.uid === viewingUserId) || null;
    if (fromDiscover) {
      setTargetProfile(fromDiscover);
      fetchProfileData(fromDiscover).then(({ posts, wardrobe: w, outfits: o, stories: st }) => {
        setProfilePosts(posts);
        setProfileWardrobe(w);
        setProfileOutfits(o);
        setProfileStories(st);
      });
    } else if (viewingUserId) {
      getUserProfile(viewingUserId)
        .then((p) => {
          setTargetProfile(p);
          if (p) {
            fetchProfileData(p).then(({ posts, wardrobe: w, outfits: o, stories: st }) => {
              setProfilePosts(posts);
              setProfileWardrobe(w);
              setProfileOutfits(o);
              setProfileStories(st);
            });
          }
        })
        .catch(() => {});
    }
  }, [viewingUserId, isOwn, userProfile, myPosts, visiblePostsForFeed, wardrobe, outfits, storiesForFeed, discoverProfiles]);

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

  const ownFriendProfiles = useMemo(
    () => discoverProfiles.filter((p) => friendIds.includes(p.uid)),
    [discoverProfiles, friendIds]
  );

  if (!targetProfile) {
    return (
      <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs">
        Loading profile...
      </div>
    );
  }

  const followStatus = isOwn ? 'none' : isFollowing(targetProfile.uid);
  const friendState = isOwn ? 'none' : getFriendshipState(targetProfile.uid);
  const incomingEdge =
    !isOwn && userProfile
      ? friendships.find(
          (f) => f.status === 'pending' && f.requesterId === targetProfile.uid && f.recipientId === userProfile.uid
        )
      : undefined;

  const canSeePrivateContent =
    isOwn || targetProfile.isPublic || friendState === 'friends' || followStatus === 'accepted';

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?u=${targetProfile.username}`;
    navigator.clipboard?.writeText(link);
    onToast('Invite link copied!');
  };

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
          <AvatarImage
            src={targetProfile.photoURL}
            mediaId={targetProfile.mediaId}
            name={targetProfile.displayName || targetProfile.username}
            sizeClass="w-20 h-20"
            textSizeClass="text-2xl"
          />

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
              {targetProfile.pronouns ? ` · ${targetProfile.pronouns}` : ''}
              {targetProfile.location ? ` · ${targetProfile.location}` : ''}
            </p>
            {targetProfile.bio && <p className="text-sm max-w-xl">{targetProfile.bio}</p>}

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <span>
                <strong className="font-mono-num">{targetProfile.friendsCount || (isOwn ? friendIds.length : 0)}</strong>{' '}
                Friends
              </span>
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
            <>
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy invite link</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="px-4 py-2 min-h-[42px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Edit Profile & Privacy</span>
              </button>
            </>
          ) : (
            <>
              {friendState === 'friends' ? (
                <button
                  type="button"
                  onClick={() => removeOrCancelFriend(targetProfile.uid)}
                  className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Friends</span>
                </button>
              ) : friendState === 'incoming_pending' && incomingEdge ? (
                <button
                  type="button"
                  onClick={() => acceptFriendRequest(incomingEdge)}
                  className="px-4 py-2 min-h-[42px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Accept Friend</span>
                </button>
              ) : friendState === 'outgoing_pending' ? (
                <button
                  type="button"
                  onClick={() => removeOrCancelFriend(targetProfile.uid)}
                  className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 opacity-80 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Requested</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sendFriendRequest(targetProfile)}
                  className="px-4 py-2 min-h-[42px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </button>
              )}

              {onMessageUser && (
                <button
                  type="button"
                  onClick={() => onMessageUser(targetProfile)}
                  className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleFollow(targetProfile)}
                className="px-4 py-2 min-h-[42px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Follow Requested' : 'Follow'}
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
                className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
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
                className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-red-600 dark:text-red-400 flex items-center justify-center cursor-pointer"
                title="Block user"
              >
                <Ban className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await reportItem({
                    targetType: 'user',
                    targetId: targetProfile.uid,
                    targetOwnerId: targetProfile.uid,
                    reason: 'Profile safety report',
                  });
                  onToast('User reported for review.');
                }}
                className="w-10 h-10 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
                title="Report user"
              >
                <Flag className="w-4 h-4" />
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
            Add as a friend or send a follow request to view @{targetProfile.username}&rsquo;s posts, wardrobe, and lookbook.
          </p>
        </div>
      ) : (
        <>
          {/* Profile Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'posts', label: `Posts (${profilePosts.length})` },
                {
                  id: 'wardrobe',
                  label: isOwn ? `Wardrobe (${profileWardrobe.length})` : `Visible Wardrobe (${profileWardrobe.length})`,
                },
                { id: 'lookbook', label: `Lookbook (${profileOutfits.length})` },
                { id: 'myday', label: `MyDay (${profileStories.length})` },
                ...(isOwn ? [{ id: 'friends', label: `Friends (${ownFriendProfiles.length})` }] : []),
              ] as { id: 'posts' | 'wardrobe' | 'lookbook' | 'myday' | 'friends'; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 min-h-[40px] rounded-control text-xs font-semibold border cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                    : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                }`}
              >
                {t.label}
              </button>
            ))}

            {isOwn && (
              <>
                <button
                  type="button"
                  onClick={() => setTab('stats')}
                  className={`px-4 py-2 min-h-[40px] rounded-control text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                    tab === 'stats'
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                      : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Style Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('saved')}
                  className={`px-4 py-2 min-h-[40px] rounded-control text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
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

          {tab === 'posts' && (
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
            profileWardrobe.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                No visible wardrobe items yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {profileWardrobe.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden"
                  >
                    <div className="aspect-square bg-[#eae7e0] dark:bg-[#171717]">
                      <GarmentImage
                        src={item.thumbUrl || item.imageUrl}
                        mediaId={item.mediaId}
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
            )
          )}

          {tab === 'lookbook' && (
            profileOutfits.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                No visible lookbook outfits yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profileOutfits.map((outfit) => (
                  <div
                    key={outfit.id}
                    className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-[#eae7e0] dark:bg-[#171717]">
                      <GarmentImage
                        src={outfit.coverImageUrl}
                        mediaId={outfit.mediaId}
                        alt={outfit.name}
                        fallbackLabel={outfit.name}
                      />
                    </div>
                    <div className="p-3.5 space-y-1">
                      <span className="px-2 py-0.5 rounded-chip text-[10px] bg-[#eae7e0] dark:bg-[#303030] uppercase">
                        {outfit.styleCategory}
                      </span>
                      <p className="text-sm font-display font-bold truncate">{outfit.name}</p>
                      {outfit.description && (
                        <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] line-clamp-2">
                          {outfit.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'myday' && (
            profileStories.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                No active MyDay stories right now.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {profileStories.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onViewStory?.(st.userId)}
                    className="relative aspect-[3/4] rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#171717] text-left cursor-pointer"
                  >
                    <GarmentImage
                      src={st.mediaUrl}
                      mediaId={st.mediaId}
                      alt={st.altText}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent text-[#f5f4f0]">
                      <p className="text-xs font-medium line-clamp-2">{st.caption || st.styleTag || 'MyDay'}</p>
                      <p className="text-[10px] opacity-75 mt-0.5">{formatRelativeTime(st.createdAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'friends' && isOwn && (
            <div className="space-y-3">
              {ownFriendProfiles.length === 0 ? (
                <div className="p-6 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center space-y-2">
                  <Users className="w-7 h-7 mx-auto opacity-60" />
                  <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                    Add friends to unlock Direct Messages and Friends-only fits.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('people')}
                    className="px-4 py-2 rounded-control bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-bold cursor-pointer"
                  >
                    Find People
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ownFriendProfiles.map((f) => (
                    <div
                      key={f.uid}
                      className="p-3.5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProfile(f.uid)}
                        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        <AvatarImage src={f.photoURL} name={f.displayName} sizeClass="w-10 h-10" textSizeClass="text-xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{f.displayName}</p>
                          <p className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">@{f.username}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        {onMessageUser && (
                          <button
                            type="button"
                            onClick={() => onMessageUser(f)}
                            aria-label={`Message ${f.displayName}`}
                            className="w-9 h-9 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeOrCancelFriend(f.uid)}
                          aria-label={`Remove ${f.displayName}`}
                          className="w-9 h-9 rounded-control border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
