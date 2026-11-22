import React, { useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { AvatarImage } from './AvatarImage';
import { isUserRecentlyOnline } from '../utils/formatters';
import {
  Check,
  Clock,
  MessageSquare,
  RefreshCw,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

interface PeoplePageProps {
  onOpenProfile: (userId: string) => void;
  onMessageUser: (target: UserProfile) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PeoplePage: React.FC<PeoplePageProps> = ({
  onOpenProfile,
  onMessageUser,
  onToast,
}) => {
  const { userProfile } = useAuth();
  const {
    discoverProfiles,
    incomingFriendRequests,
    outgoingFriendRequests,
    friendIds,
    getFriendshipState,
    sendFriendRequest,
    acceptFriendRequest,
    removeOrCancelFriend,
    isFollowing,
    toggleFollow,
    isBlocked,
    refreshFeedAndProfiles,
  } = useSocial();

  const [queryText, setQueryText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const others = useMemo(
    () =>
      discoverProfiles.filter(
        (p) => p.uid !== userProfile?.uid && !isBlocked(p.uid)
      ),
    [discoverProfiles, userProfile?.uid, isBlocked]
  );

  const searchResults = useMemo(() => {
    const q = queryText.trim().toLowerCase().replace(/^@/, '');
    if (!q) return others;
    return others.filter(
      (p) =>
        p.usernameLower.includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        (p.bio || '').toLowerCase().includes(q) ||
        (p.styleTags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [others, queryText]);

  const friendsProfiles = useMemo(
    () => others.filter((p) => friendIds.includes(p.uid)),
    [others, friendIds]
  );

  const suggestedPeople = useMemo(() => {
    const myTags = new Set(userProfile?.styleTags || []);
    return [...others]
      .filter((p) => !friendIds.includes(p.uid))
      .sort((a, b) => {
        const aScore = (a.styleTags || []).filter((t) => myTags.has(t)).length;
        const bScore = (b.styleTags || []).filter((t) => myTags.has(t)).length;
        return bScore - aScore;
      })
      .slice(0, 6);
  }, [others, friendIds, userProfile?.styleTags]);

  const newMembers = useMemo(
    () =>
      [...others]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    [others]
  );

  const renderPersonCard = (person: UserProfile) => {
    const fState = getFriendshipState(person.uid);
    const followState = isFollowing(person.uid);
    const online = person.showOnlineStatus !== false && isUserRecentlyOnline(person.onlineStatus, person.lastSeenAt);

    return (
      <div
        key={person.uid}
        className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex flex-col justify-between gap-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile(person.uid)}
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
          >
            <div className="relative shrink-0">
              <AvatarImage
                src={person.photoURL}
                mediaId={person.mediaId}
                name={person.displayName || person.username}
                sizeClass="w-12 h-12"
                textSizeClass="text-sm"
              />
              {online && (
                <span
                  title="Online now"
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#242424]"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate hover:underline">{person.displayName}</p>
              <p className="text-xs font-mono-num text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                @{person.username}
              </p>
              {person.bio && (
                <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] line-clamp-1 mt-0.5">
                  {person.bio}
                </p>
              )}
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {fState === 'friends' ? (
            <>
              <button
                type="button"
                onClick={() => onMessageUser(person)}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await removeOrCancelFriend(person.uid);
                  onToast(`Removed @${person.username} from friends.`);
                }}
                aria-label={`Remove ${person.username} from friends`}
                title="Remove friend"
                className="min-h-[40px] px-3 py-2 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-medium flex items-center gap-1 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Friends</span>
              </button>
            </>
          ) : fState === 'outgoing_pending' ? (
            <button
              type="button"
              onClick={async () => {
                await removeOrCancelFriend(person.uid);
                onToast('Friend request cancelled.');
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Requested · Cancel</span>
            </button>
          ) : fState === 'incoming_pending' ? (
            <button
              type="button"
              onClick={async () => {
                const req = incomingFriendRequests.find((r) => r.requesterId === person.uid);
                if (req) {
                  await acceptFriendRequest(req);
                  onToast(`You and @${person.username} are now friends!`);
                }
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Request</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await sendFriendRequest(person);
                onToast(`Friend request sent to @${person.username}.`);
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Friend</span>
            </button>
          )}

          {person.isPublic && fState !== 'friends' && (
            <button
              type="button"
              onClick={() => toggleFollow(person)}
              className="min-h-[40px] px-3 py-2 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
            >
              {followState === 'accepted' ? 'Following' : followState === 'pending' ? 'Requested' : 'Follow'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Find People</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Search SWOOOSH members by @username or name, manage friend requests, and discover style creators.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setRefreshing(true);
            try {
              await refreshFeedAndProfiles();
              onToast('People directory refreshed.');
            } finally {
              setRefreshing(false);
            }
          }}
          className="min-h-[44px] px-4 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#4e4c46] dark:text-[#c2bfb8]" />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search people by @username, name, or style tag..."
          className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
        />
      </div>

      {/* Incoming Friend Requests Inbox */}
      {incomingFriendRequests.length > 0 && (
        <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <h2 className="font-display font-bold text-sm uppercase tracking-wider">
              Friend Requests ({incomingFriendRequests.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(req.requesterId)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <AvatarImage
                    src={req.requesterPhotoUrl}
                    name={req.requesterName || req.requesterUsername}
                    sizeClass="w-10 h-10"
                    textSizeClass="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{req.requesterName}</p>
                    <p className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      @{req.requesterUsername}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await acceptFriendRequest(req);
                      onToast(`Accepted @${req.requesterUsername}'s friend request!`);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await removeOrCancelFriend(req);
                      onToast('Friend request declined.');
                    }}
                    aria-label="Decline friend request"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sent Requests */}
      {outgoingFriendRequests.length > 0 && !queryText.trim() && (
        <section className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            Sent Friend Requests ({outgoingFriendRequests.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {outgoingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="px-3 py-1.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] flex items-center gap-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(req.recipientId)}
                  className="font-semibold hover:underline cursor-pointer"
                >
                  @{req.recipientUsername}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await removeOrCancelFriend(req);
                    onToast('Cancelled friend request.');
                  }}
                  aria-label="Cancel sent friend request"
                  className="text-[#4e4c46] dark:text-[#c2bfb8] hover:text-red-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search Results Mode */}
      {queryText.trim() ? (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">
            Search Results ({searchResults.length})
          </h2>
          {searchResults.length === 0 ? (
            <div className="p-8 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-center text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              No members found matching &ldquo;{queryText}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map(renderPersonCard)}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Friends List */}
          {friendsProfiles.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <h2 className="font-display font-bold text-base uppercase tracking-wider">
                  Your Friends ({friendsProfiles.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {friendsProfiles.map(renderPersonCard)}
              </div>
            </section>
          )}

          {/* Suggested People */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base uppercase tracking-wider">
              Suggested People
            </h2>
            {suggestedPeople.length === 0 ? (
              <div className="p-6 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                No new suggestions right now — share your invite link from Settings to invite friends!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestedPeople.map(renderPersonCard)}
              </div>
            )}
          </section>

          {/* New Members */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-base uppercase tracking-wider">
              New Members
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {newMembers.map(renderPersonCard)}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
