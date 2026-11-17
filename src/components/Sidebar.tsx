import React from 'react';
import { NavSection } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Shirt,
  Layers,
  BookOpen,
  Heart,
  CalendarDays,
  Sparkles,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'wardrobe', label: 'My Wardrobe', icon: Shirt },
  { id: 'builder', label: 'Fit Builder', icon: Layers },
  { id: 'lookbook', label: 'My Lookbook', icon: BookOpen },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'planner', label: 'Outfit Planner', icon: CalendarDays },
  { id: 'ai', label: 'SWOOOSH AI', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
}) => {
  const { userProfile, isDemoMode, signOutUser } = useAuth();

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const initial = (userProfile?.displayName || userProfile?.email || 'S').charAt(0).toUpperCase();

  const content = (
    <div className="flex flex-col justify-between h-full bg-[#eae7e0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] border-r border-[#d8d4ca] dark:border-[#404040] w-64 select-none">
      {/* Top Logo & Navigation */}
      <div className="p-5 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
          <div>
            <span className="font-display text-2xl font-extrabold tracking-tight uppercase block leading-none">
              SWOOOSH
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-[#5c5a54] dark:text-[#b0b0b0] mt-1.5 block">
              PLAN. ORGANIZE. WEAR.
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                    : 'text-[#5c5a54] dark:text-[#b0b0b0] hover:bg-white/60 dark:hover:bg-[#303030] hover:text-[#171717] dark:hover:text-[#e5e1da]'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {isActive && (
                  <span className="text-[10px] font-mono-num uppercase tracking-wider opacity-75">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile & Sign Out */}
      <div className="p-4 border-t border-[#d8d4ca] dark:border-[#404040] bg-white/40 dark:bg-[#303030]/40 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          {userProfile?.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={userProfile.displayName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 object-cover border border-[#d8d4ca] dark:border-[#404040] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-display font-bold text-sm flex items-center justify-center shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {userProfile?.displayName || 'SWOOOSH Member'}
            </p>
            <p className="text-[11px] text-[#5c5a54] dark:text-[#b0b0b0] truncate">
              {isDemoMode ? 'DEMO MODE' : userProfile?.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOutUser}
          className="w-full py-2 px-3 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
