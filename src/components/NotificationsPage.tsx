import React from 'react';
import { useSocial } from '../context/SocialContext';
import { formatRelativeTime } from '../utils/formatters';
import { AvatarImage } from './AvatarImage';
import {
  Bell,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Repeat,
  UserPlus,
  AtSign,
  X,
} from 'lucide-react';

interface NotificationsPageProps {
  onOpenProfile: (userId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onOpenProfile,
  onToast,
}) => {
  const {
    notifications,
    incomingFollows,
    unreadNotificationsCount,
    markNotifRead,
    markAllNotifsRead,
    approveFollowRequest,
    declineFollowRequest,
  } = useSocial();

  const pendingRequests = incomingFollows.filter((f) => f.status === 'pending');

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return Heart;
      case 'comment':
        return MessageCircle;
      case 'remix':
        return Repeat;
      case 'mention':
        return AtSign;
      default:
        return UserPlus;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            Likes, comments, remixes, mentions, and follow requests.
          </p>
        </div>

        {unreadNotificationsCount > 0 && (
          <button
            type="button"
            onClick={markAllNotifsRead}
            className="px-3.5 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

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
                    className="px-3 py-1.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
                    className="p-1.5 rounded-full border border-[#d4cfc5] dark:border-[#404040] cursor-pointer"
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
            return (
              <div
                key={n.id}
                onClick={() => !n.read && markNotifRead(n.id)}
                className={`p-4 flex items-start justify-between gap-3 transition-colors ${
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
                          onOpenProfile(n.actorId);
                        }}
                        className="font-semibold hover:underline cursor-pointer mr-1"
                      >
                        @{n.actorUsername}
                      </button>
                      <span>{n.targetPreview || n.type}</span>
                    </p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                </div>
                {!n.read && (
                  <span
                    aria-label="Unread"
                    className="w-2.5 h-2.5 rounded-full bg-[#171717] dark:bg-[#e5e1da] shrink-0 mt-1.5"
                  />
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
