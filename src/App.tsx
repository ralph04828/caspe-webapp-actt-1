import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WardrobeProvider } from './context/WardrobeContext';
import { SocialContextProvider } from './context/SocialContext';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { HomeFeedPage } from './components/HomeFeedPage';
import { ExplorePage } from './components/ExplorePage';
import { WardrobePage } from './components/WardrobePage';
import { FitBuilderPage } from './components/FitBuilderPage';
import { LookbookPage } from './components/LookbookPage';
import { WishlistPage } from './components/WishlistPage';
import { PlannerPage } from './components/PlannerPage';
import { SwoooshAIPage } from './components/SwoooshAIPage';
import { NotificationsPage } from './components/NotificationsPage';
import { ProfilePage } from './components/ProfilePage';
import { SettingsPage } from './components/SettingsPage';
import { CreatePostModal } from './components/CreatePostModal';
import { SharedLookbookView } from './components/SharedLookbookView';
import { ClothingItem, NavSection, Outfit, SocialPost } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const MainShell: React.FC = () => {
  const { userProfile, loading } = useAuth();

  const [shareToken, setShareToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('share');
  });

  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAddClothing, setOpenAddClothing] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [remixPost, setRemixPost] = useState<SocialPost | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createInitialOutfitId, setCreateInitialOutfitId] = useState<string | undefined>();
  const [createInitialItemId, setCreateInitialItemId] = useState<string | undefined>();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3600);
  };

  if (shareToken) {
    return (
      <SharedLookbookView
        token={shareToken}
        onExitShareView={() => {
          setShareToken(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex flex-col items-center justify-center p-6">
        <span className="font-display text-3xl font-extrabold tracking-tight uppercase">
          SWOOOSH
        </span>
        <span className="text-xs tracking-[0.2em] uppercase text-[#4e4c46] dark:text-[#c2bfb8] mt-2">
          PLAN. ORGANIZE. WEAR. · SHARE YOUR FIT.
        </span>
      </div>
    );
  }

  if (!userProfile) {
    return <AuthPage />;
  }

  const handleOpenProfile = (uid: string) => {
    setViewingUserId(uid === userProfile.uid ? null : uid);
    setActiveSection('profile');
  };

  const handleEditInBuilder = (outfit: Outfit) => {
    setRemixPost(null);
    setEditingOutfit(outfit);
    setActiveSection('builder');
  };

  const handleRemixPost = (post: SocialPost) => {
    setEditingOutfit(null);
    setRemixPost(post);
    setActiveSection('builder');
  };

  const handleShareOutfitToFeed = (outfit: Outfit) => {
    setCreateInitialItemId(undefined);
    setCreateInitialOutfitId(outfit.id);
    setCreatePostOpen(true);
  };

  const handleSharePieceToFeed = (item: ClothingItem) => {
    setCreateInitialOutfitId(undefined);
    setCreateInitialItemId(item.id);
    setCreatePostOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          if (sec === 'profile') setViewingUserId(null);
          setActiveSection(sec);
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenCreatePost={() => {
          setCreateInitialOutfitId(undefined);
          setCreateInitialItemId(undefined);
          setCreatePostOpen(true);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main
          id="main-content"
          className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-10 max-w-[1400px] w-full mx-auto"
        >
          {activeSection === 'home' && (
            <HomeFeedPage
              onNavigate={setActiveSection}
              onOpenCreatePost={() => {
                setCreateInitialOutfitId(undefined);
                setCreateInitialItemId(undefined);
                setCreatePostOpen(true);
              }}
              onOpenProfile={handleOpenProfile}
              onRemixPost={handleRemixPost}
              onToast={showToast}
            />
          )}

          {activeSection === 'explore' && (
            <ExplorePage
              onOpenProfile={handleOpenProfile}
              onRemixPost={handleRemixPost}
              onToast={showToast}
            />
          )}

          {activeSection === 'wardrobe' && (
            <WardrobePage
              openAddModalOnMount={openAddClothing}
              onConsumedOpenAdd={() => setOpenAddClothing(false)}
              onSharePiece={handleSharePieceToFeed}
              onToast={showToast}
            />
          )}

          {activeSection === 'builder' && (
            <FitBuilderPage
              editingOutfit={editingOutfit}
              remixSourcePost={remixPost}
              onClearEditingOutfit={() => setEditingOutfit(null)}
              onClearRemixSource={() => setRemixPost(null)}
              onNavigate={setActiveSection}
              onToast={showToast}
            />
          )}

          {activeSection === 'lookbook' && (
            <LookbookPage
              onNavigate={setActiveSection}
              onEditInBuilder={handleEditInBuilder}
              onShareOutfitToFeed={handleShareOutfitToFeed}
              onToast={showToast}
            />
          )}

          {activeSection === 'wishlist' && <WishlistPage onToast={showToast} />}

          {activeSection === 'planner' && (
            <PlannerPage onNavigate={setActiveSection} onToast={showToast} />
          )}

          {activeSection === 'ai' && (
            <SwoooshAIPage onNavigate={setActiveSection} onToast={showToast} />
          )}

          {activeSection === 'notifications' && (
            <NotificationsPage onOpenProfile={handleOpenProfile} onToast={showToast} />
          )}

          {activeSection === 'profile' && (
            <ProfilePage
              viewingUserId={viewingUserId}
              onBackToOwn={() => setViewingUserId(null)}
              onOpenProfile={handleOpenProfile}
              onNavigate={setActiveSection}
              onRemixPost={handleRemixPost}
              onToast={showToast}
            />
          )}

          {activeSection === 'settings' && <SettingsPage onToast={showToast} />}
        </main>
      </div>

      <CreatePostModal
        open={createPostOpen}
        initialOutfitId={createInitialOutfitId}
        initialItemId={createInitialItemId}
        onClose={() => setCreatePostOpen(false)}
        onPublished={(msg) => showToast(msg)}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 lg:bottom-5 right-5 z-50 px-4 py-3 rounded-control border text-xs font-medium flex items-center gap-2.5 shadow-xl ${
            toast.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-700'
              : 'bg-[#171717] text-[#e5e1da] dark:bg-[#e5e1da] dark:text-[#171717] border-[#404040]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WardrobeProvider>
          <SocialContextProvider>
            <MainShell />
          </SocialContextProvider>
        </WardrobeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
