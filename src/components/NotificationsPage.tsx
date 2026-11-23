import React, { useState } from 'react';
import { AppNotification, NavSection, UserProfile } from '../types';
import { useSocial } from '../context/SocialContext';
import { formatRelativeTime } from '../utils/formatters';
import { AvatarImage } from './AvatarImage';
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  MessageSquare,
  Repeat,
  UserPlus,
  AtSign,
  X,
} from 'lucide-react';

interface NotificationsPageProps {
  onOpenProfile: (userId: string) => void;
  onOpenPost?: (
    postId: string,
    options?: { openComments?: boolean; commentId?: string }
  ) => void;
  onOpenConversation?: (conversationId?: string) => void;
  onMessageUser?: (target: UserProfile) => void;
  onNavigate?: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

function getNotificationPhrase(type: AppNotification['type']): string {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented on your post';
    case 'reply':
      return 'replied to your comment';
    case 'friend_request':
      return 'sent you a friend request';
    case 'friend_accept':
    case 'friend_accepted':
      return 'accepted your friend request';
    case 'follow':
      return 'started following you';
    case 'follow_request':
      return 'requested to follow you';
    case 'follow_accept':
      return 'accepted your follow request';
    case 'message':
      return 'sent you a message';
    case 'story_reply':
    case 'myday_reaction':
      return 'replied to your MyDay';
    case 'remix':
      return 'remixed your fit';
    case 'mention':
      return 'mentioned you in a post';
    default:
      return 'interacted with your profile';
  }
}

function getNotificationSnippet(n: AppNotification): string | null {
  if (
    n.type === 'comment' ||
    n.type === 'reply' ||
    n.type === 'mention' ||
    n.type === 'story_reply' ||
    n.type === 'myday_reaction'
  ) {
    const raw = (n.commentSnippet || n.targetPreview || '').trim();
    return raw || null;
  }
  return null;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onOpenProfile,
  onOpenPost,
  onOpenConversation,
  onMessageUser,
  onNavigate,
  onToast,
}) => {
  const {
    notifications,
    discoverProfiles,
    incomingFollows,
    incomingFriendRequests,
    unreadNotificationsCount,
    markNotifRead,
    markAllNotifsRead,
    approveFollowRequest,
    declineFollowRequest,
    acceptFriendRequest,
    removeOrCancelFriend,
  } = useSocial();

  const [acceptedFriends, setAcceptedFriends] = useState<UserProfile[]>([]);

  const pendingRequests = incomingFollows.filter((f) => f.status === 'pending');

  const resolveActorProfile = (n: {
    actorId: string;
    actorUsername: string;
    actorName?: string;
    actorPhotoUrl?: string;
  }): UserProfile => {
    const found = discoverProfiles.find((p) => p.uid === n.actorId);
    if (found) return found;
    return {
      uid: n.actorId,
      email: '',
      username: n.actorUsername,
      usernameLower: (n.actorUsername || '').toLowerCase(),
      displayName: n.actorName || n.actorUsername,
      photoURL: n.actorPhotoUrl,
      bio: '',
      stylePreference: '',
      styleTags: [],
      followersCount: 0,
      followingCount: 0,
      friendsCount: 1,
      postsCount: 0,
      isPublic: true,
      defaultItemVisibility: 'public',
      defaultOutfitVisibility: 'public',
      autoDirtyOnWear: false,
      isAdultConfirmed: true,
      createdAt: new Date().toISOString(),
    };
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return Heart;
      case 'comment':
      case 'reply':
      case 'message':
      case 'story_reply':
      case 'myday_reaction':
        return MessageCircle;
      case 'remix':
        return Repeat;
      case 'mention':
        return AtSign;
      default:
        return UserPlus;
    }
  };

  const handleOpenNotification = (n: AppNotification) => {
    if (!n.read) markNotifRead(n.id);

    if (n.type === 'message' || n.type === 'story_reply' || n.type === 'myday_reaction') {
      if (onOpenConversation) {
        onOpenConversation(n.targetId);
      } else if (onNavigate) {
        onNavigate('messages');
      }
      return;
    }

    if (n.type === 'comment' || n.type === 'reply') {
      if (n.targetId && onOpenPost) {
        onOpenPost(n.targetId, { openComments: true, commentId: n.commentId });
      }
      return;
    }

    if (n.type === 'like' || n.type === 'remix' || n.type === 'mention') {
      if (n.targetId && onOpenPost) {
        onOpenPost(n.targetId, { openComments: n.type === 'mention' });
      }
      return;
    }

    onOpenProfile(n.actorId);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Friend requests, replies, likes, comments, remixes, and mentions.
          </p>
        </div>

        {unreadNotificationsCount > 0 && (
          <button
            type="button"
            onClick={markAllNotifsRead}
            className="px-3.5 py-2 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Pending Friend Requests */}
      {incomingFriendRequests.length > 0 && (
        <section className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            Friend Requests ({incomingFriendRequests.length})
          </h2>
          <div className="space-y-2.5">
            {incomingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(req.requesterId)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <AvatarImage
                    src={req.requesterPhotoUrl}
                    name={req.requesterName || req.requesterUsername}
                    sizeClass="w-9 h-9"
                    textSizeClass="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{req.requesterName}</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      @{req.requesterUsername}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await acceptFriendRequest(req);
                        const profile = resolveActorProfile({
                          actorId: req.requesterId,
                          actorUsername: req.requesterUsername,
                          actorName: req.requesterName,
                          actorPhotoUrl: req.requesterPhotoUrl,
                        });
                        setAcceptedFriends((prev) =>
                          prev.some((p) => p.uid === profile.uid) ? prev : [profile, ...prev]
                        );
                        onToast(`You and @${req.requesterUsername} are now friends!`);
                      } catch (err: any) {
                        onToast(err?.message || 'Could not accept friend request.', 'error');
                      }
                    }}
                    className="px-3 py-1.5 min-h-[38px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
                    className="w-9 h-9 rounded-full border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Newly accepted friends quick message strip */}
      {acceptedFriends.length > 0 && onMessageUser && (
        <section className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            Say hi to your new friend
          </h2>
          <div className="flex flex-wrap gap-2">
            {acceptedFriends.map((friend) => (
              <div
                key={friend.uid}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]"
              >
                <span className="text-xs font-semibold">@{friend.username}</span>
                <button
                  type="button"
                  onClick={() => onMessageUser(friend)}
                  className="px-2.5 py-1 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Message</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Follow Requests */}
      {pendingRequests.length > 0 && (
        <section className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            Follow Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-2.5">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(req.followerId)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <AvatarImage
                    src={req.followerPhotoUrl}
                    name={req.followerName || req.followerUsername}
                    sizeClass="w-9 h-9"
                    textSizeClass="text-xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{req.followerName}</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      @{req.followerUsername}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await approveFollowRequest(req);
                      onToast(`Accepted @${req.followerUsername}.`);
                    }}
                    className="px-3 py-1.5 min-h-[38px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await declineFollowRequest(req);
                      onToast('Follow request declined.');
                    }}
                    aria-label="Decline follow request"
                    className="w-9 h-9 rounded-full border border-[#d4cfc5] dark:border-[#404040] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notification List */}
      <section className="rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] divide-y divide-[#d4cfc5]/70 dark:divide-[#404040]/70 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-7 h-7 mx-auto opacity-50" />
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              You&rsquo;re all caught up. Activity on your fits will appear here.
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const Icon = getIcon(n.type);
            const actionText = getNotificationPhrase(n.type);
            const snippet = getNotificationSnippet(n);
            const isFriendAccepted = n.type === 'friend_accept' || n.type === 'friend_accepted';

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenNotification(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenNotification(n);
                  }
                }}
                className={`p-4 flex items-start justify-between gap-3 transition-colors hover:bg-[#eae7e0]/50 dark:hover:bg-[#303030]/40 cursor-pointer ${
                  !n.read ? 'bg-[#f5f4f0] dark:bg-[#303030]/60' : ''
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative shrink-0 mt-0.5">
                    {n.actorPhotoUrl ? (
                      <AvatarImage
                        src={n.actorPhotoUrl}
                        name={n.actorName || n.actorUsername}
                        sizeClass="w-9 h-9"
                        textSizeClass="text-xs"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#eae7e0] dark:bg-[#303030] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs leading-relaxed">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.read) markNotifRead(n.id);
                          onOpenProfile(n.actorId);
                        }}
                        className="font-semibold hover:underline cursor-pointer mr-1"
                      >
                        @{n.actorUsername}
                      </button>
                      <span>{actionText}</span>
                    </p>
                    {snippet && (
                      <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] line-clamp-2">
                        &ldquo;{snippet}&rdquo;
                      </p>
                    )}
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isFriendAccepted && onMessageUser && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.read) markNotifRead(n.id);
                        onMessageUser(resolveActorProfile(n));
                      }}
                      className="px-2.5 py-1.5 min-h-[32px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Message</span>
                    </button>
                  )}
                  {!n.read && (
                    <span
                      aria-label="Unread"
                      className="w-2.5 h-2.5 rounded-full bg-[#171717] dark:bg-[#e5e1da] shrink-0"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
