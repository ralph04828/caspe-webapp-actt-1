import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WardrobeProvider } from './context/WardrobeContext';
import { SocialContextProvider, useSocial } from './context/SocialContext';
import { AuthPage } from './components/AuthPage';
import { JoinInvitePage } from './components/JoinInvitePage';
import { OnboardingFlow } from './components/OnboardingModal';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { HomeFeedPage } from './components/HomeFeedPage';
import { OotdPage } from './components/OotdPage';
import { PeoplePage } from './components/PeoplePage';
import { MessagesPage } from './components/MessagesPage';
import { ExplorePage } from './components/ExplorePage';
import { WardrobePage } from './components/WardrobePage';
import { FitBuilderPage } from './components/FitBuilderPage';
import { LookbookPage } from './components/LookbookPage';
import { WishlistPage } from './components/WishlistPage';
import { PlannerPage } from './components/PlannerPage';
import { NotificationsPage } from './components/NotificationsPage';
import { ProfilePage } from './components/ProfilePage';
import { SettingsPage } from './components/SettingsPage';
import { CreatePostModal } from './components/CreatePostModal';
import { CreateMyDayModal } from './components/CreateMyDayModal';
import { MyDayViewerModal } from './components/MyDayViewerModal';
import { MyDayUserGroup } from './components/MyDayBar';
import { SharedLookbookView } from './components/SharedLookbookView';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ActiveModalType,
  getDraftSessionKey,
  loadSessionJson,
  loadSessionNavState,
  saveSessionNavState,
} from './utils/draftStorage';
import { ClothingItem, NavSection, Outfit, SocialPost, UserProfile } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const VALID_NAV_SECTIONS: NavSection[] = [
  'home',
  'ootd',
  'people',
  'messages',
  'explore',
  'wardrobe',
  'builder',
  'lookbook',
  'wishlist',
  'planner',
  'notifications',
  'profile',
  'settings',
];

const MainShell: React.FC = () => {
  const { userProfile, loading, needsOnboarding, inviteUsername } = useAuth();
  const { storiesForFeed, startDmWithFriend } = useSocial();

  const [shareToken, setShareToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('share');
  });

  const [showStandardAuth, setShowStandardAuth] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAddClothing, setOpenAddClothing] = useState(false);
  const [wardrobeModalOpen, setWardrobeModalOpen] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null);
  const [remixPost, setRemixPost] = useState<SocialPost | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);

  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createInitialOutfitId, setCreateInitialOutfitId] = useState<string | undefined>();
  const [createInitialItemId, setCreateInitialItemId] = useState<string | undefined>();
  const [plannedShare, setPlannedShare] = useState<{ outfit: Outfit; date: string } | null>(null);

  const [createMyDayOpen, setCreateMyDayOpen] = useState(false);
  const [storyViewerState, setStoryViewerState] = useState<{
    groups: MyDayUserGroup[];
    initialUserId: string;
  } | null>(null);

  const hydratedUidRef = useRef<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4200);
  };

  // Restore last active section / open modal / unsaved draft after mobile camera or tab reload
  useEffect(() => {
    const uid = userProfile?.uid;
    if (!uid) {
      hydratedUidRef.current = null;
      return;
    }
    if (hydratedUidRef.current === uid) return;

    const savedNav = loadSessionNavState(uid);
    const wardrobeDraft = loadSessionJson<any>(getDraftSessionKey('wardrobe', uid));
    const myDayDraft = loadSessionJson<any>(getDraftSessionKey('myday', uid));
    const createPostDraft = loadSessionJson<any>(getDraftSessionKey('create_post', uid));
    const ootdDraft = loadSessionJson<any>(getDraftSessionKey('ootd', uid));

    const hasWardrobeDraft = Boolean(
      wardrobeDraft &&
        !wardrobeDraft.editingItemId &&
        (wardrobeDraft.rawPhotoUrl || wardrobeDraft.croppedPhotoUrl || wardrobeDraft.name?.trim())
    );
    const hasMyDayDraft = Boolean(
      myDayDraft && (myDayDraft.rawPhotoUrl || myDayDraft.croppedPhotoUrl || myDayDraft.caption?.trim())
    );
    const hasPostDraft = Boolean(
      createPostDraft &&
        ((Array.isArray(createPostDraft.photos) && createPostDraft.photos.length > 0) ||
          createPostDraft.caption?.trim())
    );
    const hasOotdDraft = Boolean(
      ootdDraft &&
        ((Array.isArray(ootdDraft.photos) && ootdDraft.photos.length > 0) || ootdDraft.caption?.trim())
    );

    if (savedNav && VALID_NAV_SECTIONS.includes(savedNav.activeSection)) {
      setActiveSection(savedNav.activeSection);
      setViewingUserId(savedNav.viewingUserId || null);
    } else if (hasWardrobeDraft) {
      setActiveSection('wardrobe');
    } else if (hasOotdDraft) {
      setActiveSection('ootd');
    }

    const modalToRestore: ActiveModalType =
      savedNav?.activeModal && savedNav.activeModal !== 'none'
        ? savedNav.activeModal
        : hasWardrobeDraft
        ? 'wardrobe_add'
        : hasMyDayDraft
        ? 'myday'
        : hasPostDraft
        ? 'create_post'
        : 'none';

    if (modalToRestore === 'wardrobe_add') {
      setActiveSection('wardrobe');
      setOpenAddClothing(true);
      setWardrobeModalOpen(true);
    } else if (modalToRestore === 'myday') {
      setCreateMyDayOpen(true);
    } else if (modalToRestore === 'create_post') {
      setCreatePostOpen(true);
    }

    hydratedUidRef.current = uid;
  }, [userProfile?.uid]);

  // Keep session navigation & active modal synchronized
  useEffect(() => {
    const uid = userProfile?.uid;
    if (!uid || hydratedUidRef.current !== uid) return;

    const activeModal: ActiveModalType = wardrobeModalOpen
      ? 'wardrobe_add'
      : createMyDayOpen
      ? 'myday'
      : createPostOpen
      ? 'create_post'
      : 'none';

    saveSessionNavState(uid, {
      activeSection,
      activeModal,
      viewingUserId,
    });
  }, [
    userProfile?.uid,
    activeSection,
    viewingUserId,
    wardrobeModalOpen,
    createMyDayOpen,
    createPostOpen,
  ]);

  const allStoryGroups = useMemo(() => {
    const byUser = new Map<string, MyDayUserGroup>();
    storiesForFeed.forEach((story) => {
      const existing = byUser.get(story.userId);
      const ts = new Date(story.createdAt).getTime();
      if (existing) {
        existing.stories.push(story);
        if (ts > existing.latestAt) existing.latestAt = ts;
      } else {
        byUser.set(story.userId, {
          userId: story.userId,
          authorName: story.authorName,
          authorUsername: story.authorUsername,
          authorPhotoUrl: story.authorPhotoUrl,
          stories: [story],
          hasUnviewed: false,
          latestAt: ts,
        });
      }
    });
    return Array.from(byUser.values()).map((g) => ({
      ...g,
      stories: [...g.stories].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));
  }, [storiesForFeed]);

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
    if (inviteUsername && !showStandardAuth) {
      return (
        <JoinInvitePage
          inviterUsername={inviteUsername}
          onContinueToEmailAuth={() => setShowStandardAuth(true)}
        />
      );
    }
    return <AuthPage />;
  }

  if (needsOnboarding) {
    return (
      <OnboardingFlow
        onNavigate={(sec) => setActiveSection(sec)}
        onToast={showToast}
      />
    );
  }

  const navigateToSection = (sec: NavSection) => {
    if (sec !== 'wardrobe') {
      setWardrobeModalOpen(false);
    }
    if (sec === 'profile') setViewingUserId(null);
    setActiveSection(sec);
  };

  const handleOpenProfile = (uid: string) => {
    setWardrobeModalOpen(false);
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
    setPlannedShare(null);
    setCreateInitialItemId(undefined);
    setCreateInitialOutfitId(outfit.id);
    setCreatePostOpen(true);
  };

  const handleSharePieceToFeed = (item: ClothingItem) => {
    setPlannedShare(null);
    setCreateInitialOutfitId(undefined);
    setCreateInitialItemId(item.id);
    setCreatePostOpen(true);
  };

  const handleSharePlannedOutfit = (outfit: Outfit, date: string) => {
    setCreateInitialItemId(undefined);
    setCreateInitialOutfitId(undefined);
    setPlannedShare({ outfit, date });
    setCreatePostOpen(true);
  };

  const handleMessageUser = async (target: UserProfile) => {
    try {
      const conv = await startDmWithFriend(target);
      setInitialConversationId(conv.id);
      setActiveSection('messages');
    } catch (err: any) {
      showToast(err?.message || 'You must be friends to send direct messages.', 'error');
    }
  };

  const handleViewUserStory = (targetUid: string) => {
    const group = allStoryGroups.find((g) => g.userId === targetUid);
    if (group) {
      setStoryViewerState({ groups: allStoryGroups, initialUserId: targetUid });
    } else {
      showToast('No active MyDay stories right now.');
    }
  };

  const openBlankCreatePost = () => {
    setPlannedShare(null);
    setCreateInitialOutfitId(undefined);
    setCreateInitialItemId(undefined);
    setCreatePostOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <Sidebar
        activeSection={activeSection}
        onSelectSection={navigateToSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenCreatePost={(initialType) => {
          setPlannedShare(null);
          setCreateInitialOutfitId(undefined);
          setCreateInitialItemId(undefined);
          if (initialType === 'ootd') {
            navigateToSection('ootd');
          } else {
            setCreatePostOpen(true);
          }
        }}
        onOpenCreateMyDay={() => setCreateMyDayOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigate={navigateToSection}
          onOpenCreatePost={openBlankCreatePost}
        />

        <main
          id="main-content"
          className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-10 max-w-[1400px] w-full mx-auto"
        >
          <ErrorBoundary title="This section ran into an unexpected error">
            {activeSection === 'home' && (
              <HomeFeedPage
                onNavigate={navigateToSection}
                onOpenCreatePost={openBlankCreatePost}
                onOpenCreateMyDay={() => setCreateMyDayOpen(true)}
                onOpenStoryViewer={(groups, initialUserId) =>
                  setStoryViewerState({ groups, initialUserId })
                }
                onOpenProfile={handleOpenProfile}
                onRemixPost={handleRemixPost}
                onToast={showToast}
              />
            )}

            {activeSection === 'ootd' && (
              <OotdPage
                onOpenProfile={handleOpenProfile}
                onRemixPost={handleRemixPost}
                onNavigate={navigateToSection}
                onToast={showToast}
              />
            )}

            {activeSection === 'people' && (
              <PeoplePage
                onOpenProfile={handleOpenProfile}
                onMessageUser={handleMessageUser}
                onToast={showToast}
              />
            )}

            {activeSection === 'messages' && (
              <MessagesPage
                initialConversationId={initialConversationId}
                onClearInitialConversation={() => setInitialConversationId(null)}
                onOpenProfile={handleOpenProfile}
                onNavigatePeople={() => navigateToSection('people')}
              />
            )}

            {activeSection === 'explore' && (
              <ExplorePage
                onOpenProfile={handleOpenProfile}
                onRemixPost={handleRemixPost}
                onNavigate={navigateToSection}
                onToast={showToast}
              />
            )}

            {activeSection === 'wardrobe' && (
              <WardrobePage
                openAddModalOnMount={openAddClothing}
                onConsumedOpenAdd={() => setOpenAddClothing(false)}
                onModalStateChange={setWardrobeModalOpen}
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
                onNavigate={navigateToSection}
                onToast={showToast}
              />
            )}

            {activeSection === 'lookbook' && (
              <LookbookPage
                onNavigate={navigateToSection}
                onEditInBuilder={handleEditInBuilder}
                onShareOutfitToFeed={handleShareOutfitToFeed}
                onToast={showToast}
              />
            )}

            {activeSection === 'wishlist' && <WishlistPage onToast={showToast} />}

            {activeSection === 'planner' && (
              <PlannerPage
                onNavigate={navigateToSection}
                onSharePlannedOutfit={handleSharePlannedOutfit}
                onToast={showToast}
              />
            )}

            {activeSection === 'notifications' && (
              <NotificationsPage
                onOpenProfile={handleOpenProfile}
                onNavigate={navigateToSection}
                onToast={showToast}
              />
            )}

            {activeSection === 'profile' && (
              <ProfilePage
                viewingUserId={viewingUserId}
                onBackToOwn={() => setViewingUserId(null)}
                onOpenProfile={handleOpenProfile}
                onNavigate={navigateToSection}
                onMessageUser={handleMessageUser}
                onViewStory={handleViewUserStory}
                onRemixPost={handleRemixPost}
                onToast={showToast}
              />
            )}

            {activeSection === 'settings' && <SettingsPage onToast={showToast} />}
          </ErrorBoundary>
        </main>
      </div>

      <CreatePostModal
        open={createPostOpen}
        initialOutfitId={createInitialOutfitId}
        initialItemId={createInitialItemId}
        initialPlannedOutfit={plannedShare}
        onOpenCreateMyDay={() => {
          setCreatePostOpen(false);
          setCreateMyDayOpen(true);
        }}
        onClose={() => {
          setCreatePostOpen(false);
          setPlannedShare(null);
        }}
        onPublished={(msg) => showToast(msg)}
        onToast={showToast}
      />

      {createMyDayOpen && (
        <CreateMyDayModal
          onClose={() => setCreateMyDayOpen(false)}
          onCreated={() => showToast('Shared to MyDay for 24 hours!')}
          onToast={showToast}
        />
      )}

      {storyViewerState && (
        <MyDayViewerModal
          groups={storyViewerState.groups}
          initialUserId={storyViewerState.initialUserId}
          onClose={() => setStoryViewerState(null)}
          onOpenProfile={(uid) => {
            setStoryViewerState(null);
            handleOpenProfile(uid);
          }}
          onOpenMessages={() => {
            setStoryViewerState(null);
            navigateToSection('messages');
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 lg:bottom-5 right-5 z-[90] px-4 py-3 rounded-control border text-xs font-medium flex items-center gap-2.5 shadow-xl ${
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
    <ErrorBoundary title="SWOOOSH ran into an error">
      <ThemeProvider>
        <AuthProvider>
          <WardrobeProvider>
            <SocialContextProvider>
              <MainShell />
            </SocialContextProvider>
          </WardrobeProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
