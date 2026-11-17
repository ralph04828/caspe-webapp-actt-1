import React from 'react';
import { NavSection } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Menu, Sun, Moon, RotateCcw } from 'lucide-react';

interface HeaderBarProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onUpdateThemePreference?: (theme: 'dark' | 'light') => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  overview: 'Overview',
  wardrobe: 'My Wardrobe',
  builder: 'Fit Builder',
  lookbook: 'My Lookbook',
  wishlist: 'Wishlist',
  planner: 'Outfit Planner',
  ai: 'SWOOOSH AI',
  settings: 'Settings',
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeSection,
  onOpenMobileMenu,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isDemoMode, updateAccountProfile } = useAuth();
  const { resetDemoData } = useWardrobe();

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    toggleTheme();
    updateAccountProfile({ theme: next }).catch(() => {
      // Theme is already persisted locally
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-[#f5f4f0]/95 dark:bg-[#171717]/95 backdrop-blur-sm border-b border-[#d8d4ca] dark:border-[#404040] px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 border border-[#d8d4ca] dark:border-[#404040] bg-white dark:bg-[#303030] cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-xs text-[#5c5a54] dark:text-[#b0b0b0] whitespace-nowrap">
          <span className="font-display font-bold tracking-wider uppercase text-[#171717] dark:text-[#e5e1da]">
            SWOOOSH
          </span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[#171717] dark:text-[#e5e1da]">
            {SECTION_LABELS[activeSection]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {isDemoMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#303030] text-[#e5e1da] dark:bg-[#555555] text-[11px] font-mono-num tracking-wider uppercase">
            <span>DEMO MODE</span>
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

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label="Toggle dark and light mode"
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] bg-white dark:bg-[#303030] hover:bg-[#eae7e0] dark:hover:bg-[#404040] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
