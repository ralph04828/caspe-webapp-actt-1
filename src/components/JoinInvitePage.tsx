import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HERO_EDITORIAL_IMG } from '../data/demoData';
import { ArrowRight, Compass, Moon, ShieldCheck, Sun, Users, Shirt, MessageSquare } from 'lucide-react';

interface JoinInvitePageProps {
  inviterUsername: string;
  onContinueToEmailAuth: () => void;
}

export const JoinInvitePage: React.FC<JoinInvitePageProps> = ({
  inviterUsername,
  onContinueToEmailAuth,
}) => {
  const { signInWithGoogle, enterDemoMode, error } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex flex-col">
      <header className="w-full px-6 md:px-10 py-4 flex items-center justify-between border-b border-[#d4cfc5] dark:border-[#404040] mica-surface">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-extrabold tracking-tight uppercase">
            SWOOOSH
          </span>
          <span className="hidden sm:inline text-xs tracking-[0.18em] uppercase text-[#4e4c46] dark:text-[#c2bfb8]">
            PLAN. ORGANIZE. WEAR. · SHARE YOUR FIT.
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark and light mode"
          className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-control text-xs font-medium border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-mono-num uppercase tracking-wider">
            Invited by @{inviterUsername}
          </span>

          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.06] text-balance">
            Join SWOOOSH and share your fits.
          </h1>

          <p className="text-sm text-[#4e4c46] dark:text-[#c2bfb8] leading-relaxed">
            SWOOOSH is a fashion social network: share your fits, build your digital wardrobe, plan your outfits, post 24h MyDay stories, and chat with friends. Zero ads, zero prices, zero shopping clutter.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="p-3 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-1">
              <Shirt className="w-4 h-4" />
              <p className="font-semibold">Digital Wardrobe</p>
              <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                Organize clothes, lookbooks &amp; private plans.
              </p>
            </div>
            <div className="p-3 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-1">
              <Users className="w-4 h-4" />
              <p className="font-semibold">MyDay &amp; OOTD</p>
              <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                Share daily looks &amp; 24-hour style stories.
              </p>
            </div>
            <div className="p-3 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-1">
              <MessageSquare className="w-4 h-4" />
              <p className="font-semibold">Friends &amp; Groups</p>
              <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                Real-time DMs and style group chats.
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="min-h-[44px] px-6 py-3 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-semibold flex items-center justify-center gap-2.5 hover:opacity-90 cursor-pointer"
            >
              <span className="font-display font-extrabold text-base">G</span>
              <span>Sign in with Google</span>
            </button>

            <button
              type="button"
              onClick={onContinueToEmailAuth}
              className="min-h-[44px] px-5 py-3 rounded-full border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
            >
              <span>Use Email / Sign Up</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={enterDemoMode}
              className="min-h-[44px] px-5 py-3 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-[#242424] cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Preview Demo</span>
            </button>
          </div>

          <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>After signing in, you&rsquo;ll find @{inviterUsername} ready to add as a friend.</span>
          </p>
        </div>

        <div className="lg:col-span-6">
          <div className="aspect-[4/5] rounded-modal overflow-hidden border border-[#d4cfc5] dark:border-[#404040] shadow-2xl bg-[#171717]">
            <img
              src={HERO_EDITORIAL_IMG}
              alt="SWOOOSH community streetwear editorial"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover grayscale contrast-110"
            />
          </div>
        </div>
      </main>
    </div>
  );
};
