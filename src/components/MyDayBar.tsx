import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { MyDayStory } from '../types';
import { AvatarImage } from './AvatarImage';

export interface MyDayUserGroup {
  userId: string;
  authorName: string;
  authorUsername: string;
  authorPhotoUrl?: string;
  stories: MyDayStory[];
  hasUnviewed: boolean;
  latestAt: number;
}

interface MyDayBarProps {
  onOpenCreateMyDay: () => void;
  onOpenViewer: (groups: MyDayUserGroup[], initialUserId: string) => void;
}

export const MyDayBar: React.FC<MyDayBarProps> = ({
  onOpenCreateMyDay,
  onOpenViewer,
}) => {
  const { userProfile } = useAuth();
  const { storiesForFeed, viewedStoryIds } = useSocial();

  const { ownGroup, otherGroups, allGroups } = useMemo(() => {
    const byUser = new Map<string, MyDayUserGroup>();

    storiesForFeed.forEach((story) => {
      const existing = byUser.get(story.userId);
      const ts = new Date(story.createdAt).getTime();
      const isOwn = story.userId === userProfile?.uid;
      const isUnviewed = !isOwn && !viewedStoryIds.has(story.id);

      if (existing) {
        existing.stories.push(story);
        if (isUnviewed) existing.hasUnviewed = true;
        if (ts > existing.latestAt) existing.latestAt = ts;
      } else {
        byUser.set(story.userId, {
          userId: story.userId,
          authorName: story.authorName,
          authorUsername: story.authorUsername,
          authorPhotoUrl: story.authorPhotoUrl,
          stories: [story],
          hasUnviewed: isUnviewed,
          latestAt: ts,
        });
      }
    });

    const own = userProfile ? byUser.get(userProfile.uid) || null : null;
    if (own) {
      own.stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const others = Array.from(byUser.values())
      .filter((g) => g.userId !== userProfile?.uid)
      .map((g) => ({
        ...g,
        stories: [...g.stories].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      }))
      .sort((a, b) => {
        if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
        return b.latestAt - a.latestAt;
      });

    const ordered = own ? [own, ...others] : others;
    return { ownGroup: own, otherGroups: others, allGroups: ordered };
  }, [storiesForFeed, viewedStoryIds, userProfile]);

  if (!userProfile) return null;

  return (
    <section
      aria-label="MyDay 24-hour style stories"
      className="bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] rounded-card p-3.5"
    >
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#171717] dark:text-[#e5e1da]">
            MyDay
          </span>
          <span className="text-[11px] text-[#4e4c46] dark:text-[#b0b0b0]">
            24h style moments
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenCreateMyDay}
          className="text-xs font-semibold text-[#171717] dark:text-[#e5e1da] hover:underline cursor-pointer min-h-[32px] px-1.5"
        >
          + Add MyDay
        </button>
      </div>

      <div className="flex items-start gap-3.5 overflow-x-auto pb-1">
        {/* Own MyDay Circle */}
        <div className="flex flex-col items-center shrink-0 w-[68px]">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                ownGroup
                  ? onOpenViewer(allGroups, userProfile.uid)
                  : onOpenCreateMyDay()
              }
              aria-label={ownGroup ? 'View your MyDay' : 'Add to your MyDay'}
              className={`w-14 h-14 min-w-[44px] min-h-[44px] rounded-full p-[2px] flex items-center justify-center transition-transform hover:scale-[1.03] cursor-pointer ${
                ownGroup
                  ? 'ring-2 ring-[#171717] dark:ring-[#e5e1da] ring-offset-2 ring-offset-white dark:ring-offset-[#242424]'
                  : 'border border-dashed border-[#a5a5a5]'
              }`}
            >
              <AvatarImage
                src={userProfile.photoURL}
                mediaId={userProfile.mediaId}
                name={userProfile.displayName}
                sizeClass="w-full h-full"
                textSizeClass="text-sm"
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateMyDay();
              }}
              aria-label="Create new MyDay"
              title="Add to MyDay"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] border-2 border-white dark:border-[#242424] flex items-center justify-center shadow-sm cursor-pointer hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="mt-1.5 text-[11px] font-medium text-[#171717] dark:text-[#e5e1da] truncate max-w-full">
            Your MyDay
          </span>
        </div>

        {/* Other Users' MyDay Circles */}
        {otherGroups.map((group) => (
          <div key={group.userId} className="flex flex-col items-center shrink-0 w-[68px]">
            <button
              type="button"
              onClick={() => onOpenViewer(allGroups, group.userId)}
              aria-label={`View ${group.authorName}'s MyDay`}
              className={`w-14 h-14 min-w-[44px] min-h-[44px] rounded-full p-[2px] flex items-center justify-center transition-transform hover:scale-[1.03] cursor-pointer ${
                group.hasUnviewed
                  ? 'ring-2 ring-[#171717] dark:ring-[#e5e1da] ring-offset-2 ring-offset-white dark:ring-offset-[#242424]'
                  : 'ring-1 ring-[#d4cfc5] dark:ring-[#404040] opacity-70 hover:opacity-100'
              }`}
            >
              <AvatarImage
                src={group.authorPhotoUrl}
                name={group.authorName}
                sizeClass="w-full h-full"
                textSizeClass="text-sm"
              />
            </button>
            <span
              className={`mt-1.5 text-[11px] truncate max-w-full ${
                group.hasUnviewed
                  ? 'font-semibold text-[#171717] dark:text-[#e5e1da]'
                  : 'font-normal text-[#4e4c46] dark:text-[#b0b0b0]'
              }`}
            >
              {group.authorUsername}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
