import React from 'react';
import { NavSection } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { Menu, Sun, Moon, RotateCcw, WifiOff, MessageCircle, Plus, Users, Bell } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderBarProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onNavigate?: (section: NavSection) => void;
  onOpenCreatePost?: () => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  home: 'Home Feed',
  ootd: 'OOTD Spotlight',
  people: 'People',
  messages: 'Messages',
  explore: 'Explore',
  wardrobe: 'My Wardrobe',
  builder: 'Fit Builder',
  lookbook: 'My Lookbook',
  wishlist: 'Wishlist',
  planner: 'Outfit Planner',
  notifications: 'Notifications',
  profile: 'Profile & Style Stats',
  settings: 'Settings',
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeSection,
  onOpenMobileMenu,
  onNavigate,
  onOpenCreatePost,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, updateAccountProfile } = useAuth();
  const { resetDemoData, isOnline } = useWardrobe();
  const { unreadMessagesCount, unreadNotificationsCount, incomingFriendRequests } = useSocial();

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    toggleTheme();
    updateAccountProfile({ theme: next }).catch(() => {});
  };

  return (
    <header className="sticky top-0 z-30 mica-surface border-b border-[#d4cfc5] dark:border-[#404040] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-xs text-[#4e4c46] dark:text-[#c2bfb8] whitespace-nowrap truncate">
          <span className="font-display font-extrabold tracking-wider uppercase text-[#171717] dark:text-[#e5e1da]">
            SWOOOSH
          </span>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-[#171717] dark:text-[#e5e1da] truncate">
            {SECTION_LABELS[activeSection]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-chip bg-amber-950/90 text-amber-100 border border-amber-700 text-[11px] font-medium"
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Offline — changes sync when online</span>
            <span className="sm:hidden">Offline</span>
          </div>
        )}

        {isDemoMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-chip bg-[#303030] text-[#e5e1da] dark:bg-[#555555] text-[11px] font-mono-num tracking-wider uppercase">
            <span>DEMO</span>
            <button
              type="button"
              onClick={resetDemoData}
              title="Reset demo sample data"
              className="hover:opacity-75 flex items-center gap-1 underline underline-offset-2 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        )}

        {onOpenCreatePost && (
          <button
            type="button"
            onClick={onOpenCreatePost}
            aria-label="Create post"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer min-h-[40px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        )}

        {onNavigate && (
          <>
            <button
              type="button"
              onClick={() => onNavigate('people')}
              aria-label="Open People and friend requests"
              className={`lg:hidden relative min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-control border text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeSection === 'people'
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
              }`}
            >
              <Users className="w-4 h-4" />
              {incomingFriendRequests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-red-600 text-white leading-none">
                  {incomingFriendRequests.length > 99 ? '99+' : incomingFriendRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              aria-label="Open Notifications"
              className={`lg:hidden relative min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-control border text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                activeSection === 'notifications'
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-red-600 text-white leading-none">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('messages')}
              aria-label="Open messages"
              className={`hidden lg:flex relative min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-control border text-xs font-medium items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeSection === 'messages'
                  ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-transparent'
                  : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-red-600 text-white leading-none">
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </span>
              )}
            </button>
          </>
        )}

        <PWAInstallButton compact />

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label="Toggle dark and light mode"
          className="flex items-center gap-2 px-3 py-2 rounded-control text-xs font-medium border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
