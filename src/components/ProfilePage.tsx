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
import { resolveDisplayAspectRatio } from '../utils/aspectRatio';
import { getOutfitAccessoryIds, getOutfitTopIds, getTopLayerLabels } from '../utils/outfitLayers';
import { dedupeStyleTags } from '../utils/styleTags';
import { AvatarImage } from './AvatarImage';
import { GarmentImage } from './GarmentImage';
import { MediaGridTiles } from './MediaGridTiles';
import { OutfitCollageThumb } from './OutfitCollageThumb';
import { PostFeedViewerModal } from './PostFeedViewerModal';
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
  X,
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
  const [naturalDimsById, setNaturalDimsById] = useState<Record<string, { width: number; height: number }>>({});
  const [tab, setTab] = useState<'posts' | 'wardrobe' | 'lookbook' | 'myday' | 'friends' | 'stats' | 'saved'>('posts');
  const [viewerPosts, setViewerPosts] = useState<{
    posts: SocialPost[];
    initialId: string;
    title: string;
  } | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<ClothingItem | null>(null);
  const [selectedOutfitDetail, setSelectedOutfitDetail] = useState<Outfit | null>(null);

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
            <MediaGridTiles
              posts={profilePosts}
              onSelectPost={(post) =>
                setViewerPosts({
                  posts: profilePosts,
                  initialId: post.id,
                  title: isOwn ? 'My Posts' : `@${targetProfile.username}'s Posts`,
                })
              }
              emptyTitle="No shared fits yet."
              emptyDescription="Fits posted from OOTD, Lookbook, or Feed will show up here."
            />
          )}

          {tab === 'wardrobe' && (
            profileWardrobe.length === 0 ? (
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                No visible wardrobe items yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
                {profileWardrobe.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedGarment(item)}
                    className="group relative aspect-square rounded-sm sm:rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#1e1e1e] overflow-hidden text-left cursor-pointer"
                  >
                    <GarmentImage
                      src={item.thumbUrl || item.imageUrl}
                      mediaId={item.mediaId}
                      alt={item.altText || item.name}
                      isCutout={item.isCutout}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    {isOwn && item.visibility === 'private' && (
                      <span
                        aria-label="Private item"
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/65 text-white flex items-center justify-center"
                      >
                        <Lock className="w-2.5 h-2.5" />
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-[#f5f4f0]">
                      <p className="text-[11px] sm:text-xs font-semibold truncate">{item.name}</p>
                      <p className="hidden sm:block text-[10px] opacity-85 truncate">
                        {item.brand} · {item.color}
                      </p>
                    </div>
                  </button>
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
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-3">
                {profileOutfits.map((outfit) => (
                  <button
                    key={outfit.id}
                    type="button"
                    onClick={() => setSelectedOutfitDetail(outfit)}
                    className="group relative aspect-square rounded-sm sm:rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#eae7e0] dark:bg-[#1e1e1e] overflow-hidden text-left cursor-pointer"
                  >
                    <OutfitCollageThumb
                      outfit={outfit}
                      wardrobe={profileWardrobe}
                      hidePrivateDetails={!isOwn}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-[#f5f4f0]">
                      <p className="text-[11px] sm:text-xs font-display font-bold truncate">
                        {outfit.name}
                      </p>
                      <p className="hidden sm:block text-[10px] opacity-85 uppercase truncate">
                        {outfit.styleCategory}
                      </p>
                    </div>
                  </button>
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
              <div className="columns-2 sm:columns-3 md:columns-4 gap-3.5 space-y-3.5">
                {profileStories.map((st) => {
                  const nat = naturalDimsById[st.id];
                  const stAspect = resolveDisplayAspectRatio({
                    aspectRatio: st.aspectRatio,
                    width: st.width,
                    height: st.height,
                    naturalWidth: nat?.width,
                    naturalHeight: nat?.height,
                    fallbackRatio: 3 / 4,
                    maxHeightCss: '80vh',
                  });
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onViewStory?.(st.userId)}
                      style={stAspect.frameStyle}
                      className="break-inside-avoid block w-full mx-auto relative rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#171717] text-left cursor-pointer"
                    >
                      <GarmentImage
                        src={st.mediaUrl}
                        mediaId={st.mediaId}
                        alt={st.altText}
                        className="w-full h-full object-cover"
                        onImageLoad={(dims) => {
                          setNaturalDimsById((prev) =>
                            prev[st.id]
                              ? prev
                              : { ...prev, [st.id]: { width: dims.naturalWidth, height: dims.naturalHeight } }
                          );
                        }}
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent text-[#f5f4f0]">
                        <p className="text-xs font-medium line-clamp-2">{st.caption || st.styleTag || 'MyDay'}</p>
                        <p className="text-[10px] opacity-75 mt-0.5">{formatRelativeTime(st.createdAt)}</p>
                      </div>
                    </button>
                  );
                })}
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
            <MediaGridTiles
              posts={savedPosts}
              onSelectPost={(post) =>
                setViewerPosts({
                  posts: savedPosts,
                  initialId: post.id,
                  title: 'Saved Fits',
                })
              }
              emptyTitle="No saved fits yet"
              emptyDescription="Saved fits from your feed will appear here privately."
            />
          )}
        </>
      )}

      <PostFeedViewerModal
        open={Boolean(viewerPosts)}
        posts={viewerPosts?.posts || []}
        initialPostId={viewerPosts?.initialId || null}
        title={viewerPosts?.title}
        onClose={() => setViewerPosts(null)}
        onOpenProfile={onOpenProfile}
        onRemixPost={onRemixPost}
        onToast={onToast}
      />

      {/* Garment Detail Modal */}
      {selectedGarment && (
        <div
          className="fixed inset-0 z-[74] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedGarment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#242424] shadow-2xl overflow-hidden"
          >
            <div className="relative aspect-square bg-[#eae7e0] dark:bg-[#171717]">
              <GarmentImage
                src={selectedGarment.imageUrl || selectedGarment.thumbUrl}
                mediaId={selectedGarment.mediaId}
                alt={selectedGarment.altText || selectedGarment.name}
                isCutout={selectedGarment.isCutout}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setSelectedGarment(null)}
                aria-label="Close garment detail"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                  {selectedGarment.category}
                </span>
                <h3 className="font-display text-lg font-bold">{selectedGarment.name}</h3>
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                  {selectedGarment.brand} · {selectedGarment.color} · Size{' '}
                  {selectedGarment.sizeSystem &&
                  ['US', 'EU', 'UK', 'CM'].includes(selectedGarment.sizeSystem)
                    ? `${selectedGarment.sizeSystem} ${selectedGarment.size}`
                    : selectedGarment.size}
                </p>
              </div>
              {dedupeStyleTags(selectedGarment.styleTags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dedupeStyleTags(selectedGarment.styleTags || []).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-chip text-[11px] bg-[#eae7e0] dark:bg-[#303030]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {selectedGarment.description && (
                <p className="text-xs leading-relaxed text-[#4e4c46] dark:text-[#c2bfb8]">
                  {selectedGarment.description}
                </p>
              )}
              {isOwn && (
                <p className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8] pt-1 border-t border-[#d4cfc5] dark:border-[#404040]">
                  Laundry: {selectedGarment.laundryStatus} · Worn {selectedGarment.wearCount} times
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Outfit Detail Modal */}
      {selectedOutfitDetail && (
        <div
          className="fixed inset-0 z-[74] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedOutfitDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#242424] shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded-chip text-[10px] bg-[#eae7e0] dark:bg-[#303030] uppercase">
                  {selectedOutfitDetail.styleCategory}
                </span>
                <h3 className="font-display text-lg font-bold mt-1">{selectedOutfitDetail.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOutfitDetail(null)}
                aria-label="Close outfit detail"
                className="w-9 h-9 rounded-control flex items-center justify-center border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-square rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040]">
              <OutfitCollageThumb
                outfit={selectedOutfitDetail}
                wardrobe={profileWardrobe}
                hidePrivateDetails={!isOwn}
              />
            </div>

            {selectedOutfitDetail.description && (
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                {selectedOutfitDetail.description}
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                Pieces
              </p>
              {(() => {
                const topIds = getOutfitTopIds(selectedOutfitDetail);
                const topLabels = getTopLayerLabels(topIds.length);
                const accIds = getOutfitAccessoryIds(selectedOutfitDetail);
                const slots = [
                  ...topIds.map((id, idx) => ({ id, label: topLabels[idx] || 'Top' })),
                  ...(selectedOutfitDetail.bottomId
                    ? [{ id: selectedOutfitDetail.bottomId, label: 'Bottom' }]
                    : []),
                  ...(selectedOutfitDetail.shoesId
                    ? [{ id: selectedOutfitDetail.shoesId, label: 'Shoes' }]
                    : []),
                  ...accIds.map((id, idx) => ({ id, label: `Accessory ${idx + 1}` })),
                ];
                return slots.map(({ id, label }) => {
                  const item = profileWardrobe.find((w) => w.id === id);
                  const snap = selectedOutfitDetail.pieceSnapshots?.find((s) => s.id === id);
                  const hidden = !isOwn && ((item?.visibility === 'private') || snap?.isPrivatePlaceholder);
                  return (
                    <div
                      key={`${label}-${id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-white dark:bg-[#1c1c1c] border border-[#d4cfc5]/70 dark:border-[#404040] text-xs"
                    >
                      <span className="font-semibold text-[#4e4c46] dark:text-[#c2bfb8]">{label}</span>
                      <span className="truncate font-medium">
                        {hidden ? 'Private item' : item?.name || snap?.name || 'Item'}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
