import React from 'react';
import { NavSection } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { AvatarImage } from './AvatarImage';
import {
  Home,
  Compass,
  Shirt,
  Layers,
  BookOpen,
  Heart,
  CalendarDays,
  Sparkles,
  Bell,
  User,
  Settings,
  LogOut,
  X,
  PlusSquare,
} from 'lucide-react';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenCreatePost: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'wardrobe', label: 'My Wardrobe', icon: Shirt },
  { id: 'builder', label: 'Fit Builder', icon: Layers },
  { id: 'lookbook', label: 'My Lookbook', icon: BookOpen },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'planner', label: 'Outfit Planner', icon: CalendarDays },
  { id: 'ai', label: 'SWOOOSH AI', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  onOpenCreatePost,
}) => {
  const { userProfile, isDemoMode, signOutUser } = useAuth();
  const { unreadNotificationsCount } = useSocial();

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const content = (
    <div className="flex flex-col justify-between h-full mica-surface text-[#171717] dark:text-[#e5e1da] border-r border-[#d4cfc5] dark:border-[#404040] w-64 select-none">
      {/* Top Logo & Navigation */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-4 border-b border-[#d4cfc5] dark:border-[#404040]">
          <div>
            <span className="font-display text-2xl font-extrabold tracking-tight uppercase block leading-none">
              SWOOOSH
            </span>
            <span className="text-[10px] tracking-[0.18em] uppercase text-[#4e4c46] dark:text-[#c2bfb8] mt-1.5 block">
              SHARE YOUR FIT.
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 rounded-control text-[#4e4c46] dark:text-[#c2bfb8] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenCreatePost();
          }}
          className="mt-4 w-full py-2.5 px-3.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
        >
          <PlusSquare className="w-4 h-4" />
          <span>Share Fit</span>
        </button>

        <nav className="mt-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const showUnread = item.id === 'notifications' && unreadNotificationsCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-control text-sm font-medium transition-all duration-150 cursor-pointer min-h-[40px] ${
                  isActive
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] shadow-sm'
                    : 'text-[#4e4c46] dark:text-[#c2bfb8] hover:bg-white/70 dark:hover:bg-[#303030] hover:text-[#171717] dark:hover:text-[#e5e1da]'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {showUnread && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold ${
                      isActive
                        ? 'bg-[#f5f4f0] text-[#171717] dark:bg-[#171717] dark:text-[#e5e1da]'
                        : 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    }`}
                  >
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile & Sign Out */}
      <div className="p-4 border-t border-[#d4cfc5] dark:border-[#404040] bg-white/50 dark:bg-[#242424]/70 space-y-3">
        <button
          type="button"
          onClick={() => handleNav('profile')}
          className="w-full flex items-center gap-3 min-w-0 text-left rounded-control p-1 hover:bg-white/60 dark:hover:bg-[#303030] transition-colors cursor-pointer"
        >
          <AvatarImage
            src={userProfile?.photoURL}
            mediaId={userProfile?.mediaId}
            name={userProfile?.displayName || userProfile?.username || 'S'}
            sizeClass="w-9 h-9"
            textSizeClass="text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {userProfile?.displayName || 'SWOOOSH Member'}
            </p>
            <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
              {isDemoMode ? `@${userProfile?.username} · DEMO` : `@${userProfile?.username}`}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={signOutUser}
          className="w-full py-2 px-3 rounded-control text-xs font-medium border border-[#d4cfc5] dark:border-[#404040] hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-20">{content}</aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-2xl">{content}</div>
        </div>
      )}

      {/* Mobile Floating Rounded Bottom Tab Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-40 rounded-modal mica-surface border border-[#d4cfc5] dark:border-[#404040] shadow-xl px-2 py-1.5 flex items-center justify-around"
      >
        {[
          { id: 'home' as NavSection, label: 'Home', Icon: Home },
          { id: 'explore' as NavSection, label: 'Explore', Icon: Compass },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectSection(id)}
            aria-label={label}
            className={`min-w-[44px] min-h-[44px] px-3 rounded-control flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
              activeSection === id
                ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                : 'text-[#4e4c46] dark:text-[#c2bfb8]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onOpenCreatePost}
          aria-label="Create post"
          className="min-w-[48px] min-h-[44px] px-3.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] flex items-center justify-center shadow-md cursor-pointer"
        >
          <PlusSquare className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('notifications')}
          aria-label="Notifications"
          className={`relative min-w-[44px] min-h-[44px] px-3 rounded-control flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
            activeSection === 'notifications'
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
              : 'text-[#4e4c46] dark:text-[#c2bfb8]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alerts</span>
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('profile')}
          aria-label="Profile"
          className={`min-w-[44px] min-h-[44px] px-3 rounded-control flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
            activeSection === 'profile'
              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
              : 'text-[#4e4c46] dark:text-[#c2bfb8]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </nav>
    </>
  );
};
